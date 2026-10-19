# EStude Frontend

Frontend Next.js cho luồng đăng ký, đăng nhập và trang tổng quan EStude.

## Chạy SaaS với backend Go

Backend Go phải chạy ở port `8090`, đã migrate và tạo tenant. Dừng dev server Next cũ trước khi chạy:

```bash
npm run dev:saas
```

Lệnh này chạy Next.js ở port `3000` và proxy local ở `127.0.0.1:8091`, tự đặt `NEXT_PUBLIC_API_URL=/api/v1` và bỏ cấu hình ép portal. Mở `http://admin.demo-school.localhost:8091/login`; thay `admin` bằng `teacher`, `student` hoặc `parent` để chọn portal, thay `demo-school` bằng tenant đã tạo.

Nếu Nginx Docker đang chiếm port `8091`, dừng riêng Nginx trước:

```bash
cd ../estude-backend-go
docker compose --profile app --profile edge stop nginx
cd ../estude-frontend
npm run dev:saas
```

Proxy này chỉ dùng cho local development, giữ hostname tenant và chuyển `/api/v1` tới Go; các đường dẫn còn lại và HMR chuyển tới Next.js. Nó tránh kết nối từ Docker tới dev server trên host bị firewall chặn. Các route chưa port sang Go vẫn theo lộ trình migration. Không dùng proxy dev làm ingress production.

## Source quản trị SaaS riêng

Quản trị toàn nền tảng nằm ở project [estude-saas-admin](../estude-saas-admin/README.md), chạy riêng bằng `npm run dev` tại **http://platform.localhost:3005**. Project này chỉ phục vụ bốn portal của trường học; lệnh `dev:saas` ở đây kết nối portal trường với backend Go.

## Chạy dự án

1. Chạy `npm ci`.
2. Chạy `npm run dev` (tương đương `npm run dev:saas`).
3. Mở `http://admin.demo-school.localhost:8091/login`; dùng `teacher`, `student` hoặc `parent` cho các portal còn lại.

Backend duy nhất là Go. API mặc định `/api/v1` qua proxy cùng origin, gồm cả WebSocket chat. Production cũng định tuyến `/api/v1` tới Go theo hostname tenant. Các module chưa nghiệm thu được kiểm soát trong `lib/features.ts`; không chọn backend bằng biến môi trường.

## Deploy frontend trường học lên Vercel

Tạo project riêng `estude-saas-frontend` từ repo `SaaS-Estude/estude-frontend`.
Chọn Next.js, Node 22.x, Install Command `npm ci`, Build Command `npm run build`
và Output Directory mặc định. Đặt biến môi trường Production:

```ini
NEXT_PUBLIC_API_URL=/api/v1
GO_API_URL=https://saas-api.estude.io.vn
```

`GO_API_URL` chỉ dành cho server Next.js, không có hậu tố `/api/v1`. Không đặt
database/JWT/S3 credential vào frontend. Khi dùng Preview, cấu hình riêng cho
môi trường đó và gắn hostname portal đã đăng ký trước khi thử đăng nhập.

Route `app/api/v1/[...path]/route.ts` chuyển HTTP tới Go, giữ Host của trường,
Origin, cookie, Authorization, Idempotency-Key và trạng thái lỗi. Kết nối HTTPS
xác thực chứng chỉ/SNI theo hostname trong `GO_API_URL`. Backend Go tiếp tục
quyết định trường nào tồn tại, tài khoản, phiên, quyền và nghiệp vụ. Request không
được dùng header để chọn tenant hoặc đổi đích backend. Phản hồi không cache chéo
trường; tải file vẫn dùng URL S3 được backend cấp.

