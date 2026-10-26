# Maycha (BrewLite) – Ứng dụng đặt đồ uống không dùng tiền mặt

Bài tập lớn môn **Công nghệ Phần mềm** – Trường Đại học Sài Gòn, Khoa CNTT, HK I năm học 2026–2027.

Khách xem menu, chọn size/topping, thêm vào giỏ, đăng nhập, thanh toán không tiền mặt rồi nhận **mã đơn** để lấy nước tại quầy. Dự án làm theo quy trình **Agile Scrum** với 10 task chia vào 3 Sprint.

| Thành phần | Công nghệ |
| ---------- | --------- |
| Frontend | Next.js 16 (React 19, TypeScript), Tailwind CSS 4 – thư mục `apps/web` |
| Backend | NestJS 12 (TypeScript), REST, class-validator, JWT HS256 – thư mục `apps/api` |
| Cơ sở dữ liệu | PostgreSQL 16 + Prisma 7 (migrations trong `apps/api/prisma`) |
| Thanh toán | Mock `WALLET` / `CARD` / `MOMO` / `VNPAY` / `FAIL` + tích hợp tuỳ chọn **SePay QR** (chuyển khoản thật, xác nhận qua webhook) |
| DevOps | Docker Compose (3 service), GitHub Actions CI |

---

## Mục lục

