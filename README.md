# Maycha (BrewLite)

Hướng dẫn cài đặt và chạy ứng dụng đặt đồ uống Maycha.

## Yêu cầu

- **Cách nhanh bằng Docker:** cài [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- **Chạy thủ công:** Node.js `20.19+`, `22.12+` hoặc `24+`; npm; Docker để chạy PostgreSQL 16 (hoặc cài PostgreSQL 16 riêng).

## Cách 1: Chạy bằng Docker Compose

Từ thư mục gốc của dự án, chạy:

```powershell
docker compose up --build
```

Mở:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Kiểm tra backend: http://localhost:3001/health

Docker Compose tự khởi động PostgreSQL, chạy migration và khởi động ứng dụng. Không cần tạo file `.env` để chạy với cấu hình mặc định.

Để chạy nền:

```powershell
docker compose up --build -d
```

Dừng ứng dụng nhưng giữ dữ liệu:

```powershell
docker compose down
```

Xóa cả dữ liệu PostgreSQL:

```powershell
docker compose down -v
```

> Chỉ dùng cấu hình mặc định cho phát triển/thử nghiệm. Trước khi triển khai thật, hãy cấu hình mật khẩu database, `JWT_SECRET` và thông tin SePay phù hợp.

## Cách 2: Chạy thủ công để phát triển

### 1. Khởi động PostgreSQL

Nếu dùng Docker, chạy lệnh sau từ thư mục gốc:

```powershell
docker compose up -d db
```

Lệnh này tạo database PostgreSQL 16 với cấu hình mặc định của dự án.

### 2. Cài đặt và chạy backend

Trong terminal thứ nhất:

```powershell
cd apps/api
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

Backend chạy tại http://localhost:3001. File `apps/api/.env` chứa cấu hình kết nối database và JWT cho môi trường phát triển.

### 3. Cài đặt và chạy frontend

Trong terminal thứ hai, từ thư mục gốc của dự án:

```powershell
cd apps/web
npm ci
npm run dev
```

Mở http://localhost:3000. Mặc định frontend gọi backend qua proxy của Next.js; không cần tạo file `.env.local`.

### Lệnh tương ứng trên macOS/Linux

Thay lệnh sao chép file môi trường bằng:

```bash
test -f .env || cp .env.example .env
```

Khi chạy backend, có thể dùng cổng mặc định 3001. Nếu cần chỉ định cổng:

```bash
PORT=3001 npm run start:dev
```

---

## Bản đang chạy (24/24)

| | Địa chỉ |
|---|---|
| Web | https://maycha-web.tiendatsgu298.workers.dev |
| API | https://maycha-api.onrender.com |
| Kiểm tra API | https://maycha-api.onrender.com/health → `{"status":"ok"}` |

> Backend dùng gói miễn phí của Render nên **tự ngủ sau ~15 phút không có truy cập**. Lần mở đầu tiên sau đó có thể chờ 30–50 giây.

## Lệnh Docker hay dùng

| Việc | Lệnh |
|---|---|
| Xem log backend | `docker compose logs -f backend` |
| Áp dụng thay đổi trong `.env` | `docker compose up -d` |
| Build lại sau khi sửa code | `docker compose up --build -d` |

> Muốn dùng thanh toán SePay khi chạy local thì **phải tạo file `.env`** ở thư mục gốc: `Copy-Item .env.example .env` (macOS/Linux: `cp .env.example .env`), sau đó `docker compose up -d`.
> Backend tự tạo sẵn 4 sản phẩm mẫu khi khởi động; tài khoản người dùng tự đăng ký trên web.

## Biến môi trường

File `.env` ở thư mục gốc (copy từ `.env.example`) được Docker Compose đọc. **Không commit file `.env`** (đã có trong `.gitignore`).

| Biến | Dùng ở | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | Backend | Chuỗi kết nối PostgreSQL (Docker Compose tự ghép từ `POSTGRES_*`) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker | Tài khoản database local |
| `JWT_SECRET` | Backend | Khóa ký token đăng nhập – dùng chuỗi ngẫu nhiên dài khi deploy |
| `CORS_ORIGIN` | Backend | Địa chỉ frontend được phép gọi API, nhiều địa chỉ cách nhau bằng dấu phẩy |
| `PORT` | Backend | Cổng backend (mặc định 3001) |
| `ENABLE_DEMO_SEED` | Backend | `true` để bật tài khoản demo (`POST /dev/demo-session`) |
| `SEPAY_BANK_CODE` | Backend | Mã ngân hàng nhận tiền, vd `MB` |
| `SEPAY_ACCOUNT_NUMBER` | Backend | Số tài khoản nhận tiền – **phải trùng** tài khoản trên SePay |
| `SEPAY_ACCOUNT_NAME` | Backend | Tên chủ tài khoản (hiển thị trên QR) |
| `SEPAY_API_KEY` | Backend | Khóa xác thực webhook – **phải trùng** API Key cấu hình trong webhook SePay |
| `NEXT_PUBLIC_API_URL` | Frontend (lúc build) | Địa chỉ backend. Để trống khi chạy local (dùng proxy); khi deploy đặt là URL backend |
| `NEXT_PUBLIC_ENABLE_DEMO` | Frontend (lúc build) | Hiện nút "Dùng tài khoản demo" |

> Biến `NEXT_PUBLIC_*` được nhúng vào code lúc build: đổi giá trị thì phải **build lại** frontend.

## Thanh toán SePay

### Luồng hoạt động

1. Khách đặt hàng và chọn thanh toán SePay → web hiện **mã VietQR** với số tiền và nội dung `MAYCHA-<số đơn>`.
2. Khách chuyển khoản → SePay gọi **webhook** `POST /payments/sepay/webhook` của backend, header `Authorization: Apikey <SEPAY_API_KEY>`.
3. Backend kiểm tra: đúng API key, là giao dịch **tiền vào**, đúng **số tài khoản**, nội dung chứa `MAYCHA<số>`, **số tiền khớp** đơn → chuyển đơn sang **PAID** và cộng điểm thưởng.

### Cấu hình webhook trên SePay (my.sepay.vn)

| Mục | Giá trị |
|---|---|
| URL nhận webhook | `https://maycha-api.onrender.com/payments/sepay/webhook` (bản deploy) |
| Loại giao dịch | **Tiền vào** |
| Định dạng | JSON |
| Tài khoản | Tài khoản trùng `SEPAY_ACCOUNT_NUMBER` |
| Xác thực | **API Key** – dán đúng giá trị `SEPAY_API_KEY` (chỉ dán khóa, không gõ chữ `Apikey`) |
| Tự động gửi lại | Bật (phòng khi backend đang ngủ) |

### Test webhook khi chạy local

SePay không gọi được `localhost`, nên cần mở đường hầm công khai tới backend:

```powershell
winget install --id Cloudflare.cloudflared      # cài một lần
cloudflared tunnel --url http://localhost:3001
```

Lấy địa chỉ `https://xxxx.trycloudflare.com` in ra, đặt URL webhook trên SePay là `https://xxxx.trycloudflare.com/payments/sepay/webhook`.
**Giữ cửa sổ này mở** trong lúc test; mỗi lần chạy lại, địa chỉ sẽ đổi và phải sửa lại URL trên SePay.

### Mô phỏng giao dịch (Test mode của SePay)

1. Trên web: đặt hàng → chọn SePay → ghi lại **số đơn** và **số tiền**.
2. SePay → **Giao dịch → Mô phỏng giao dịch**: kéo ảnh QR vào (tự điền), hoặc điền tay:
   - Tài khoản: trùng `SEPAY_ACCOUNT_NUMBER`
   - Loại giao dịch: **Tiền vào**
   - Số tiền: đúng tổng đơn
   - Nội dung: `MAYCHA<số đơn>`
3. Mục **Gửi webhook** phải trả **200** → tải lại trang đơn hàng thấy trạng thái **Đã thanh toán**.

## Deploy lên Internet (Neon + Render + Cloudflare)

| Phần | Nền tảng | Gói |
|---|---|---|
| Database | [Neon](https://neon.tech) | Miễn phí |
| Backend | [Render](https://render.com) – cấu hình trong `render.yaml` | Miễn phí |
| Frontend | [Cloudflare Workers](https://dash.cloudflare.com) – OpenNext (`wrangler.jsonc`, `open-next.config.ts`) | Miễn phí |

### 1. Database – Neon

1. Tạo project, region **AWS Asia Pacific (Singapore)**.
2. **Connect** → **tắt Connection pooling** (chuỗi không có `-pooler`) → copy chuỗi `postgresql://...?sslmode=require`.
   Đây là mật khẩu database: không commit, không gửi công khai.

### 2. Backend – Render

1. **New → Blueprint** → chọn repo này, branch `main`. Render đọc `render.yaml` và tạo dịch vụ `maycha-api` (Docker, Singapore, health check `/health`).
2. Điền biến môi trường: `DATABASE_URL` (chuỗi Neon), `CORS_ORIGIN` (URL frontend ở bước 5.3), `SEPAY_*`. `JWT_SECRET` Render tự sinh.
3. Deploy → mở `https://<tên>.onrender.com/health` thấy `{"status":"ok"}`. Migration tự chạy lúc khởi động.

### 3. Frontend – Cloudflare Workers

1. **Workers & Pages → Create → Import a repository** → chọn repo.
   Nếu repo không hiện: vào https://github.com/settings/installations → *Cloudflare Workers and Pages* → **Configure** → cấp quyền cho repo.
2. Cấu hình:

   | Ô | Giá trị |
   |---|---|
   | Build command | `npx opennextjs-cloudflare build` |
   | Deploy command | `npx opennextjs-cloudflare deploy` |
   | Path (Root directory) | `apps/web` |
   | Build variable `NEXT_PUBLIC_API_URL` | `https://<tên>.onrender.com` (không có `/` cuối) |
   | Build variable `NEXT_PUBLIC_ENABLE_DEMO` | `false` |

3. Deploy → nhận URL `https://maycha-web.<tài-khoản>.workers.dev`.

### 4. Nối các phần

1. Render → `maycha-api` → **Environment** → đặt `CORS_ORIGIN` = URL `workers.dev` (không có `/` cuối) → Save.
2. SePay → sửa URL webhook thành `https://<tên>.onrender.com/payments/sepay/webhook`.

### Cập nhật sau khi sửa code

Push lên nhánh `main` → Render và Cloudflare **tự build và deploy lại**.
Nếu deploy từ bản fork: vào fork bấm **Sync fork → Update branch** để lấy code mới.

## Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Thanh toán báo *"Thiếu cấu hình SEPAY_…"* | Chưa có file `.env` hoặc thiếu biến `SEPAY_*` | Tạo `.env` từ `.env.example` → `docker compose up -d` |
| `docker compose` báo *read-only file system* | Ổ C: đầy, ổ ảo của Docker chuyển sang chỉ đọc | Giải phóng ổ C: → khởi động lại Docker Desktop |
| `docker` báo lỗi 500 / *API version* | Docker Desktop và CLI lệch phiên bản | Cập nhật Docker Desktop |
| Webhook trả **530** | Đường hầm cloudflared đã tắt hoặc URL cũ | Chạy lại cloudflared, cập nhật URL trên SePay |
| Webhook trả **401** | API Key trên SePay ≠ `SEPAY_API_KEY` | Dán lại cho trùng khớp |
| Webhook trả **400** | Sai tài khoản / số tiền / nội dung, hoặc đơn chưa chọn SePay | Mở chi tiết webhook xem câu lỗi; kiểm tra `SEPAY_ACCOUNT_NUMBER` |
| Webhook bị bỏ qua | Chọn **Tiền ra** khi mô phỏng | Chọn **Tiền vào** |
| Web không tải được menu, Console báo **CORS** | `CORS_ORIGIN` trên Render sai | Sửa đúng URL frontend, không có `/` cuối |
| Web gọi `localhost` sau khi deploy | Thiếu `NEXT_PUBLIC_API_URL` lúc build | Thêm biến trên Cloudflare → **Retry build** |
| Cloudflare build lỗi `npm ci ... not in sync` | `package-lock.json` tạo bằng npm khác phiên bản | `cd apps/web; npx -y npm@10 install --package-lock-only` → commit |
| Lần đầu mở web rất chậm | Backend Render đang ngủ | Chờ 30–50 giây |
