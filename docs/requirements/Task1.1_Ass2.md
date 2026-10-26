__1\. Bối cảnh và Vấn đề Nghiệp vụ \(Business Context &amp; Problem__

__Statement\)__

__Tắc nghẽn quầy: __Giảm thời gian chờ đợi và ùn tắc tại quầy thanh toán vào giờ cao điểm\.

__Sai sót order: __Hạn chế nhầm lẫn, sai sót khi ghi nhận các tùy chọn đồ uống \(đường, đá, topping\)\.

__Giải pháp: __Cung cấp giao diện Web PWA di động linh hoạt giúp khách hàng tự đặt hàng, thanh toán và theo dõi đơn theo thời gian thực\.

__2\. Bảng Phân tích Stakeholders \(Đối tác &amp; Các bên liên quan\)__

__STT__

__Stakeholder__

__Vai trò __

__Mục tiêu & Kỳ vọng chính__

1

Khách hàng \(Customer\)

Đặt hàng trên PWA

Đặt món nhanh, chọn topping linh hoạt, thanh toán tiện lợi và theo dõi trạng thái đơn\.

2

Nhân viên quầy \(Barista / Cashier\)

Tiếp nhận & Pha chế

Màn hình quầy trực quan, tự động cập nhật đơn, giảm sai sót pha chế\.

3

Quản lý cửa hàng \(Store Manager\)

Giám sát vận hành

Quản lý danh mục menu \(bật/tắt món\) và theo dõi doanh thu cửa hàng\.

4

Giảng viên / Khách hàng nghiệm thu

Đánh giá chất lượng

Đáp ứng đúng yêu cầu môn học, hệ thống chạy ổn định, kiến trúc chuẩn và có CI/CD\.

5

Nhóm phát triển \(Development Team\)

Xây dựng hệ thống

Code sạch, tuân thủ tiến độ Sprint, tích hợp CI/CD và tài liệu đầy đủ\.

6

Đơn vị thanh toán \(Payment Provider\)

Cổng thanh toán Sandbox

Xử lý giao dịch an toàn và phản hồi trạng thái thanh toán chính xác\.

__3\. Phạm vi Dự án \(Project Scope\)__

Phân loại phạm vi

Mô tả chi tiết 

Ghi chú / Đội ngũ

Phạm vi MVP \(In\-Scope\)

Xem Menu & Chi tiết sản phẩm  
Tùy chỉnh chọn Size, Đường, Đá, Topping  
Quản lý Giỏ hàng & Đăng nhập JWT  
Đặt đơn & Thanh toán qua Sandbox  
Khách hàng theo dõi trạng thái đơn real\-time  
Nhân viên sử dụng Màn hình quầy nhận đơn

Bắt buộc hoàn thành trong 2 Sprint

Phạm vi Mở rộng \(Extended Scope\)

Tích điểm & Mã giảm giá \(Loyalty/Voucher\)  
Thông báo đẩy Web Push khi chuyển trạng thái  
Báo cáo & Phân tích doanh thu cho Quản lý  
Kết nối cổng thanh toán thật \(MoMo, VNPay\)

Phát triển ở các phiên bản tiếp theo

Ngoài phạm vi \(Out\-of\-Scope\)

Dịch vụ giao hàng tận nơi \(Shipping/Delivery\)  
Kết nối máy in hóa đơn vật lý tại quầy  
Quản lý xuất\-nhập\-tồn kho nguyên liệu thô

Không thực hiện trong dự án này

__4\. Giả định và Ràng buộc \(Assumptions & Constraints\)__

Loại 

Nội dung chi tiết

Tác động đến hệ thống

Giả định \(Assumptions\)

Khách hàng sở hữu smartphone kết nối Internet\.  
Cửa hàng trang bị ít nhất 1 tablet/máy tính tại quầy\.  
Dịch vụ Payment Sandbox hoạt động ổn định\.

Đảm bảo luồng vận hành end\-to\-end diễn ra liên tục\.

Ràng buộc \(Constraints\)

Frontend: Next\.js \(Mobile\-first/PWA\)  
Backend: NestJS | Database: PostgreSQL  
Môi trường: Đóng gói Docker, triển khai HTTPS  
Tiến độ: Hoàn thành trong 2 Sprint môn học

Ràng buộc kỹ thuật bắt buộc theo yêu cầu Assignment\.

__5\. Quản lý Rủi ro Ban đầu \(Initial Risk Assessment\)__

Mã RR

Mô tả rủi ro

Mức độ

Ảnh hưởng

Biện pháp giảm thiểu

RSK\-01

Chậm tiến độ do phối hợp FE/BE chưa đồng bộ\.

Cao

Chậm tiến độ Task 4 & 5

Thống nhất Swagger spec sớm, dùng Mock API\.

RSK\-02

Dịch vụ Payment Sandbox bị lỗi/phản hồi chậm\.

Trung bình

Khách không hoàn tất đặt đơn

Cấu hình Timeout, dùng Mock Payment fallback\.

RSK\-03

Trùng lặp thanh toán khi khách click liên tục\.

Cao

Sai lệch dữ liệu tài chính

Dùng Idempotency Key, disable button sau click\.

RSK\-04

Sản phẩm hết hàng trong lúc khách đang đặt\.

Trung bình

Xung đột tồn kho

Check tồn kho trong DB Transaction khi tạo đơn\.

RSK\-05

Sự cố triển khai CI/CD hoặc lỗi server Cloud\.

Trung bình

URL Production bị gián đoạn

Cấu hình Health check, test kỹ pipeline CI/CD\.

