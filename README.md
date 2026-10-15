# EStude Frontend

Frontend Next.js cho luồng đăng ký, đăng nhập và trang tổng quan EStude.

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
