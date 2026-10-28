# EStude Frontend

Frontend Next.js cho luồng đăng ký, đăng nhập và trang tổng quan EStude.

## DNS tự động và Cloudflare proxy

Hostname mới dùng dạng `admin-ten-truong.estude.io.vn` (teacher/student/parent tương tự).
Hostname cũ dạng `admin.ten-truong.estude.io.vn` tiếp tục được hỗ trợ đến khi cập nhật trường.
Khi deploy, đặt `PORTAL_PROXY_SECRET` server-only giống hệt backend và SaaS admin để
API hoạt động qua Cloudflare proxy cam. Không dùng tên `NEXT_PUBLIC_` cho secret này.
Xem [cấu hình và thứ tự triển khai](../estude-saas-backend/docs/domains/README.md).

## Chạy SaaS với backend Go

### Cấu hình `PORTAL_PROXY_SECRET` khi chạy local

`PORTAL_PROXY_SECRET` là khóa nội bộ để Next.js ký hostname cổng trường hoặc
SaaS admin; backend xác minh chữ ký trước khi dùng hostname để định tuyến.
Tạo một lần bằng:

```bash
openssl rand -hex 32
```

Copy **cùng một giá trị vừa tạo** vào `.env` của cả ba project. Các giá trị
`<cung-mot-khoa-vua-tao>` dưới đây là chỗ để thay bằng khóa của bạn:

```dotenv
# estude-saas-backend/.env
PORTAL_PROXY_SECRET=<cung-mot-khoa-vua-tao>
BASE_DOMAIN=localhost

# estude-saas-frontend/.env
PORTAL_PROXY_SECRET=<cung-mot-khoa-vua-tao>
GO_API_URL=http://127.0.0.1:8090
NEXT_PUBLIC_API_URL=/api/v1

# estude-saas-admin/.env
PORTAL_PROXY_SECRET=<cung-mot-khoa-vua-tao>
CONTROL_API_URL=http://127.0.0.1:8092
PLATFORM_HOST=platform.localhost
```

Khóa chỉ dùng ở server, không thêm tiền tố `NEXT_PUBLIC_` và không commit `.env`.
Sau khi đổi khóa, cần nạp lại env cho backend và khởi động lại cả hai Next.js:

```bash
# Từ thư mục estude-saas-backend, với database đã migrate và image hiện hành:
docker compose --env-file .env --env-file .env.platform-local --profile app --profile control up -d
```

Sau đó chạy `npm run dev` trong `estude-saas-admin` và `npm run dev:saas` trong
`estude-saas-frontend`, mỗi lệnh ở một terminal riêng. Nếu đã có tiến trình cũ,
dừng bằng Ctrl+C trước khi chạy lại.

| Cổng local | Địa chỉ |
| --- | --- |
| SaaS admin | `http://platform.localhost:3005/platform` |
| Quản trị trường | `http://admin-demo-school.localhost:8091/login` |
| Giáo viên | `http://teacher-demo-school.localhost:8091/login` |
| Học sinh | `http://student-demo-school.localhost:8091/login` |
| Phụ huynh | `http://parent-demo-school.localhost:8091/login` |

Thay `demo-school` bằng mã trường đã có trong database. Nếu SaaS admin đã lưu
tên miền gốc riêng, đặt về `localhost` trong **Tên miền** khi muốn tạo trường
local; `BASE_DOMAIN` trong env chỉ là mặc định khi chưa lưu cấu hình này.
Hostname cũ dạng `admin.demo-school.localhost` vẫn dùng được nếu database đang
đăng ký địa chỉ đó; lấy đúng link trong chi tiết trường.

URL trang trong portal dùng đường dẫn gọn theo hostname. Ví dụ:

```text
http://admin-lequydonlequy.localhost:8091/accounts
https://admin-lequydonlequy.estude.io.vn/accounts
https://teacher-lequydonlequy.estude.io.vn/courses
https://student-lequydonlequy.estude.io.vn/courses
https://parent-lequydonlequy.estude.io.vn/dashboard
```