Chat dùng route `app/api/v1/class-chat/ws/route.ts` trên Vercel Functions với
Fluid Compute bật. Route chuyển tiếp frame tới Go, giữ nguyên việc gửi access
token trong frame đầu tiên, không đưa token vào URL. Go vẫn xác thực và kiểm tra
quyền lớp. Đây là chức năng WebSocket Beta của Vercel; mỗi kết nối được đóng trước
giới hạn 180 giây và client hiện có tự kết nối lại. Local tiếp tục dùng
`npm run dev:saas`, không cần chạy Vercel CLI. Tham khảo
[Vercel WebSockets](https://vercel.com/docs/functions/websockets) và
[API Next.js upgradeWebSocket](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#upgradewebsocket).

Sau khi tạo trường trong SaaS Admin, lấy đúng các địa chỉ được đăng ký, ví dụ
`student.nguyen-trai.saas.estude.io.vn`, rồi thêm chúng vào **project FE trường học
→ Settings → Domains** và tạo DNS theo Vercel hiển thị. Bốn portal của một trường
cùng trỏ tới project này. Wildcard một cấp không bao phủ hostname portal hai cấp;
có thể thêm từng hostname khi triển khai những trường đầu tiên. Trang chủ
`estude.io.vn` và URL `.vercel.app` không đại diện cho một trường để đăng nhập.
Chuyển domain trên Vercel không tự đăng ký hostname tương ứng trong backend.

Kiểm tra `https://student.<trường>.saas.estude.io.vn/api/v1/tenant` trả JSON đúng
trường trước khi đăng nhập tại `/login`. `404` với request ID từ Go thường là
hostname chưa đăng ký hoặc trường không hoạt động; `503` báo thiếu cấu hình
`GO_API_URL`; `502` là lỗi kết nối tới backend. Test transport/TLS/chat bằng
`npm run test:proxy`. Các bài test dùng server fixture, không tạo dữ liệu trường
trên production.

## Chạy riêng trang giới thiệu

Chạy `npm run dev:home` rồi mở `http://localhost:3004` để xem trang giới thiệu
tổng quan EStude. Chế độ Home hiển thị trang giới thiệu ngay tại `/`, đồng thời
giữ các đường dẫn `/about` và `/help`.

Home dùng cache `.next-home` riêng và cổng `3004`, có thể chạy cùng các portal
Admin, Teacher, Student và Parent. Cấu hình `NEXT_PUBLIC_AUTH_PORTAL=home`
chỉ áp dụng khi phát triển, bỏ qua việc nhận diện vai trò từ hostname hoặc cổng
để không tự chuyển trang chủ sang đăng nhập.

Để dùng cổng khác: `npm run dev:home -- --port 3010`.

## Khu vực theo vai trò

Khi `NODE_ENV=development`, portal đăng nhập được npm script thiết lập bằng
`NEXT_PUBLIC_AUTH_PORTAL`. Khi `NODE_ENV=production`, ứng dụng bỏ qua cấu hình portal local và
tự nhận diện hostname bắt đầu bằng `student`, `teacher`, `parent` hoặc `admin`;
SaaS dùng `<portal>.<trường>.<tên-miền-gốc>`, tất cả đều dùng path `/login`.

- `ADMIN`: `/admin/dashboard`
- `TEACHER`: `/teacher/dashboard`
- `STUDENT`: `/student/dashboard`
- `PARENT`: `/parent/dashboard`

Route `/dashboard` được giữ để tự chuyển người dùng về đúng khu vực theo vai trò.

## Chạy nhiều vai trò khi phát triển

- `npm run serve` hoặc `npm run serve:all`: chạy đồng thời Admin, Teacher, Student và Parent.
- `npm run serve:admin`: Admin tại `http://localhost:3000`.
- `npm run serve:teacher`: Teacher tại `http://localhost:3001`.
- `npm run serve:student`: Student tại `http://localhost:3002`.
- `npm run serve:parent`: Parent tại `http://localhost:3003`.

`serve:all` dùng một Next.js dev server và ba proxy nhẹ để tiết kiệm RAM nhưng vẫn giữ đủ HMR trên cả bốn cổng. Khi chạy riêng, mỗi vai trò sử dụng thư mục cache Next.js độc lập.

Middleware nhận diện portal từ hostname production `<portal>.<trường>.<tên-miền-gốc>` hoặc cổng local. Mỗi origin gọi endpoint auth tương ứng và dùng refresh cookie riêng, nên có thể mở đồng thời nhiều portal mà không ghi đè phiên.

### Nội dung G04 trên Go SaaS

Giữ `npm run dev:saas` và URL portal tại cổng 8091. Không gian lớp giáo viên, thư viện và môn học sinh dùng Go `/api/v1`. File gửi trực tiếp S3 bằng URL ký; cần cấu hình private bucket/CORS và STORAGE_* ở backend. Trên trang nội dung dùng Go, thao tác assignment/exam/progress/grade/chat được mở lại theo phase sở hữu G05–G09. Xem [G04](../estude-backend-go/docs/g04/README.md).

G05 đã bật TeacherAssignmentPanel trong bài học và trang `/student/assignments`, `/student/assignments/[id]` trên Go. Có giao bài, nộp file/văn bản, lịch sử, chấm nháp/trả điểm và gia hạn; giữ progress/exam/gradebook/chat theo phase sở hữu. Xem [G05](../estude-backend-go/docs/g05/README.md).

G07 đã nối giao diện tạo/sửa/công bố đề, defaults giáo viên, làm bài/autosave/submit, chấm tự luận/finalize, báo cáo lớp, công bố kết quả, thi bù và lịch riêng với Go. Teacher: `/teacher/exams`, student: `/student/exams`. Lệnh chạy giữ `npm run dev:saas`; API same-origin `/api/v1`. Trang G07 không gọi AI/intervention chưa chuyển ở G10/G11; sổ điểm đầy đủ/tiến độ tiếp tục G08. Xem [hồ sơ G07](../estude-backend-go/docs/g07/README.md).


G10 mở tạo câu hỏi AI/cấu hình giáo viên, phân tích lớp và Study Coach (tài liệu, knowledge map, flashcard, quiz, mastery). API vẫn `/api/v1`, không cần thêm biến AI vào frontend. PDF Study Coach tối đa 10 MiB, cần backend S3/Gemini/Poppler/pgvector. Insight hiển thị theo capability `STUDY_COACH_INSIGHTS_ENABLED` phía Go. Các màn phân tích cá nhân và can thiệp được mở trong G11.

G10 đã nghiệm thu 15 route trên Chrome và 265 test frontend; giữ `npm run dev:saas`. Khởi động lại dev proxy để nhận timeout 150 giây cho AI. [Vận hành G10](../estude-backend-go/docs/g10/README.md#van-hanh) mô tả cấu hình server và giới hạn.

G11 mở phân tích bài làm, luyện tập/kết quả, evidence/baseline, kế hoạch cá nhân/nhóm, đánh giá lại và inbox hỗ trợ học tập. Giữ `npm run dev:saas`, không thêm biến API/provider vào frontend. Review/phản hồi gửi phiên bản analysis để tránh duyệt nhầm dữ liệu cũ; backend vẫn quyết định quyền và lịch công bố đáp án. [Hồ sơ G11](../estude-backend-go/docs/g11/README.md) gồm 13 trang Chrome và 62 API đã đối soát.

### G12 — Tổng quan, phụ huynh và branding

Dashboard admin/teacher, tổng quan kết quả học sinh, trang chi tiết con của phụ huynh và ngưỡng cảnh báo đã nối Go. Trang phụ huynh nhận UUID PostgreSQL; điểm nháp không xuất hiện, revoked link ngăn đọc lại dữ liệu. Root tenant provider lấy tên/màu qua `/api/v1/tenant` cùng origin và áp dụng cho 104 route shells. Không thêm env hoặc giữ cache/token của trường trong browser storage. Khởi động lại dev Next để nhận thay đổi root provider/Tailwind; lệnh vẫn `npm run dev:saas`.

[Hồ sơ G12](../estude-backend-go/docs/g12/README.md) có 9 trang G12, hồi quy 101 route identity/nghiệp vụ, 104 tenant shells và tenant thứ hai. SaaS job operations nằm trong project `estude-saas-admin` riêng. G13 tiếp tục nghiệm thu production.