- [Maycha (BrewLite) – Ứng dụng đặt đồ uống không dùng tiền mặt](#maycha-brewlite--ứng-dụng-đặt-đồ-uống-không-dùng-tiền-mặt)
  - [Mục lục](#mục-lục)
  - [1. Chạy nhanh bằng Docker Compose](#1-chạy-nhanh-bằng-docker-compose)
  - [2. Chạy thủ công để phát triển](#2-chạy-thủ-công-để-phát-triển)
    - [2.1. Yêu cầu môi trường](#21-yêu-cầu-môi-trường)
    - [2.2. Các bước](#22-các-bước)
    - [2.3. Kiểm tra nhanh sau khi cài](#23-kiểm-tra-nhanh-sau-khi-cài)
  - [3. Trạng thái 10 task](#3-trạng-thái-10-task)
  - [4. Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
  - [5. Biến môi trường](#5-biến-môi-trường)
    - [5.1. Docker Compose – file `.env` ở thư mục gốc](#51-docker-compose--file-env-ở-thư-mục-gốc)
    - [5.2. Backend – `apps/api/.env` (tạo từ `apps/api/.env.example`)](#52-backend--appsapienv-tạo-từ-appsapienvexample)
    - [5.3. Frontend – `apps/web/.env.local` (không bắt buộc)](#53-frontend--appswebenvlocal-không-bắt-buộc)
  - [6. Danh sách API](#6-danh-sách-api)
  - [7. Lịch sử \& xác nhận đơn (Task 9)](#7-lịch-sử--xác-nhận-đơn-task-9)
    - [7.1. API](#71-api)
    - [7.2. Giao diện](#72-giao-diện)
    - [7.3. Tài khoản demo (tuỳ chọn)](#73-tài-khoản-demo-tuỳ-chọn)
  - [8. Đăng ký / đăng nhập (Task 7)](#8-đăng-ký--đăng-nhập-task-7)
  - [9. Nghiệp vụ đặt hàng \& thanh toán (Task 8, 10)](#9-nghiệp-vụ-đặt-hàng--thanh-toán-task-8-10)
    - [9.1. Thanh toán mock – `POST /payments` 🔒](#91-thanh-toán-mock--post-payments-)
    - [9.2. SePay QR (tuỳ chọn)](#92-sepay-qr-tuỳ-chọn)
    - [9.3. State machine, tồn kho, voucher, loyalty](#93-state-machine-tồn-kho-voucher-loyalty)
  - [10. Kịch bản demo end-to-end (Sprint Review)](#10-kịch-bản-demo-end-to-end-sprint-review)
  - [11. Kiểm thử \& CI](#11-kiểm-thử--ci)
  - [12. Danh sách lệnh npm](#12-danh-sách-lệnh-npm)
    - [Backend (`apps/api`)](#backend-appsapi)
    - [Frontend (`apps/web`)](#frontend-appsweb)
  - [13. Lỗi thường gặp](#13-lỗi-thường-gặp)
  - [14. Quy tắc làm việc nhóm](#14-quy-tắc-làm-việc-nhóm)

---

## 1. Chạy nhanh bằng Docker Compose

Chỉ cần cài [Docker Desktop](https://www.docker.com/products/docker-desktop/). Từ **thư mục gốc** của repo:

```bash
docker compose up --build        # lần đầu, hoặc khi code thay đổi
docker compose up -d             # những lần sau, chạy nền
docker compose logs -f backend   # xem log backend
docker compose down              # dừng, GIỮ dữ liệu
docker compose down -v           # dừng và XOÁ luôn database (cẩn thận)
```

| Service | Địa chỉ | Ghi chú |
| ------- | ------- | ------- |
| `frontend` | http://localhost:3000 | Next.js bản production; gọi API qua proxy `/api` của chính nó |
| `backend` | http://localhost:3001 | NestJS; tự chạy `prisma migrate deploy` trước khi khởi động |
| `db` | `localhost:5432` | PostgreSQL 16; user / mật khẩu / database mặc định `maycha` / `maycha_password` / `maycha_db` |

Thứ tự khởi động được đảm bảo: `backend` chỉ chạy khi `db` đã **healthy** (healthcheck `pg_isready`), `frontend` chạy sau `backend`. Dữ liệu PostgreSQL nằm trong volume `db_data` nên không mất khi tắt/bật lại container.

Muốn đổi mật khẩu DB, `JWT_SECRET`, bật tài khoản demo hay cấu hình SePay: tạo file `.env` ở **thư mục gốc** (tham khảo `.env.example`, xem [mục 5.1](#51-docker-compose--file-env-ở-thư-mục-gốc)) rồi chạy lại `docker compose up --build`.

> **Trước buổi bàn giao:** đặt `JWT_SECRET` riêng trong `.env` thay vì giá trị mặc định `change_me_in_production`.

---

## 2. Chạy thủ công để phát triển

### 2.1. Yêu cầu môi trường

| Phần mềm | Phiên bản | Ghi chú |
| -------- | --------- | ------- |
| **Node.js** | `^22.22.3`, `^24.15.0` hoặc `>=26` | Ràng buộc `engines` của NestJS 12. **24.14 trở xuống không đạt.** Kiểm tra: `node -v` |
| **npm** | đi kèm Node (≥ 10) | Chỉ dùng npm (dự án dùng `package-lock.json`) |
| **PostgreSQL** | 16 | Dễ nhất là chạy bằng Docker: `docker compose up -d db` |
| **Git** | bất kỳ | |

### 2.2. Các bước

Mở **2 terminal**, mọi lệnh chạy từ **thư mục gốc** của repo.

**Bước 0 – bật database** (nếu chưa có PostgreSQL trên máy):

```bash
docker compose up -d db
```

**Terminal 1 – Backend:**

| Windows PowerShell | macOS / Linux / Git Bash |
| ------------------ | ------------------------ |
| `cd apps/api` | `cd apps/api` |
| `Copy-Item .env.example .env` *(lần đầu)* | `cp .env.example .env` *(lần đầu)* |
| `npm install` | `npm install` |
| `npm run prisma:generate` | `npm run prisma:generate` |
| `npm run prisma:deploy` | `npm run prisma:deploy` |
| `$env:PORT=3001; npm run start:dev` | `PORT=3001 npm run start:dev` |

CMD: `copy .env.example .env` và `set "PORT=3001" && npm run start:dev` (phải có dấu ngoặc kép).

Chạy đúng khi terminal in `Nest application successfully started` và http://localhost:3001 hiện `Hello World!`. Backend tự đọc `apps/api/.env` khi khởi động (`process.loadEnvFile()`), biến đã có sẵn trong môi trường không bị ghi đè.

**Terminal 2 – Frontend:**

```bash
cd apps/web
npm install
npm run dev
```

Mở http://localhost:3000. Mặc định frontend gọi API qua proxy cùng origin `/api/*` → `http://localhost:3001` (khai báo trong `apps/web/next.config.ts`), nên **không cần** tạo `.env.local`. Chỉ tạo `apps/web/.env.local` (từ `apps/web/.env.example`) khi muốn trình duyệt gọi thẳng một địa chỉ API khác hoặc bật nút tài khoản demo.

> Nếu cổng 3000 đang bận, Next.js tự nhảy sang cổng khác – luôn đọc địa chỉ thực tế in ra trong terminal.

### 2.3. Kiểm tra nhanh sau khi cài

- [ ] http://localhost:3001 hiển thị `Hello World!`
- [ ] http://localhost:3001/products trả danh sách món (JSON)
- [ ] http://localhost:3001/orders/me trả `401` khi chưa đăng nhập
- [ ] http://localhost:3000 hiển thị menu
- [ ] http://localhost:3000/orders hiện thẻ "Đăng nhập để tiếp tục" khi chưa đăng nhập
- [ ] http://localhost:3000/login đăng ký được tài khoản mới
- [ ] `git status` **không** hiện `.env`, `node_modules/`, `.next/`, `dist/`

---

## 3. Trạng thái 10 task

| # | Task | Trạng thái | Hiện thực chính |
| - | ---- | ---------- | --------------- |
| 1 | Khởi tạo dự án | ✅ | Monorepo `apps/api` + `apps/web`, README, `.env.example`, CI |
| 2 | API danh sách sản phẩm | ✅ | `GET /products`, `GET /products/:id` (menu + tồn kho trong PostgreSQL, sản phẩm mẫu được upsert khi backend khởi động) |
| 3 | Trang Menu | ✅ | `/` – lưới sản phẩm, trạng thái đang tải / rỗng / lỗi |
| 4 | Chi tiết & tuỳ chọn | ✅ | Chọn size S/M/L, topping, giá tính theo tuỳ chọn |
| 5 | Giỏ hàng | ✅ | Thêm / sửa số lượng / xoá, tự tính tổng, badge số lượng |
| 6 | API tạo đơn | ✅ | `POST /orders` – validate, giữ tồn kho, tạo đơn `PENDING` |
| 7 | Đăng ký / đăng nhập | ✅ | `POST /auth/register`, `POST /auth/login` (bcrypt + JWT), trang `/login` |
| 8 | Thanh toán không tiền mặt | ✅ | `POST /payments` (mock), SePay QR tuỳ chọn; `PAID` / `PAYMENT_FAILED` |
| 9 | Xác nhận, lịch sử đơn & bàn giao | ✅ | `GET /orders/me`, `GET /orders/:id`, trang `/orders` và `/orders/[id]`, Docker Compose 3 service, README, test e2e luồng đầy đủ |
| 10 | Nghiệp vụ backend | ✅ | State machine, thanh toán idempotent, chống bán vượt tồn kho (transaction + điều kiện `stock >= qty`), voucher, điểm loyalty |

> Khi thay đổi cách cài, cách chạy, biến môi trường hay API, người làm **phải cập nhật README** trong cùng Pull Request.

---

## 4. Cấu trúc thư mục

```
Maycha/
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── prisma/               # schema.prisma + migrations
│   │   ├── src/
│   │   │   ├── auth/             # Task 7: đăng ký / đăng nhập
│   │   │   ├── common/           # JwtAuthGuard, @CurrentUser, jwt.util, PrismaService
│   │   │   ├── dev/              # POST /dev/demo-session (chỉ khi bật cờ)
│   │   │   ├── orders/           # Task 6, 9, 10: đơn hàng, state machine
│   │   │   ├── payments/         # Task 8, 10: thanh toán mock, SePay, loyalty
│   │   │   ├── products/         # Task 2: menu, tồn kho
│   │   │   ├── app.setup.ts      # ValidationPipe toàn cục (dùng chung cho test)
│   │   │   └── main.ts           # đọc .env, CORS, lắng nghe cổng
│   │   └── Dockerfile
│   └── web/                      # Next.js frontend
│       ├── app/
│       │   ├── page.tsx          # Menu → Chi tiết → Giỏ hàng → Thanh toán
│       │   ├── login/            # Đăng nhập / Đăng ký
│       │   ├── orders/           # Task 9: /orders (lịch sử), /orders/[id] (xác nhận)
│       │   └── payments/sepay/   # Màn hình QR SePay
│       ├── components/           # SiteHeader, StatusBadge, OrderMessages…
│       ├── lib/                  # api.ts, auth.ts, cart.ts, format.ts
│       ├── next.config.ts        # proxy /api/* → backend
│       └── Dockerfile
├── tests/api/                    # Test e2e của backend
├── docs/                         # Đề bài, sơ đồ, ma trận truy vết, hướng dẫn triển khai
├── .github/workflows/ci.yml      # CI
├── docker-compose.yml
├── .env.example                  # biến cho Docker Compose
└── README.md
```

Backend và frontend là **hai dự án Node độc lập**: chạy `npm install` trong `apps/api` và `apps/web`, không chạy ở thư mục gốc.

Tài liệu thêm: [`docs/deployment.md`](docs/deployment.md), [`docs/diagrams/system-architecture.md`](docs/diagrams/system-architecture.md), [`docs/traceability-matrix.md`](docs/traceability-matrix.md).

---

## 5. Biến môi trường

Quy tắc: **không commit file `.env`** (đã có trong `.gitignore`), chỉ commit `.env.example` với giá trị giả. Thêm biến mới thì bổ sung vào `.env.example` và bảng dưới đây.

### 5.1. Docker Compose – file `.env` ở thư mục gốc

| Biến | Mặc định trong compose | Dùng cho |
| ---- | ---------------------- | -------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `maycha` / `maycha_password` / `maycha_db` | `db`, đồng thời ghép thành `DATABASE_URL` cho `backend` (host `db`) |
| `JWT_SECRET` | `change_me_in_production` | `backend` – khoá ký/xác thực JWT |
| `NEXT_PUBLIC_API_URL` | *(rỗng)* | `frontend`, nhúng lúc **build**. Rỗng = trình duyệt gọi `/api` trên frontend, Next.js chuyển tiếp tới `http://backend:3001`. Đặt giá trị chỉ khi muốn trình duyệt gọi thẳng một API khác |
| `ENABLE_DEMO_SEED` | `false` | `backend` (bật `POST /dev/demo-session`) và `frontend` (nút "Dùng tài khoản demo", nhúng lúc build) |
| `SEPAY_BANK_CODE` / `SEPAY_ACCOUNT_NUMBER` / `SEPAY_ACCOUNT_NAME` / `SEPAY_API_KEY` | *(rỗng)* | `backend` – thanh toán SePay QR. Để trống thì chỉ dùng được các phương thức mock |

> `.env.example` ở thư mục gốc có dòng `NEXT_PUBLIC_API_URL=http://localhost:3001`. Nếu sao chép nguyên file thành `.env`, frontend sẽ gọi thẳng `localhost:3001` (vẫn chạy được trên máy local). Muốn dùng proxy như mặc định thì xoá dòng đó hoặc để trống giá trị.
>
> Biến `NEXT_PUBLIC_*` và `API_PROXY_TARGET` được nhúng lúc build – đổi giá trị thì phải `docker compose up --build`.

### 5.2. Backend – `apps/api/.env` (tạo từ `apps/api/.env.example`)

| Biến | Giá trị mẫu | Ý nghĩa |
| ---- | ----------- | ------- |
| `PORT` | `3001` | Cổng backend (mặc định 3001) |
| `DATABASE_URL` | `postgresql://maycha:maycha_password@localhost:5432/maycha_db?schema=public` | Kết nối Prisma tới PostgreSQL – **bắt buộc** khi chạy thật |
| `JWT_SECRET` | `super_secret_key_123` | Khoá ký JWT (HS256) |
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Origin được gọi API trực tiếp, cách nhau bằng dấu phẩy |
| `ENABLE_DEMO_SEED` | `false` | `true` = bật `POST /dev/demo-session` |
| `BCRYPT_ROUNDS` | *(không đặt = 10)* | Độ khó băm mật khẩu, 4–15 |
| `SEPAY_*` | *(rỗng)* | Như mục 5.1 |

### 5.3. Frontend – `apps/web/.env.local` (không bắt buộc)

| Biến | Ý nghĩa |
| ---- | ------- |
| `NEXT_PUBLIC_API_URL` | Địa chỉ backend để trình duyệt gọi thẳng. Không đặt = dùng proxy `/api` |
| `API_PROXY_TARGET` | Đích của proxy `/api/*`, mặc định `http://localhost:3001` |
| `NEXT_PUBLIC_ENABLE_DEMO` | `true` = hiện nút "Dùng tài khoản demo" (backend cũng phải bật `ENABLE_DEMO_SEED`) |

---

## 6. Danh sách API

Route có 🔒 cần header `Authorization: Bearer <accessToken>`; thiếu / sai / hết hạn token → `401`. Dữ liệu đầu vào được kiểm tra bởi `ValidationPipe` toàn cục (`src/app.setup.ts`): sai kiểu hoặc thiếu trường → `400`, trường lạ bị loại bỏ.

| Phương thức & đường dẫn | Task | Mô tả |
| ----------------------- | ---- | ----- |
| `GET /` | 1 | `Hello World!` – kiểm tra backend sống |
| `GET /products` | 2 | Menu (id, tên, giá, ảnh, tồn kho) |
| `GET /products/:id` | 2 | Chi tiết một món |
| `POST /auth/register` | 7 | Đăng ký `{ email, password }` |
| `POST /auth/login` | 7 | Đăng nhập, trả JWT |
| 🔒 `POST /orders` | 6, 10 | Tạo đơn `PENDING` từ giỏ hàng (kèm `voucherCode` tuỳ chọn) |
| 🔒 `GET /orders/me` | 9 | Lịch sử đơn của người đang đăng nhập, mới nhất trước |
| 🔒 `GET /orders/:id` | 9 | Chi tiết một đơn cho màn hình xác nhận |
| 🔒 `PATCH /orders/:id/status` | 10 | Chuyển trạng thái theo state machine, body `{ "status": "PREPARING" }` |
| 🔒 `POST /payments` | 8, 10 | Thanh toán mock, idempotent |
| 🔒 `GET /payments/loyalty` | 10 | Điểm tích luỹ của tài khoản |
| 🔒 `POST /payments/sepay/checkout` | 8 (mở rộng) | Tạo mã QR chuyển khoản SePay cho một đơn |
| `POST /payments/sepay/webhook` | 8 (mở rộng) | SePay báo giao dịch tiền vào; xác thực bằng header `Authorization: Apikey <SEPAY_API_KEY>` |
| `POST /dev/demo-session` | 9 (demo) | Chỉ khi `ENABLE_DEMO_SEED=true`; tắt thì `404` |

---

## 7. Lịch sử & xác nhận đơn (Task 9)

### 7.1. API

| Endpoint | Kết quả | Mã lỗi |
| -------- | ------- | ------ |
| 🔒 `GET /orders/me` | Mảng đơn của user (lấy từ `sub` trong JWT), sắp xếp `createdAt` giảm dần | `401` |
| 🔒 `GET /orders/:id` | Một đơn | `400` id không phải số · `401` · `404` không tồn tại **hoặc không phải đơn của mình** (không dùng 403 để không lộ đơn có tồn tại) |

Ví dụ `GET /orders/1042`:

```json
{
  "id": 1042,
  "code": "#1042",
  "status": "PAID",
  "subtotal": 123000,
  "discountAmount": 0,
  "total": 123000,
  "itemCount": 3,
  "createdAt": "2026-10-07T10:00:00.000Z",
  "updatedAt": "2026-10-07T10:00:00.000Z",
  "items": [
    { "id": 1, "productId": "4", "productName": "Cappuccino", "size": "M", "toppings": [], "qty": 1, "unitPrice": 45000, "lineTotal": 45000 },
    { "id": 2, "productId": "2", "productName": "Trà Đào Cam Sả", "size": "L", "toppings": [], "qty": 2, "unitPrice": 39000, "lineTotal": 78000 }
  ]
}
```

- `code` = `#` + id; `itemCount` = tổng số ly (tổng `qty`); `voucherCode` chỉ có khi đơn dùng mã giảm giá.
- `status` ∈ `PENDING`, `PAID`, `PAYMENT_FAILED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`.
- `userId` **không** được trả ra.

Luồng xử lý: `JwtAuthGuard` → `OrdersController` (`findMine`, `findOne`) → `OrdersService` (`findMyOrders`, `findMyOrder`) → `OrdersRepository` (`findByUserId`, `findById`, đọc PostgreSQL qua Prisma) → `toOrderResponse`.

### 7.2. Giao diện

| Trang | File | Gọi API | Hiển thị |
| ----- | ---- | ------- | -------- |
| `/orders/[id]` – Xác nhận | `apps/web/app/orders/[id]/page.tsx` | `GET /orders/:id`, `GET /payments/loyalty` | Tiêu đề theo trạng thái ("Đặt hàng thành công", "Thanh toán chưa thành công"…), **mã đơn** cỡ lớn, **trạng thái**, món (size, topping, số lượng), voucher, tổng tiền, giờ đặt, điểm tích luỹ. Đơn `PENDING` tự hỏi lại mỗi 3 giây (tối đa 20 lần ≈ 1 phút). Cuối trang có bảng demo chuyển trạng thái (Task 10) |
| `/orders` – Lịch sử | `apps/web/app/orders/page.tsx` | `GET /orders/me` | Danh sách đơn mới nhất trước, bấm để mở chi tiết; chưa có đơn → nút "Xem menu" |

Cả hai trang xử lý: đang tải; chưa đăng nhập / token hết hạn (`401` → xoá token, hiện thẻ "Đăng nhập để tiếp tục" có link quay lại đúng trang); không tìm thấy (`404` / `400`); mất kết nối backend (nút "Thử lại"). Các thẻ này nằm trong `apps/web/components/OrderMessages.tsx`.

Sau khi bấm nút "Trả xx.xxx ₫" ở bước Thanh toán, `confirmPayment` trong `apps/web/app/page.tsx` gọi `POST /orders` → `POST /payments` rồi `router.push('/orders/<id>')` cho **cả** thành công lẫn thất bại. Thanh toán lỗi thì giỏ hàng được giữ; thanh toán lại với giỏ không đổi sẽ dùng lại đơn cũ, không tạo đơn trùng.

### 7.3. Tài khoản demo (tuỳ chọn)

Đặt `ENABLE_DEMO_SEED=true` (file `.env` ở gốc khi dùng Docker, hoặc `apps/api/.env` + `NEXT_PUBLIC_ENABLE_DEMO=true` khi chạy thủ công). Ở trang `/orders` sẽ có nút **"Dùng tài khoản demo"**: backend cấp JWT 8 giờ cho tài khoản cố định `demo-user` và tạo 3 đơn mẫu (`PAID`, `PAYMENT_FAILED`, `COMPLETED`) ở lần gọi đầu, gọi lại không tạo trùng. Endpoint không nhận `userId` từ client nên không dùng để giả mạo user thật được. **Bản nộp để `false`.**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/dev/demo-session | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
curl -s http://localhost:3001/orders/me -H "Authorization: Bearer $TOKEN"
```

---

## 8. Đăng ký / đăng nhập (Task 7)

Mã nguồn: `apps/api/src/auth/`. Mật khẩu băm bằng **bcrypt** (cost mặc định 10, đổi bằng `BCRYPT_ROUNDS`). JWT ký **HS256** bằng `JWT_SECRET`, sống **1 giờ**, payload `{ sub, email, role }`.

| Endpoint | Body | Thành công | Lỗi |
| -------- | ---- | ---------- | --- |
| `POST /auth/register` | `{ "email", "password" }` (mật khẩu 8–72 ký tự) | `201` `{ id, email, loyaltyPoints }` | `400` dữ liệu sai · `409` email đã đăng ký |
| `POST /auth/login` | `{ "email", "password" }` | `200` `{ accessToken, tokenType: "Bearer", expiresIn, user }` | `400` · `401` sai email/mật khẩu (cùng một thông báo) |

Email được chuẩn hoá (cắt khoảng trắng, chữ thường). Tài khoản mới có role `CUSTOMER`. Phản hồi không bao giờ chứa mật khẩu hay hash. Frontend lưu token trong `localStorage["accessToken"]` (`apps/web/lib/auth.ts`).

```bash
curl -X POST localhost:3001/auth/register -H 'content-type: application/json' -d '{"email":"kh@maycha.vn","password":"matkhau123"}'
curl -X POST localhost:3001/auth/login    -H 'content-type: application/json' -d '{"email":"kh@maycha.vn","password":"matkhau123"}'
curl localhost:3001/orders/me -H 'Authorization: Bearer <accessToken>'
```

---

## 9. Nghiệp vụ đặt hàng & thanh toán (Task 8, 10)

### 9.1. Thanh toán mock – `POST /payments` 🔒

Body: `{ "orderId": 1001, "method": "WALLET" | "CARD" | "MOMO" | "VNPAY" | "FAIL", "idempotencyKey": "..." }`

- `WALLET` / `CARD` / `MOMO` / `VNPAY` → đơn `PAID`; `FAIL` giả lập cổng lỗi → `PAYMENT_FAILED`.
- Key idempotency lấy theo thứ tự: header `Idempotency-Key`, header `X-Idempotency-Key`, rồi trường `idempotencyKey` trong body. Gửi lại cùng key và cùng nội dung → trả lại kết quả cũ, không trừ tiền/cộng điểm lần 2. Dùng lại key với đơn hoặc phương thức khác → `409`.
- Lỗi: `400` sai dữ liệu / sai trạng thái · `404` không có đơn.

### 9.2. SePay QR (tuỳ chọn)

1. Cấu hình 4 biến `SEPAY_*` (mục 5).
2. Ở bước Thanh toán chọn **SePay QR** → frontend gọi `POST /payments/sepay/checkout` và mở trang `/payments/sepay/<id>` hiển thị QR, nội dung chuyển khoản dạng `MAYCHA-<id>`.
3. SePay gọi `POST /payments/sepay/webhook` (header `Authorization: Apikey <SEPAY_API_KEY>`); backend kiểm tra tài khoản nhận, số tiền và mã đơn rồi chuyển đơn sang `PAID`. Trang QR tự hỏi lại trạng thái.

API phải truy cập được qua HTTPS từ Internet (ví dụ dùng ngrok). **Chỉ dùng tài khoản ngân hàng thử nghiệm** – chuyển khoản QR là tiền thật. Chi tiết trong [`docs/deployment.md`](docs/deployment.md).

### 9.3. State machine, tồn kho, voucher, loyalty

- **State machine:** `PENDING → PAID → PREPARING → READY → COMPLETED`. `PENDING` có thể sang `PAYMENT_FAILED` hoặc `CANCELLED`; `PAYMENT_FAILED` có thể thanh toán lại thành `PAID` hoặc huỷ; `PAID` có thể huỷ. `COMPLETED` và `CANCELLED` là trạng thái kết thúc. Bước sai → `400` (hàm `assertTransition`).
- **Tồn kho:** `POST /orders` trừ kho trong transaction với điều kiện `stock >= qty`, nên đặt đồng thời không bán vượt; huỷ đơn thì hoàn kho trong cùng transaction.
- **Voucher:** `MAYCHA10` giảm 10%, `BREWLITE20` giảm tối đa 20.000đ. Mã sai → `400`.
- **Loyalty:** sau khi thanh toán thành công cộng 1 điểm / 10.000đ thực trả; xem bằng `GET /payments/loyalty`.

---

## 10. Kịch bản demo end-to-end (Sprint Review)

1. `docker compose up --build`, mở http://localhost:3000.
2. Menu → chọn món → chọn size, topping → **Thêm vào giỏ** (badge giỏ hàng tăng).
3. Giỏ hàng: tăng/giảm/xoá món, tổng tiền tự tính → **Thanh toán**.
4. Chưa đăng nhập → tự chuyển `/login` → **Đăng ký** (mật khẩu ≥ 8 ký tự) → tự đăng nhập và quay lại đúng bước Thanh toán, giỏ hàng còn nguyên.
5. Chọn **Ví điện tử** hoặc **Thẻ ngân hàng** → bấm **Trả xx.xxx ₫** (nút hiện tổng tiền).
6. **Màn hình xác nhận** `/orders/<id>`: "Đặt hàng thành công", mã đơn, trạng thái **Đã thanh toán**, danh sách món, tổng tiền. Giỏ hàng được xoá.
7. **Xem đơn của tôi** → `/orders`: đơn vừa đặt ở đầu danh sách.
8. Nhánh lỗi: đặt thêm đơn, tích **"Giả lập thanh toán lỗi"** → "Thanh toán chưa thành công", trạng thái `PAYMENT_FAILED`, giỏ hàng vẫn giữ → **Thanh toán lại**.
9. Bảo mật: đăng xuất rồi mở `/orders` → thẻ "Đăng nhập để tiếp tục" (`401`); mở `/orders/<id>` của tài khoản khác → "Không tìm thấy đơn hàng" (`404`).
10. (Task 10) Ở cuối màn hình xác nhận, bấm lần lượt **Bắt đầu pha chế → Pha xong, gọi khách → Đã giao cho khách**; trạng thái kết thúc không còn nút chuyển.

Tài khoản, đơn, thanh toán, tồn kho và điểm loyalty lưu trong volume `db_data`; khởi động lại không mất dữ liệu (trừ khi `docker compose down -v`).

---

## 11. Kiểm thử & CI

Chạy trong `apps/api`:

```bash
npm test                                        # unit test (Jest)
npm run test:e2e                                # toàn bộ test e2e trong tests/api
npm run test:e2e -- orders.e2e-spec.ts          # Task 9: 401 / 200 / 404 / 400 cho /orders/me, /orders/:id, demo-session
npm run test:e2e -- checkout.e2e-spec.ts        # Task 9: đăng ký → đăng nhập → POST /orders → POST /payments → xác nhận → lịch sử
npm run test:e2e -- auth.e2e-spec.ts            # Task 7: register / login + guard
npm test -- src/orders/backend.advanced.spec.ts # Task 10: state machine, idempotency, tồn kho đồng thời, voucher, loyalty
```

| File test | Nội dung |
| --------- | -------- |
| `src/common/auth/jwt-auth.guard.spec.ts` | Ký/xác thực JWT, token sai chữ ký / hết hạn / bị sửa, guard 401 / 500 |
| `src/orders/orders.service.spec.ts` | Logic đơn hàng |
| `src/orders/backend.advanced.spec.ts` | Tiêu chí chấm Task 10 |
| `src/auth/auth.service.spec.ts`, `src/dev/demo.controller.spec.ts`, `src/payments/sepay*.spec.ts` | Đăng nhập, tài khoản demo, SePay |
| `tests/api/*.e2e-spec.ts` | Gửi request HTTP thật tới toàn bộ ứng dụng NestJS |

> Khi chạy test, `NODE_ENV=test` nên `PrismaModule` cung cấp `null` và các repository dùng bộ nhớ trong, test **không cần** PostgreSQL. Khi chạy thật hoặc trong Docker, dữ liệu nằm trong PostgreSQL.

**CI** (`.github/workflows/ci.yml`) chạy mỗi lần push lên `main` và mỗi Pull Request: dựng PostgreSQL, `npm ci`, `prisma:deploy`, build + lint + unit test + e2e cho backend, lint + build cho frontend.

---

## 12. Danh sách lệnh npm

### Backend (`apps/api`)

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run start:dev` | Chạy dev, tự reload |
| `npm run start` / `npm run start:debug` | Chạy một lần / kèm debugger |
| `npm run build` | `prisma generate` + biên dịch ra `dist/` |
| `npm run start:prod` | Chạy `dist/main.js` (phải build trước) |
| `npm test` / `npm run test:watch` / `npm run test:cov` | Unit test / chạy lại khi sửa / đo coverage |
| `npm run test:e2e` | Test end-to-end |
| `npm run lint` | Kiểm tra code (oxlint) cho `src` và `tests/api` |
| `npm run format` | Định dạng code (Prettier) |
| `npm run prisma:generate` | Sinh Prisma Client |
| `npm run prisma:deploy` | Áp dụng các migration đã commit |
| `npm run prisma:migrate -- --name <tên>` | Tạo migration mới khi sửa `schema.prisma` |
| `npm run prisma:studio` | Xem dữ liệu bằng Prisma Studio |

### Frontend (`apps/web`)

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run dev` | Chạy dev, tự reload |
| `npm run build` | Build production |
| `npm start` | Chạy bản đã build |
| `npm run lint` | ESLint |

---

## 13. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| ----------- | ----------- | ---------- |
| `nest: not found` / `'next' is not recognized…` | Chưa `npm install` hoặc đứng sai thư mục | `cd apps/api` hoặc `cd apps/web` rồi `npm install` |
| `DATABASE_URL is required to connect to PostgreSQL` | Thiếu `apps/api/.env` | `cp .env.example .env` trong `apps/api` |
| Backend báo không kết nối được database | PostgreSQL chưa chạy | `docker compose up -d db`, đợi vài giây rồi chạy lại backend |
| `The table ... does not exist` | Chưa áp dụng migration | `npm run prisma:deploy` trong `apps/api` |
| `npm warn EBADENGINE … current: { node: 'v24.14.0' }` | Node thấp hơn yêu cầu | Nâng Node ≥ 24.15, xoá `node_modules` rồi `npm install` lại |
| `EADDRINUSE: address already in use :::3000` / `:::3001` | Cổng bị chiếm (server cũ chưa tắt, hoặc backend chạy thiếu `PORT=3001`) | `Ctrl + C` terminal cũ. Windows: `netstat -ano \| findstr :3000` → `taskkill /PID <PID> /F`; macOS/Linux: `lsof -i :3000` → `kill <PID>` |
| Trang `/orders` luôn "Đăng nhập để tiếp tục" dù vừa đăng nhập | Token hết hạn (1 giờ) hoặc backend đổi `JWT_SECRET` | Đăng nhập lại |
| Frontend báo "Không kết nối được tới máy chủ" | Backend chưa chạy, hoặc `NEXT_PUBLIC_API_URL` trỏ sai | Kiểm tra http://localhost:3001; bỏ `NEXT_PUBLIC_API_URL` để dùng proxy mặc định |
| Đổi biến `NEXT_PUBLIC_*` mà không có tác dụng | Biến được nhúng lúc build | Dev: tắt và chạy lại `npm run dev`; Docker: `docker compose up --build` |
| `found N vulnerabilities … npm audit fix --force` | Cảnh báo ở thư viện | **Không** chạy `npm audit fix --force` (đổi phiên bản tuỳ ý, làm hỏng dự án chung) |
| PowerShell: `running scripts is disabled on this system` | Chính sách chặn script | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `npm install` rất chậm / lỗi `EPERM` trên Windows | Repo nằm trong thư mục **OneDrive** đang đồng bộ `node_modules` | Clone repo ra ngoài OneDrive, ví dụ `C:\Projects\Maycha` |

---

## 14. Quy tắc làm việc nhóm

**Nhánh:** không push thẳng lên `main`; mọi thay đổi đi qua Pull Request và cần **ít nhất 1 thành viên khác duyệt**. Đặt tên nhánh theo loại việc: `feature/…`, `fix/…`, `docs/…`, `chore/…`.

```bash
git checkout main && git pull origin main      # 1. lấy code mới nhất
git checkout -b feature/ten-task               # 2. tạo nhánh
git add <các file đã sửa>                      # 3. commit
git commit -m "feat(backend): thêm API danh sách menu"
git push -u origin feature/ten-task            # 4. đẩy lên rồi mở PR vào main
```

**Commit message:** `<loại>(<phạm vi>): <mô tả ngắn>`, loại ∈ `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

**Checklist trước khi tạo PR:**

- [ ] Đã `git pull origin main` và xử lý xung đột
- [ ] Backend và frontend chạy được
- [ ] `npm run lint` không lỗi; `npm test` và `npm run test:e2e` qua (nếu sửa backend)
- [ ] Không commit `.env`, `node_modules/`, `dist/`, `.next/`
- [ ] `package-lock.json` chỉ thay đổi khi có cài / gỡ thư viện (commit cùng `package.json`)
- [ ] Đã cập nhật README nếu đổi cách cài, cách chạy, biến môi trường, API hoặc [trạng thái task](#3-trạng-thái-10-task)
