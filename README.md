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