Đường dẫn cũ như `/admin/accounts` được chuyển hướng 308 sang `/accounts`, giữ
nguyên query và fragment. Middleware ánh xạ URL gọn về nhóm trang nội bộ theo
portal của hostname. Các đường dẫn API `/api/v1/...` giữ nguyên.

Khi thêm giao diện, dùng `Link` từ `@/components/ui/portal-link` và `useRouter`
từ `@/lib/portal-navigation` để menu, nút điều hướng và liên kết động cùng tạo
URL gọn. Dùng `useWorkspacePathname` khi so khớp menu hoặc kiểm tra quyền với
đường dẫn nội bộ hiện có. Không bỏ prefix trong các khóa RBAC hoặc API.

`DOMAIN_AUTO_ENABLED` là công tắc ở backend để tự thiết lập DNS Cloudflare và
domain Vercel. Worker bỏ qua hostname `.localhost` ngay cả khi công tắc là
`true`; chạy trường local không cần gọi hai nhà cung cấp.

Lưu ý: proxy development ở cổng `8091` chuyển API trực tiếp tới Go và giữ Host,
nên luồng này không cần chữ ký. SaaS admin và các route proxy chạy qua Next.js
sẽ ký request khi có `PORTAL_PROXY_SECRET`. Nên giữ khóa khớp cả ba project để
kiểm tra cấu hình giống production. Khóa không khớp thường trả `403` với thông
báo chữ ký proxy không hợp lệ; kiểm tra cả `.env.local` và các container đã nạp
env mới trước khi thử lại.

### Khởi động frontend trường

Backend Go phải chạy ở port `8090`, đã migrate và tạo tenant. Dừng dev server Next cũ trước khi chạy:

```bash
npm run dev:saas
```

Lệnh này chạy Next.js ở port `3000` và proxy local ở `127.0.0.1:8091`, tự đặt `NEXT_PUBLIC_API_URL=/api/v1` và bỏ cấu hình ép portal. Mở `http://admin-demo-school.localhost:8091/login`; thay `admin` bằng `teacher`, `student` hoặc `parent` để chọn portal, thay `demo-school` bằng tenant đã tạo.

Nếu Nginx Docker đang chiếm port `8091`, dừng riêng Nginx trước:

```bash
cd ../estude-saas-backend
docker compose --profile app --profile edge stop nginx
cd ../estude-saas-frontend
npm run dev:saas
```

Proxy này chỉ dùng cho local development, giữ hostname tenant và chuyển `/api/v1` tới Go; các đường dẫn còn lại và HMR chuyển tới Next.js. Nó tránh kết nối từ Docker tới dev server trên host bị firewall chặn. Các route chưa port sang Go vẫn theo lộ trình migration. Không dùng proxy dev làm ingress production.

## Source quản trị SaaS riêng

Quản trị toàn nền tảng nằm ở project `estude-saas-admin`, chạy riêng bằng `npm run dev` tại **http://platform.localhost:3005**; xem [hướng dẫn SaaS admin](../estude-saas-backend/docs/saas-console/README.md). Project frontend này chỉ phục vụ bốn portal của trường học; lệnh `dev:saas` ở đây kết nối portal trường với backend Go.

## Chạy dự án

1. Chạy `npm ci`.
2. Chạy `npm run dev` (tương đương `npm run dev:saas`).
3. Mở `http://admin-demo-school.localhost:8091/login`; dùng `teacher`, `student` hoặc `parent` cho các portal còn lại.

Backend duy nhất là Go. API mặc định `/api/v1` qua proxy cùng origin, gồm cả WebSocket chat. Production cũng định tuyến `/api/v1` tới Go theo hostname tenant. Các module chưa nghiệm thu được kiểm soát trong `lib/features.ts`; không chọn backend bằng biến môi trường.

## Deploy frontend trường học lên Vercel

Tạo project riêng `estude-saas-frontend` từ repo `SaaS-Estude/estude-frontend`.
Chọn Next.js, Node 22.x, Install Command `npm ci`, Build Command `npm run build`
và Output Directory mặc định. Đặt biến môi trường Production:

