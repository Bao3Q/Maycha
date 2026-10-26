**Đặc tả use case**

| Use case name | Đặt và thanh toán đơn hàng |
| :---- | :---- |
| Actor | Khách hàng(chính), Dịch vụ thanh toán mô phỏng |
| Mô tả | Khách hàng đặt đồ uống và thực hiện thanh toán  |
| Trigger  | Khách hàng hoàn tất lựa chọn đồ uống trong giỏ hàng và nhấn nút Đặt hàng/Thanh toán.  |
| Tiền điều kiện | 1\. Hệ thống BrewLite đang hoạt động. 2\. Khách hàng đã đăng nhập và có thông tin xác thực hợp lệ. 3\. Giỏ hàng có ít nhất một sản phẩm. 4\. Các sản phẩm và tùy chọn được chọn phải hợp lệ. |
| Hậu điều kiện | Trường hợp thành công: Đơn hàng được lưu vào hệ thống cùng các chi tiết sản phẩm. Đơn hàng có mã định danh và trạng thái được cập nhật theo kết quả thanh toán. Khách hàng nhận được thông báo xác nhận và có thể xem trạng thái đơn hàng. Trường hợp thất bại: Hệ thống thông báo nguyên nhân thất bại cho khách hàng. Không ghi nhận thanh toán thành công nếu giao dịch thất bại. Dữ liệu đơn hàng và thanh toán phải nhất quán. |
| Luồng chín | 1\. Khách hàng mở giỏ hàng. 2\. Hệ thống hiển thị các sản phẩm, kích cỡ, topping, số lượng và tổng tiền dự kiến. 3\. Khách hàng nhấn nút Đặt hàng/Thanh toán. 4\. Hệ thống xác thực thông tin đăng nhập của khách hàng. 5.Hệ thống kiểm tra dữ liệu giỏ hàng, sản phẩm và số lượng. 6\. Hệ thống tính lại tổng tiền dựa trên giá do backend xác định. 7\. Hệ thống tạo đơn hàng và lưu đơn với trạng thái `PENDING`. 8\. Hệ thống gửi yêu cầu đến dịch vụ thanh toán mô phỏng. 9.Dịch vụ thanh toán trả về kết quả thành công. 10\. Hệ thống ghi nhận kết quả thanh toán và cập nhật trạng thái đơn hàng. 11\. Hệ thống trả mã đơn hàng và thông báo kết quả cho khách hàng. 12\. Khách hàng xem thông tin chi tiết và trạng thái đơn hàng. |
| Luồng thay thế | Luồng thay thế 1: tại bước 2 2a. Khách hàng thay đổi số lượng hoặc xóa sản phẩm. Hệ thống cập nhật giỏ hàng và tính lại tổng tiền, sau đó quay lại bước 2\. Luồng thay thế 2: trước bước 3  3a. Khách hàng hủy thao tác. Use Case kết thúc và không tạo đơn hàng. Luồng thay thế 3: trước bước 5 hoặc bước 6 5a/6a: Hệ thống phát hiện giá hiện tại khác giá dự kiến. Hệ thống thông báo giá mới để khách hàng xác nhận trước khi tiếp tục. Luồng thay thế 4: trước bước 9 9a. Dịch vụ thanh toán trả kết quả thất bại. Hệ thống ghi nhận kết quả, cập nhật trạng thái phù hợp và thông báo khách hàng. Luồng thay thế 5: Khách hàng gửi lại yêu cầu thanh toán \- Hệ thống kiểm tra mã tham chiếu để tránh ghi nhận giao dịch trùng lặp.  |
| Luồng ngoại lệ | E1 – Chưa đăng nhập hoặc token không hợp lệ: Hệ thống từ chối yêu cầu, thông báo khách hàng đăng nhập lại và không tạo đơn hàng. E2 – Giỏ hàng rỗng hoặc dữ liệu không hợp lệ: Hệ thống trả thông báo lỗi và yêu cầu khách hàng kiểm tra lại giỏ hàng. E3 – Sản phẩm không tồn tại hoặc đã ngừng bán: Hệ thống từ chối đặt hàng và thông báo sản phẩm không còn khả dụng. E4 – Số lượng không hợp lệ hoặc không đủ tồn kho: Hệ thống thông báo để khách hàng điều chỉnh số lượng. E5 – Lỗi cơ sở dữ liệu khi lưu đơn: Hệ thống hủy thao tác lưu chưa hoàn tất và trả thông báo lỗi. E6 – Dịch vụ thanh toán không phản hồi: Hệ thống không tự xác định giao dịch thành công; giao dịch được giữ ở trạng thái chờ hoặc xử lý theo chính sách đã quy định. E7 – Khách hàng truy cập đơn của người khác: Hệ thống từ chối truy cập và không tiết lộ thông tin đơn hàng. |

**Liên kết Use Case với yêu cầu** 

| Mã yêu cầu  | Nội dung yêu cầu  | Phần Use Case liên quan  |
| :---- | :---- | :---- |
| FR-03  | Chọn kích cỡ và topping  | Luồng chính 1–2  |
| FR-04  | Quản lý giỏ hàng và tổng tiền  | Luồng chính 1–2; luồng thay thế A1  |
| FR-05  | Xác thực khách hàng  | Luồng chính 4; ngoại lệ E1  |
| FR-06  | Tạo đơn hàng  | Luồng chính 5–7; ngoại lệ E2–E5  |
| FR-07  | Thanh toán mô phỏng  | Luồng chính 8–10; luồng thay thế A4–A5; ngoại lệ E6  |
| FR-09  | Xem chi tiết và trạng thái đơn  | Luồng chính 11–12; ngoại lệ E7  |
| NFR-02  | Kiểm tra dữ liệu đầu vào  | Luồng chính 5; ngoại lệ E2–E4  |
| NFR-03  | Xác thực và phân quyền  | Luồng chính 4; ngoại lệ E1, E7  |
| NFR-05  | Đảm bảo tính nhất quán dữ liệu  | Luồng chính 7–10; ngoại lệ E5–E6  |

