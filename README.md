# Đồ án CNPM: Maycha (BrewLite)

- **Đề tài:** Ứng dụng đặt đồ uống không dùng tiền mặt cho quán Maycha theo quy trình Agile Scrum.
- **Công nghệ:** Next.js (Frontend) + NestJS (Backend) + PostgreSQL / Prisma + Docker Compose.
- **Phạm vi (10 Task):**
  - Quản lý danh mục & menu: Trà sữa, cà phê, topping, chọn size.
  - Giỏ hàng & xác thực tài khoản (JWT).
  - Đặt hàng & thanh toán không tiền mặt (Mock Momo/VNPAY).
  - Xử lý nghiệp vụ nâng cao: Máy trạng thái đơn hàng (Order State Machine), idempotency, chống bán vượt tồn kho, tích điểm loyalty.
- **Kế hoạch triển khai:** Chia làm 3 Sprint (Sprint 1: Menu & Nền tảng; Sprint 2: Giỏ hàng & Tài khoản; Sprint 3: Thanh toán & Bàn giao Docker).

---

## 🚀 Chạy web nhanh

> **Điều kiện bắt buộc:** Node.js **≥ 24.15.0** (hoặc ≥ 22.22.3). Kiểm tra bằng `node -v`. Xem [mục 2](#2-yêu-cầu-môi-trường).

### 🐳 Cách nhanh nhất: Docker Compose (cả 3 thành phần)

Chỉ cần cài [Docker Desktop](https://www.docker.com/products/docker-desktop/). Từ thư mục gốc của repo:

```bash
docker compose up --build        # lần đầu hoặc khi code thay đổi
docker compose up -d             # chạy nền những lần sau
docker compose logs -f backend   # xem log backend
docker compose down              # dừng (thêm -v để xóa luôn dữ liệu DB)
```

| Service | Địa chỉ | Ghi chú |
| ------- | ------- | ------- |
| `frontend` | http://localhost:3000 | Next.js build production |
| `backend` | http://localhost:3001 | NestJS, đọc `DATABASE_URL`, `JWT_SECRET` từ compose |
| `db` | `localhost:5432` | PostgreSQL 16, user/pass/db mặc định `maycha` / `maycha_password` / `maycha_db` |

Muốn đổi mật khẩu DB, `JWT_SECRET`…: `cp .env.example .env` ở **thư mục gốc** rồi sửa. Xem chi tiết ở [mục 10](#10-docker-compose--bàn-giao).

### 💻 Chạy thủ công (dev, tự reload)

Mở **2 terminal**, chạy song song, **không tắt** trong lúc dùng web. Mọi lệnh đều chạy từ **thư mục gốc của repo**.

### 🪟 Windows – PowerShell (terminal mặc định của VS Code)

```powershell
# ── Terminal 1: Backend ──────────────────────────────
cd backend
Copy-Item .env.example .env        # chỉ lần đầu
npm install                        # lần đầu, hoặc khi package.json thay đổi
$env:PORT=3001; npm run start:dev
```

```powershell
# ── Terminal 2: Frontend ─────────────────────────────
cd frontend
npm install                        # lần đầu, hoặc khi package.json thay đổi
npm run dev
```

### 🍎 macOS / Linux / Git Bash

```bash
# ── Terminal 1: Backend ──────────────────────────────
cd backend
cp .env.example .env               # chỉ lần đầu
npm install                        # lần đầu, hoặc khi package.json thay đổi
PORT=3001 npm run start:dev
```

```bash
# ── Terminal 2: Frontend ─────────────────────────────
cd frontend
npm install                        # lần đầu, hoặc khi package.json thay đổi
npm run dev
```

### 🌐 Mở trên trình duyệt

| Thành phần | Địa chỉ | Dấu hiệu chạy đúng |
| ---------- | ------- | ------------------ |
| **Frontend** (giao diện) | **http://localhost:3000** | Trang web hiển thị |
| **Backend** (API) | **http://localhost:3001** | Trả về chữ `Hello World!` |

Dừng server: `Ctrl + C` trong terminal tương ứng.

> ℹ️ Backend tự đọc `backend/.env` khi khởi động (dùng `process.loadEnvFile()` có sẵn trong Node, không cần thư viện). Nếu chưa có `.env`, backend mặc định chạy cổng **3001**. Các API cần đăng nhập (vd. `/orders/me`) yêu cầu `JWT_SECRET` – đã có sẵn trong `.env.example`.

---

## Mục lục

1. [Trạng thái hiện tại của dự án](#1-trạng-thái-hiện-tại-của-dự-án)
2. [Yêu cầu môi trường](#2-yêu-cầu-môi-trường)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Cài đặt & chạy chi tiết](#4-cài-đặt--chạy-chi-tiết)
5. [Biến môi trường](#5-biến-môi-trường)
6. [Kiểm tra sau khi cài](#6-kiểm-tra-sau-khi-cài)
7. [Danh sách lệnh npm](#7-danh-sách-lệnh-npm)
8. [Lỗi thường gặp](#8-lỗi-thường-gặp)
9. [Quy tắc làm việc nhóm](#9-quy-tắc-làm-việc-nhóm)
10. [Docker Compose & bàn giao](#10-docker-compose--bàn-giao)
11. [API đơn hàng – Lịch sử & Xác nhận (Task 9)](#11-api-đơn-hàng--lịch-sử--xác-nhận-task-9)
12. [Nghiệp vụ đặt hàng & thanh toán (Task 10)](#12-nghiệp-vụ-đặt-hàng--thanh-toán-task-10)

---

## 1. Trạng thái hiện tại của dự án

| Hạng mục | Trạng thái |
| -------- | ---------- |
| Frontend (Next.js) | ✅ Khởi tạo xong; trang chủ vẫn là trang mẫu mặc định |
| Frontend – xác nhận & lịch sử đơn (Task 9) | ✅ `/orders/[id]` (màn hình xác nhận), `/orders` (lịch sử) – gọi API thật kèm JWT |
| Backend (NestJS) | ✅ `GET /`, `GET /products`, `GET /products/:id` |
| Backend – lịch sử & xác nhận đơn (Task 9) | ✅ `GET /orders/me`, `GET /orders/:id` (cần JWT) – dữ liệu đơn đang lưu trong bộ nhớ, chờ Prisma |
| Backend – nghiệp vụ đặt hàng & thanh toán (Task 10) | ✅ State machine, idempotency, kiểm soát tồn kho theo version, voucher và loyalty – dữ liệu hiện lưu trong bộ nhớ, chỉ bảo đảm giao dịch trong một tiến trình |
| Đọc file `.env` ở backend | ✅ `process.loadEnvFile()` trong `main.ts` |
| PostgreSQL / Prisma | ⚠️ Đã có container PostgreSQL trong Docker Compose; **chưa tích hợp Prisma** |
| Docker Compose | ✅ `docker-compose.yml` chạy `db` + `backend` + `frontend` |
| Frontend gọi API backend | ✅ Trang `/orders`, `/orders/[id]` (qua `frontend/lib/api.ts`); các trang khác chưa kết nối |
| Dữ liệu demo (khi chưa ghép Task 6/7/8) | ✅ `POST /dev/demo-session`, bật bằng `ENABLE_DEMO_SEED=true` |

> Khi một hạng mục được hoàn thành, người làm task đó **phải cập nhật bảng này và các mục liên quan** trong cùng Pull Request.

---

## 2. Yêu cầu môi trường

| Phần mềm | Phiên bản bắt buộc | Lý do |
| -------- | ------------------ | ----- |
| **Node.js** | `^22.22.3` hoặc `^24.15.0` hoặc `>=26` | Ràng buộc `engines` của NestJS 12 (`@nestjs/schematics`, `@angular-devkit/*`). **Bản 24.14 trở xuống KHÔNG đạt.** |
| **npm** | Đi kèm Node.js (≥ 10) | Dự án dùng `package-lock.json`, **chỉ dùng npm** (không dùng yarn / pnpm / bun để tránh lệch lock file) |
| **Git** | Bản bất kỳ | Clone và làm việc nhóm |

Phiên bản thư viện chính (theo `package-lock.json`):

| Thành phần | Thư viện | Phiên bản |
| ---------- | -------- | --------- |
| Backend | NestJS (`@nestjs/core`) | 12.1.2 |
| Backend | TypeScript | 6.0.3 |
| Frontend | Next.js | 16.3.8 |
| Frontend | React / React DOM | 19.2.8 |
| Frontend | TypeScript | 5.9.3 |
| Frontend | Tailwind CSS | 4.x |

Kiểm tra máy:

```bash
node -v      # ví dụ hợp lệ: v24.15.0, v22.22.3
npm -v
git --version
```

Cài / nâng cấp Node.js:
- Tải bản **24 LTS mới nhất** tại https://nodejs.org và cài đè bản cũ, **hoặc**
- Dùng trình quản lý phiên bản: [nvm-windows](https://github.com/coreybutler/nvm-windows) (Windows) / [nvm](https://github.com/nvm-sh/nvm) (macOS, Linux):
  ```bash
  nvm install 24
  nvm use 24
  ```

---

## 3. Cấu trúc thư mục

```
Maycha/
├── backend/                 # API server – NestJS (TypeScript)
│   ├── src/
│   │   ├── main.ts          # Điểm khởi động, nạp .env, CORS, PORT (mặc định 3001)
│   │   ├── app.module.ts    # Module gốc
│   │   ├── app.controller.ts# Route GET /
│   │   ├── products/        # GET /products, GET /products/:id
│   │   ├── orders/          # GET /orders/me, GET /orders/:id (Task 9)
│   │   ├── dev/             # POST /dev/demo-session – chỉ để demo (ENABLE_DEMO_SEED)
│   │   └── common/auth/     # JwtAuthGuard, @CurrentUser, ký/xác thực JWT HS256
│   ├── test/                # Test end-to-end
│   ├── Dockerfile
│   ├── .env.example         # Mẫu biến môi trường (được commit)
│   └── package.json
├── frontend/                # Giao diện – Next.js (App Router) + Tailwind CSS
│   ├── app/
│   │   ├── layout.tsx       # Layout chung
│   │   ├── page.tsx         # Trang chủ "/"
│   │   └── orders/
│   │       ├── layout.tsx   # Khung chung trang Đơn hàng
│   │       ├── page.tsx     # /orders – Lịch sử đơn (Task 9)
│   │       └── [id]/page.tsx# /orders/:id – Màn hình xác nhận (Task 9)
│   ├── lib/                 # api.ts (gọi backend), auth.ts (lưu JWT), format.ts
│   ├── components/          # StatusBadge, thẻ loading / lỗi / cần đăng nhập
│   ├── .env.example
│   ├── public/              # Ảnh, icon tĩnh
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # db + backend + frontend
├── .env.example             # Biến cho docker-compose (tùy chọn)
└── README.md
```

Backend và frontend là **hai dự án Node độc lập**: mỗi bên có `package.json`, `package-lock.json` và `node_modules` riêng. **Không chạy `npm install` ở thư mục gốc.**

| Thành phần | Cổng | Địa chỉ |
| ---------- | ---- | ------- |
| Frontend | `3000` | http://localhost:3000 |
| Backend | `3001` | http://localhost:3001 |

---

## 4. Cài đặt & chạy chi tiết

### 4.1. Lấy code về

```bash
git clone https://github.com/Bao3Q/Maycha.git
cd Maycha
```

### 4.2. Backend

1. **Vào thư mục:** `cd backend`
2. **Tạo `.env` từ file mẫu** (chỉ lần đầu):

   | Shell | Lệnh |
   | ----- | ---- |
   | PowerShell | `Copy-Item .env.example .env` |
   | CMD | `copy .env.example .env` |
   | macOS / Linux / Git Bash | `cp .env.example .env` |

3. **Cài thư viện:** `npm install`
   Thành công khi dòng cuối có `added N packages` hoặc `up to date, audited N packages`. Các dòng `npm warn` **không** phải lỗi.
4. **Chạy chế độ phát triển** (tự khởi động lại khi sửa code):

   | Shell | Lệnh |
   | ----- | ---- |
   | PowerShell | `$env:PORT=3001; npm run start:dev` |
   | CMD | `set "PORT=3001" && npm run start:dev` |
   | macOS / Linux / Git Bash | `PORT=3001 npm run start:dev` |

   > Ở CMD phải có dấu ngoặc kép `"PORT=3001"`. Nếu viết `set PORT=3001 && ...`, CMD sẽ gán cả dấu cách thừa vào giá trị.

5. **Kiểm tra:** terminal in `Nest application successfully started` → mở http://localhost:3001 → thấy `Hello World!`.

### 4.3. Frontend

1. **Vào thư mục:** `cd frontend`
2. **Cài thư viện:** `npm install`
3. **Chạy chế độ phát triển:** `npm run dev`
4. **Kiểm tra:** terminal in `Ready` và `Local: http://localhost:3000` → mở địa chỉ đó.
   Sửa `frontend/app/page.tsx` và lưu, trang tự cập nhật.

> Nếu cổng 3000 đang bận, Next.js sẽ **tự nhảy sang cổng khác** (3001, 3002…). Luôn đọc địa chỉ thực tế in ra trong terminal.

### 4.4. Những lần chạy sau

Không cần cài lại, chỉ cần:

| Shell | Terminal 1 (Backend) | Terminal 2 (Frontend) |
| ----- | -------------------- | --------------------- |
| PowerShell | `cd backend; $env:PORT=3001; npm run start:dev` | `cd frontend; npm run dev` |
| macOS / Linux / Git Bash | `cd backend && PORT=3001 npm run start:dev` | `cd frontend && npm run dev` |

Chạy lại `npm install` khi: vừa `git pull` và `package.json` / `package-lock.json` có thay đổi.

---

## 5. Biến môi trường

File: `backend/.env` (tạo từ `backend/.env.example`).

| Biến | Giá trị mẫu | Đang được dùng? | Ý nghĩa |
| ---- | ----------- | --------------- | ------- |
| `PORT` | `3001` | ✅ | Cổng backend, mặc định `3001` |
| `DATABASE_URL` | `postgresql://maycha:maycha_password@localhost:5432/maycha_db?schema=public` | ❌ Chưa | Chuỗi kết nối PostgreSQL cho Prisma. Khớp với service `db` trong Docker Compose |
| `JWT_SECRET` | `super_secret_key_123` | ✅ | Khóa ký/xác thực JWT (HS256). `POST /auth/login` (Task 7) **phải ký bằng cùng khóa này** |
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | ✅ | Danh sách origin frontend được gọi API, cách nhau bằng dấu phẩy |
| `ENABLE_DEMO_SEED` | `true` | ✅ | Bật `POST /dev/demo-session` (token + đơn mẫu cho tài khoản demo). **Đặt `false` khi Task 6/7/8 đã ghép xong** |

File: `frontend/.env.local` (tạo từ `frontend/.env.example`, chỉ cần khi chạy `npm run dev`):

| Biến | Giá trị mẫu | Ý nghĩa |
| ---- | ----------- | ------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Địa chỉ backend mà trình duyệt gọi tới |
| `NEXT_PUBLIC_ENABLE_DEMO` | `true` | Hiện nút **"Dùng tài khoản demo"** ở trang Đơn hàng khi chưa đăng nhập |

> Biến `NEXT_PUBLIC_*` được nhúng vào code lúc build/khởi động `next dev` – sửa xong phải chạy lại.

Quy tắc:
- **Không commit file `.env`** (đã có trong `.gitignore`). Chỉ commit `.env.example`.
- Thêm biến mới → **bắt buộc thêm vào `.env.example`** (giá trị giả) và vào bảng trên.
- Không đặt mật khẩu / khóa thật vào `.env.example`.

---

## 6. Kiểm tra sau khi cài

Trước khi báo "chạy được", tự kiểm tra đủ các mục:

- [ ] `node -v` ≥ `v24.15.0` (hoặc ≥ `v22.22.3`)
- [ ] `npm install` ở `backend/` kết thúc bằng `added …` hoặc `up to date …`
- [ ] `npm install` ở `frontend/` kết thúc bằng `added …` hoặc `up to date …`
- [ ] http://localhost:3001 hiển thị `Hello World!`
- [ ] http://localhost:3001/orders/me trả `401` khi chưa đăng nhập
- [ ] http://localhost:3000 hiển thị trang web
- [ ] http://localhost:3000/orders hiển thị trang Lịch sử đơn (chưa đăng nhập → thẻ "Cần đăng nhập")
- [ ] `git status` **không** hiện `.env` hay `node_modules/`

---

## 7. Danh sách lệnh npm

### Backend (`backend/`)

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run start:dev` | Chạy dev, tự reload khi sửa code |
| `npm run start` | Chạy một lần, không reload |
| `npm run start:debug` | Chạy dev kèm debugger |
| `npm run build` | Biên dịch ra `dist/` |
| `npm run start:prod` | Chạy `dist/main.js` (phải `build` trước) |
| `npm test` | Unit test (Jest) |
| `npm run test:watch` | Unit test, chạy lại khi sửa |
| `npm run test:cov` | Unit test + đo coverage |
| `npm run test:e2e` | Test end-to-end |
| `npm run lint` | Kiểm tra code (oxlint) |
| `npm run format` | Định dạng code (Prettier) |

### Frontend (`frontend/`)

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run dev` | Chạy dev, tự reload khi sửa code |
| `npm run build` | Build production |
| `npm start` | Chạy bản đã build (phải `build` trước) |
| `npm run lint` | Kiểm tra code (ESLint) |

---

## 8. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| ----------- | ----------- | ---------- |
| `nest: not found` / `'next' is not recognized…` | Chưa `npm install` hoặc đứng sai thư mục | `cd` vào đúng `backend/` hoặc `frontend/` rồi `npm install` |
| `npm warn EBADENGINE Unsupported engine … current: { node: 'v24.14.0' }` | Node thấp hơn yêu cầu | Nếu cuối vẫn có `added` / `up to date` thì **cài đã xong**, chạy tiếp được. Nên nâng Node lên ≥ 24.15, xóa `node_modules` rồi `npm install` lại |
| `EADDRINUSE: address already in use :::3000` | Cổng bị chiếm (thường do backend chạy thiếu `PORT=3001`, hoặc server cũ chưa tắt) | `Ctrl + C` ở terminal cũ. Hoặc tìm và tắt tiến trình: Windows `netstat -ano \| findstr :3000` → `taskkill /PID <PID> /F`; macOS/Linux `lsof -i :3000` → `kill <PID>` |
| Backend vẫn ở cổng 3000 dù `.env` có `PORT=3001` | Backend chưa đọc `.env` | Đặt `PORT` ngay trong lệnh chạy (xem [4.2](#42-backend)) |
| `found N vulnerabilities … npm audit fix --force` | Cảnh báo bảo mật ở thư viện phát triển | **Không chạy `npm audit fix --force`**: lệnh này đổi phiên bản thư viện tùy ý, làm hỏng dự án chung |
| PowerShell: `running scripts is disabled on this system` | Chính sách chặn script | Chạy một lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Sau `git pull` báo `Cannot find module …` | Người khác đã thêm thư viện | `npm install` lại trong thư mục tương ứng |
| `npm install` rất chậm / lỗi `EPERM` trên Windows | Repo nằm trong thư mục **OneDrive** đang đồng bộ `node_modules` | Nên clone repo ra ngoài OneDrive, ví dụ `C:\Projects\Maycha` |

---

## 9. Quy tắc làm việc nhóm

### 9.1. Nhánh (branch)

- **Không push thẳng lên `main`.** Mọi thay đổi đi qua Pull Request (PR).
- Đặt tên nhánh theo loại việc:

  | Tiền tố | Dùng cho | Ví dụ |
  | ------- | -------- | ----- |
  | `feature/` | Chức năng mới | `feature/menu-api` |
  | `fix/` | Sửa lỗi | `fix/cart-total` |
  | `docs/` | Tài liệu | `docs/readme` |
  | `chore/` | Cấu hình, thư viện | `chore/add-prisma` |

### 9.2. Quy trình

```bash
# 1. Lấy code mới nhất
git checkout main
git pull origin main

# 2. Tạo nhánh cho task
git checkout -b feature/ten-task

# 3. Code, rồi commit
git add <các file đã sửa>
git commit -m "feat(backend): thêm API danh sách menu"

# 4. Đẩy lên GitHub
git push -u origin feature/ten-task
```

Sau đó mở PR vào `main` trên GitHub, cần **ít nhất 1 thành viên khác duyệt** trước khi merge.

### 9.3. Commit message

Theo dạng `<loại>(<phạm vi>): <mô tả ngắn>`. Ví dụ:
- `feat(frontend): trang giỏ hàng`
- `fix(backend): sai tổng tiền khi có topping`
- `docs: cập nhật hướng dẫn chạy`

Loại hợp lệ: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

### 9.4. Checklist trước khi tạo PR

- [ ] Đã `git pull origin main` và xử lý xung đột (nếu có)
- [ ] Backend và frontend đều chạy được theo [mục 🚀](#-chạy-web-nhanh)
- [ ] `npm run lint` không lỗi (ở thư mục đã sửa)
- [ ] `npm test` qua (nếu sửa backend)
- [ ] Không commit `.env`, `node_modules/`, `dist/`, `.next/`
- [ ] `package-lock.json` chỉ thay đổi khi **có cài / gỡ thư viện**
- [ ] Đã cập nhật README nếu thay đổi cách cài, cách chạy, biến môi trường hoặc [trạng thái dự án](#1-trạng-thái-hiện-tại-của-dự-án)

### 9.5. Thêm thư viện

```bash
cd backend            # hoặc frontend
npm install <tên-gói>             # thư viện chạy
npm install -D <tên-gói>          # thư viện chỉ dùng khi phát triển
```

Commit **cả** `package.json` **và** `package-lock.json` trong cùng một commit, và ghi rõ trong PR để cả nhóm biết cần `npm install` lại.

---

## 10. Docker Compose & bàn giao

File `docker-compose.yml` ở thư mục gốc dựng 3 service:

| Service | Image / build | Cổng | Phụ thuộc |
| ------- | ------------- | ---- | --------- |
| `db` | `postgres:16-alpine`, volume `db_data` | `5432` | – (có healthcheck `pg_isready`) |
| `backend` | `backend/Dockerfile` (multi-stage, chạy `node dist/main` bằng user `node`) | `3001` | chờ `db` healthy |
| `frontend` | `frontend/Dockerfile` (`next build` → `next start`) | `3000` | `backend` |

Biến cấu hình (đặt trong `.env` ở thư mục gốc, xem `.env.example`):

| Biến | Mặc định | Dùng cho |
| ---- | -------- | -------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `maycha` / `maycha_password` / `maycha_db` | `db`, và ghép thành `DATABASE_URL` cho `backend` |
| `JWT_SECRET` | `change_me_in_production` | `backend` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | `frontend` – nhúng lúc **build**, đổi giá trị thì phải `docker compose up --build` |
| `ENABLE_DEMO_SEED` | `true` | `backend` (bật `POST /dev/demo-session`) và `frontend` (nút demo, nhúng lúc build) |

> Frontend gọi API bằng `process.env.NEXT_PUBLIC_API_URL` (trình duyệt gọi thẳng `localhost:3001`, nên không dùng tên service `backend`).

### Kịch bản demo end-to-end (Sprint Review)

**A. Khi Task 6/7/8 đã ghép (luồng thật):**

1. `docker compose up --build`, mở http://localhost:3000.
2. Menu → chọn sản phẩm (size, topping) → thêm vào giỏ.
3. Đăng nhập → thanh toán bằng Ví / Thẻ (`POST /payments`).
4. Frontend chuyển tới **`/orders/<id>`** → màn hình xác nhận gọi `GET /orders/:id`, hiển thị **mã đơn** (`#1042`) và **trạng thái** (`PAID` xanh / `PAYMENT_FAILED` đỏ / `PENDING` tự cập nhật mỗi 3 giây).
5. Bấm **"Xem lịch sử đơn"** → `/orders` gọi `GET /orders/me` → đơn vừa đặt ở đầu danh sách.

**B. Khi chưa ghép (demo riêng Task 9, `ENABLE_DEMO_SEED=true`):**

1. `docker compose up --build`, mở http://localhost:3000/orders → thấy thẻ **"Cần đăng nhập"** (chứng minh API trả `401` khi thiếu token).
2. Bấm **"Dùng tài khoản demo"** → backend cấp JWT cho `demo-user` và tạo 3 đơn mẫu (`PAID`, `PAYMENT_FAILED`, `COMPLETED`).
3. Trang hiển thị lịch sử 3 đơn, mới nhất trước.
4. Bấm đơn `PAID` → màn hình xác nhận "Đặt hàng thành công!" với mã đơn, trạng thái, danh sách món, tổng tiền. Quay lại, bấm đơn `PAYMENT_FAILED` → "Thanh toán thất bại".
5. Mở http://localhost:3000/orders/1 → "Không tìm thấy đơn hàng" (đơn không tồn tại / không phải của mình → `404`).
6. `docker compose restart backend` → đơn mất (đang lưu bộ nhớ – giới hạn hiện tại, sẽ hết khi tích hợp Prisma).

Gọi bằng terminal (macOS / Linux / Git Bash):

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/dev/demo-session | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
curl -s http://localhost:3001/orders/me -H "Authorization: Bearer $TOKEN"
```

---

## 11. API đơn hàng – Lịch sử & Xác nhận (Task 9)

Cả hai endpoint đều cần header `Authorization: Bearer <JWT>`. Token ký **HS256** bằng `JWT_SECRET`, payload tối thiểu `{ "sub": <userId>, "email": "..." }` (đúng dạng mà `@nestjs/jwt` phát ra ở Task 7).

| Endpoint | Mô tả | Mã lỗi |
| -------- | ----- | ------ |
| `GET /orders/me` | Lịch sử đơn của user đang đăng nhập, **mới nhất trước** | `401` thiếu/sai token |
| `GET /orders/:id` | Chi tiết một đơn cho màn hình xác nhận | `400` id không phải số, `401`, `404` không tồn tại **hoặc không phải đơn của mình** |

Ví dụ phản hồi `GET /orders/1042`:

```json
{
  "id": 1042,
  "code": "#1042",
  "status": "PAID",
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

`status` là một trong: `PENDING`, `PAID`, `PAYMENT_FAILED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`. `GET /orders/me` trả một mảng các object cùng dạng.

### Giao diện (frontend)

| Trang | File | Gọi API | Hiển thị |
| ----- | ---- | ------- | -------- |
| `/orders/[id]` – Xác nhận | `frontend/app/orders/[id]/page.tsx` | `GET /orders/:id` | Tiêu đề theo trạng thái, **mã đơn**, **trạng thái**, món (size, topping, SL), tổng tiền, giờ đặt. Đơn `PENDING` tự hỏi lại mỗi 3 giây (tối đa 1 phút) |
| `/orders` – Lịch sử | `frontend/app/orders/page.tsx` | `GET /orders/me` | Danh sách đơn mới nhất trước, bấm để mở chi tiết; trạng thái rỗng có nút "Xem menu" |

Cả hai trang xử lý: đang tải, chưa đăng nhập / token hết hạn (`401` → xóa token, hiện thẻ đăng nhập), không tìm thấy (`404`/`400`), mất kết nối backend (nút "Thử lại").

### Endpoint demo (chỉ khi `ENABLE_DEMO_SEED=true`)

| Endpoint | Mô tả |
| -------- | ----- |
| `POST /dev/demo-session` | Trả `{ accessToken, user, orders }` cho tài khoản cố định `demo-user` (token hạn 8 giờ). Lần đầu tạo 3 đơn mẫu; gọi lại không tạo trùng. Không nhận `userId` từ client nên không giả mạo được user thật. Tắt cờ → `404` |

### Ghi chú tích hợp cho các task khác

- **Task 7 (Đăng nhập – frontend)**: sau khi `POST /auth/login` thành công, gọi `setToken(accessToken)` trong `frontend/lib/auth.ts` (lưu `localStorage["accessToken"]`). Trang đăng nhập nên ở `/login` (nút "Đăng nhập" trỏ tới đây).
- **Task 8 (Thanh toán – frontend)**: sau khi `POST /payments` trả kết quả (thành công **hoặc** thất bại), `router.push('/orders/' + orderId)` để vào màn hình xác nhận.
- **Task 6 (`POST /orders`)** / **Task 8 (`POST /payments`)**: import `OrdersModule`, inject `OrdersRepository` rồi dùng `nextId()`, `nextItemIdValue()` và `save(order)` để tạo / cập nhật đơn – đơn sẽ tự xuất hiện ở `/orders/me`.
- **Task 7 (Auth)**: ký JWT với `sub = user.id` bằng `JWT_SECRET`. Có thể dùng `JwtAuthGuard` và `@CurrentUser()` trong `src/common/auth/` để bảo vệ `POST /orders`.
- **Khi tích hợp Prisma**: chỉ cần thay thân các hàm trong `src/orders/orders.repository.ts`; service, controller và test e2e giữ nguyên.

### Test

```bash
cd backend
npm test                                   # unit test: orders.service, jwt-auth.guard, demo.controller
npm run test:e2e -- orders.e2e-spec.ts     # e2e: 401 / 200 / 404 / 400 cho /orders/me, /orders/:id và luồng demo-session
```

## 12. Nghiệp vụ đặt hàng & thanh toán (Task 10)

Các API nghiệp vụ cần JWT:

| Endpoint | Mô tả |
| -------- | ----- |
| `POST /orders` | Kiểm tra giỏ hàng và voucher, giữ tồn kho, tạo đơn `PENDING`; nếu thao tác lưu đơn lỗi thì tồn kho được rollback |
| `PATCH /orders/:id/status` | Chỉ cho phép các bước theo state machine; khi hủy đơn, cập nhật trạng thái và hoàn kho cùng một giao dịch bộ nhớ |
| `POST /payments` | Mock thanh toán `MOMO`/`VNPAY`; gửi `Idempotency-Key` (hoặc `X-Idempotency-Key`) để phát lại kết quả của cùng yêu cầu |
| `GET /payments/loyalty` | Trả số điểm loyalty của tài khoản |

State machine chính: `PENDING → PAID → PREPARING → READY → COMPLETED`. `PENDING` và `PAID` có thể chuyển sang `CANCELLED`; `PAYMENT_FAILED` có thể thanh toán lại thành `PAID` hoặc hủy. Trạng thái kết thúc không được chuyển tiếp.

Mỗi key idempotency được giới hạn theo user và nội dung yêu cầu. Dùng lại key với đơn/phương thức khác trả `409 Conflict`. Voucher hiện có: `MAYCHA10` giảm 10% và `BREWLITE20` giảm tối đa 20.000đ. Điểm được cộng sau thanh toán thành công, theo tỷ lệ 1 điểm / 10.000đ thực trả.

**Giới hạn triển khai hiện tại:** đơn hàng, tồn kho, kết quả idempotency và điểm thưởng đều là dữ liệu trong bộ nhớ. Kiểm tra version cùng rollback bảo đảm nhất quán trong một tiến trình NestJS; dữ liệu mất khi restart và không bảo vệ các instance độc lập. Muốn triển khai nhiều instance/production, cần chuyển các thao tác này sang transaction PostgreSQL (ví dụ conditional `UPDATE ... WHERE version = ?`, cùng ghi đơn, idempotency và loyalty trong transaction).

### Test Task 10

```powershell
cd backend
npm test -- --runInBand src/orders/task10.spec.ts
```
