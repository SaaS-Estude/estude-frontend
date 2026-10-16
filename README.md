# EStude Frontend

Frontend Next.js cho luồng đăng ký, đăng nhập và trang tổng quan EStude.

## Chạy SaaS với backend Go

Backend Go phải chạy ở port `8090`, đã migrate và tạo tenant. Dừng dev server Next cũ trước khi chạy:

```bash
npm run dev:saas
```

Lệnh này chạy Next.js ở port `3000` và proxy local ở `127.0.0.1:8091`, tự đặt `NEXT_PUBLIC_BACKEND=go`, `NEXT_PUBLIC_API_URL=/api/v1` và bỏ cấu hình ép portal. Mở `http://admin.demo-school.localhost:8091/login`; thay `admin` bằng `teacher`, `student` hoặc `parent` để chọn portal, thay `demo-school` bằng tenant đã tạo.

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

1. Sao chép `.env.example` thành `.env.local` nếu API không chạy tại địa chỉ mặc định.
2. Chạy `npm install`.
3. Chạy portal cần phát triển:
   - Sinh viên: `npm run dev:student` (cũng là mặc định của `npm run dev`).
   - Giảng viên: `npm run dev:teacher`.
   - Quản trị: `npm run dev:admin`.
   - Phụ huynh: `npm run dev:parent`.
4. Mở `http://localhost:3000/login`. Mỗi lần chỉ chạy một portal trên cổng `3000`.

Backend mặc định được gọi tại `http://localhost:5000/api/v1`. Khi production, đặt `NEXT_PUBLIC_API_URL=https://api.estude.io.vn/api/v1`.

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
tự nhận diện hostname `student.estude.io.vn`, `teacher.estude.io.vn`,
`parent.estude.io.vn` hoặc `admin.estude.io.vn`; tất cả đều dùng path `/login`.

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

Middleware nhận diện portal từ hostname production (`admin.estude.io.vn`, `teacher.estude.io.vn`, `student.estude.io.vn`, `parent.estude.io.vn`) hoặc cổng local. Mỗi origin gọi endpoint auth tương ứng và dùng refresh cookie riêng, nên có thể mở đồng thời nhiều portal mà không ghi đè phiên.

### Nội dung G04 trên Go SaaS

Giữ `npm run dev:saas` và URL portal tại cổng 8091. Không gian lớp giáo viên, thư viện và môn học sinh dùng Go `/api/v1`. File gửi trực tiếp S3 bằng URL ký; cần cấu hình private bucket/CORS và STORAGE_* ở backend. Trên trang nội dung dùng Go, thao tác assignment/exam/progress/grade/chat được mở lại theo phase sở hữu G05–G09. Xem [G04](../estude-backend-go/docs/g04/README.md).

G05 đã bật TeacherAssignmentPanel trong bài học và trang `/student/assignments`, `/student/assignments/[id]` trên Go. Có giao bài, nộp file/văn bản, lịch sử, chấm nháp/trả điểm và gia hạn; giữ progress/exam/gradebook/chat theo phase sở hữu. Xem [G05](../estude-backend-go/docs/g05/README.md).

G07 đã nối giao diện tạo/sửa/công bố đề, defaults giáo viên, làm bài/autosave/submit, chấm tự luận/finalize, báo cáo lớp, công bố kết quả, thi bù và lịch riêng với Go. Teacher: `/teacher/exams`, student: `/student/exams`. Lệnh chạy giữ `npm run dev:saas`; API same-origin `/api/v1`. Trang G07 không gọi AI/intervention chưa chuyển ở G10/G11; sổ điểm đầy đủ/tiến độ tiếp tục G08. Xem [hồ sơ G07](../estude-backend-go/docs/g07/README.md).
