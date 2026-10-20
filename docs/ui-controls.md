# Component giao diện dùng chung

Các màn quản trị trường, giáo viên, học sinh và phụ huynh dùng bộ control trong `components/ui`. ESLint chặn `button`, `input`, `select`, `textarea` viết trực tiếp trong `app` và các component nghiệp vụ.

| Nhu cầu | Component |
| --- | --- |
| Thao tác chính/phụ, nút biểu tượng | `Button` từ `ui/button` |
| Ô nhập văn bản, số, mật khẩu | `Input` từ `ui/form-control` |
| Nội dung nhiều dòng | `Textarea` từ `ui/form-control` |
| Chọn từ danh sách `options`, tìm kiếm | `CustomSelect` từ `ui/form-control` |
| Form hiện có dùng `option` và `onChange(event)` | `Select` từ `ui/form-control`; giao diện vẫn là `CustomSelect` |
| Ngày, ngày giờ, giờ với API input | `DateInput` từ `ui/date-range-picker` |
| Khoảng ngày/ngày giờ với API giá trị | `DateRangePicker`, `DateTimePicker` từ `ui/date-range-picker` |
| Chọn nhiều/chọn một đáp án | `Checkbox`, hỗ trợ `type="radio"` và `indeterminate` |
| Bật/tắt một cấu hình | `ToggleSwitch` |
| Chọn tệp, thao tác qua `ref`/`FileList` | `FileInput` từ `ui/form-control` |

`Button` có variant `plain` cho tab, ô lịch, menu và nút biểu tượng có bố cục riêng. Nó giữ trạng thái disabled/focus chung mà không áp kích thước và màu của nút thao tác chính. Khi chuyển từ HTML cần giữ nguyên `type` để không thay đổi hành vi gửi form.

`Select` và `DateInput` có field native ẩn bên trong component dùng chung để giữ `FormData`, ràng buộc required/min/max, ref và sự kiện `onChange` thật. Người dùng thao tác qua select/lịch custom. Ngày giờ giữ dạng local ISO của form; việc chuyển sang múi giờ trường vẫn thuộc lớp nghiệp vụ hiện có.

Danh sách của `CustomSelect` dùng portal vào `document.body`, định vị theo nút chọn và tự đổi hướng khi sát mép màn hình. Dropdown không làm tăng vùng cuộn của modal. Khi kiểm tra giao diện, tìm `listbox`/`option` trên toàn trang qua `aria-controls`, thay vì chỉ trong DOM của dialog; sự kiện bàn phím vẫn thuộc select và Escape chỉ đóng dropdown trước.

Control HTML chỉ được dùng bên trong `components/ui` để triển khai primitive. Input file cần bộ chọn tệp của trình duyệt; checkbox/radio vẫn giữ ngữ nghĩa bàn phím và form của trình duyệt. Không thay các phần này bằng div giả lập.

Kiểm tra:

```bash
npm run lint
npx tsc --noEmit
npm test
```
