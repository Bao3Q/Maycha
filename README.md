# Đồ án CNPM: Maycha (BrewLite)

- **Đề tài:** Ứng dụng đặt đồ uống không dùng tiền mặt cho quán Maycha theo quy trình Agile Scrum.
- **Công nghệ:** Next.js (Frontend) + NestJS (Backend) + PostgreSQL / Prisma + Docker Compose.
- **Phạm vi (10 Task):**
  - Quản lý danh mục & menu: Trà sữa, cà phê, topping, chọn size.
  - Giỏ hàng & xác thực tài khoản (JWT).
  - Đặt hàng & thanh toán không tiền mặt (Mock Momo/VNPAY).
  - Xử lý nghiệp vụ nâng cao: Máy trạng thái đơn hàng (Order State Machine), idempotency, chống bán vượt tồn kho, tích điểm loyalty.
- **Kế hoạch triển khai:** Chia làm 3 Sprint (Sprint 1: Menu & Nền tảng; Sprint 2: Giỏ hàng & Tài khoản; Sprint 3: Thanh toán & Bàn giao Docker).