```ini
NEXT_PUBLIC_API_URL=/api/v1
GO_API_URL=https://saas-api.estude.io.vn
PORTAL_PROXY_SECRET=<cung-khoa-voi-backend-va-saas-admin>
```

`GO_API_URL` chỉ dành cho server Next.js, không có hậu tố `/api/v1`. Không đặt
database/JWT/S3 credential vào frontend. Khi dùng Preview, cấu hình riêng cho
môi trường đó và gắn hostname portal đã đăng ký trước khi thử đăng nhập.

Route `app/api/v1/[...path]/route.ts` chuyển HTTP tới Go với Host của API trong
`GO_API_URL`, truyền hostname trường qua header được ký bằng `PORTAL_PROXY_SECRET`.
Origin, cookie, Authorization, Idempotency-Key và trạng thái lỗi được giữ lại.
Kết nối HTTPS xác thực chứng chỉ/SNI theo hostname trong `GO_API_URL`. Backend
xác minh chữ ký rồi tra hostname đã đăng ký; backend tiếp tục quyết định trường,
tài khoản, phiên, quyền và nghiệp vụ. Header do trình duyệt tự gửi không chọn
được tenant hoặc đổi đích backend. Phản hồi không cache chéo trường; tải file
vẫn dùng URL S3 được backend cấp.

Chat dùng route `app/api/v1/class-chat/ws/route.ts` trên Vercel Functions với
Fluid Compute bật. Route chuyển tiếp frame tới Go, giữ nguyên việc gửi access
token trong frame đầu tiên, không đưa token vào URL. Go vẫn xác thực và kiểm tra
quyền lớp. Đây là chức năng WebSocket Beta của Vercel; mỗi kết nối được đóng trước
giới hạn 180 giây và client hiện có tự kết nối lại. Local tiếp tục dùng
`npm run dev:saas`, không cần chạy Vercel CLI. Tham khảo
[Vercel WebSockets](https://vercel.com/docs/functions/websockets) và
[API Next.js upgradeWebSocket](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#upgradewebsocket).

Sau khi tạo trường trong SaaS Admin, lấy đúng các địa chỉ được đăng ký, ví dụ
`student-nguyen-trai.estude.io.vn`. Khi backend đã bật `DOMAIN_AUTO_ENABLED=true`
và cấu hình đủ provider credentials, worker tự tạo DNS Cloudflare, gắn hostname
vào project frontend trường trên Vercel và kiểm tra HTTPS. Đợi trạng thái
**Sẵn sàng** trong chi tiết trường trước khi mở link. Nếu tắt tự động, cấu hình
domain và DNS thủ công theo Vercel hiển thị. Bốn portal cùng trỏ tới project này.
Trang chủ `estude.io.vn` và URL `.vercel.app` không đại diện cho một trường để
đăng nhập. Chuyển domain trên Vercel không tự đăng ký hostname trong backend.

Kiểm tra `https://student-<ma-truong>.estude.io.vn/api/v1/tenant` trả JSON đúng
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
SaaS mới dùng `<portal>-<ma-truong>.<ten-mien-goc>`, tất cả đều dùng path `/login`;
các mapping cũ dạng `<portal>.<ma-truong>.<ten-mien-goc>` vẫn được hỗ trợ.

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


### Khôi phục tài khoản do trường cấp

Tại **Tài khoản**, admin trường có quyền **Đặt lại mật khẩu** dùng nút chìa khóa để cấp mật khẩu tạm cho học sinh, giáo viên hoặc phụ huynh không có email/mất email. Xác nhận mới gửi yêu cầu; phiên cũ bị thu hồi và người nhận phải đổi mật khẩu trước khi vào hệ thống. Khóa tài khoản giữ nguyên. Admin trường quên mật khẩu tiếp tục được SaaS admin hỗ trợ qua console.

Cần backend đã migrate tenant **025_account_password_recovery.sql**. Nhóm ADMIN tùy chỉnh cần được gán `accounts.reset_password`; backend vẫn bắt buộc vai trò ADMIN. Giao diện dùng cùng popup đổi mật khẩu cho cả ba vai trò khi server yêu cầu khôi phục, không bắt phụ huynh thông thường đổi mật khẩu mặc định.
