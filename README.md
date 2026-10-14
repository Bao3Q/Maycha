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
12. [API đăng ký / đăng nhập – JWT (Task 7)](#12-api-đăng-ký--đăng-nhập--jwt-task-7)

---

## 1. Trạng thái hiện tại của dự án

| Hạng mục | Trạng thái |
| -------- | ---------- |
| Frontend – Menu, chi tiết, giỏ hàng, thanh toán | ✅ `/` – menu gọi `GET /products`; "Xác nhận trả" gọi `POST /orders` → `POST /payments` rồi chuyển sang `/orders/<id>` |
| Frontend – đăng nhập / đăng ký | ✅ `/login` – gọi `POST /auth/login`, `/auth/register`, lưu JWT, quay lại trang trước (`?next=`) |
| Frontend – xác nhận & lịch sử đơn (Task 9) | ✅ `/orders/[id]` (màn hình xác nhận), `/orders` (lịch sử) – gọi API thật kèm JWT |
| Backend (NestJS) | ✅ `GET /`, `GET /products`, `GET /products/:id` |
| Backend – đăng ký / đăng nhập (Task 7) | ✅ `POST /auth/register`, `POST /auth/login` (bcrypt + JWT) |
| Backend – tạo đơn (Task 6) & thanh toán mock (Task 8) | ✅ `POST /orders`, `POST /payments` (cần JWT) |
| Backend – lịch sử & xác nhận đơn (Task 9) | ✅ `GET /orders/me`, `GET /orders/:id` (cần JWT) |
| Validate đầu vào | ✅ `ValidationPipe` toàn cục (`src/app.setup.ts`) – dữ liệu sai trả `400` |
| Đọc file `.env` ở backend | ✅ `process.loadEnvFile()` trong `main.ts` |
| PostgreSQL / Prisma | ⚠️ Đã có container PostgreSQL trong Docker Compose; **backend chưa dùng DB** – user và đơn hàng đang lưu trong bộ nhớ (mất khi restart backend) |
| Docker Compose | ✅ `docker-compose.yml` chạy `db` + `backend` + `frontend` |
| Dữ liệu demo | ✅ `POST /dev/demo-session` – **mặc định tắt**, bật bằng `ENABLE_DEMO_SEED=true` |

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
│   │   ├── app.setup.ts     # ValidationPipe toàn cục (dùng chung cho main.ts và test e2e)
│   │   ├── app.module.ts    # Module gốc
│   │   ├── app.controller.ts# Route GET /
│   │   ├── products/        # GET /products, GET /products/:id
│   │   ├── auth/            # POST /auth/register, /auth/login (Task 7)
│   │   ├── orders/          # POST /orders (Task 6), GET /orders/me, GET /orders/:id (Task 9)
│   │   ├── payments/        # POST /payments – thanh toán mock (Task 8)
│   │   ├── dev/             # POST /dev/demo-session – chỉ để demo (ENABLE_DEMO_SEED)
│   │   └── common/auth/     # JwtAuthGuard, @CurrentUser, ký/xác thực JWT HS256
│   ├── test/                # Test end-to-end
│   ├── Dockerfile
│   ├── .env.example         # Mẫu biến môi trường (được commit)
│   └── package.json
├── frontend/                # Giao diện – Next.js (App Router) + Tailwind CSS
│   ├── app/
│   │   ├── layout.tsx       # Layout chung
│   │   ├── page.tsx         # "/" – Menu → chi tiết → giỏ hàng → thanh toán
│   │   ├── login/page.tsx   # /login – Đăng nhập / Đăng ký
│   │   └── orders/
│   │       ├── layout.tsx   # Khung chung trang Đơn hàng
│   │       ├── page.tsx     # /orders – Lịch sử đơn (Task 9)
│   │       └── [id]/page.tsx# /orders/:id – Màn hình xác nhận (Task 9)
│   ├── lib/                 # api.ts (gọi backend), auth.ts (lưu JWT), format.ts
│   ├── components/          # StatusBadge, AuthNav, thẻ loading / lỗi / cần đăng nhập
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
| `ENABLE_DEMO_SEED` | `false` | ✅ | `true` = bật `POST /dev/demo-session` (token + đơn mẫu cho tài khoản demo). Bản nộp để `false` |

File: `frontend/.env.local` (tạo từ `frontend/.env.example`, chỉ cần khi chạy `npm run dev`):

| Biến | Giá trị mẫu | Ý nghĩa |
| ---- | ----------- | ------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Địa chỉ backend mà trình duyệt gọi tới |
| `NEXT_PUBLIC_ENABLE_DEMO` | `false` | `true` = hiện nút **"Dùng tài khoản demo"** ở trang Đơn hàng khi chưa đăng nhập |

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
- [ ] http://localhost:3000/login đăng ký được tài khoản mới
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
| `ENABLE_DEMO_SEED` | `false` | `backend` (bật `POST /dev/demo-session`) và `frontend` (nút demo, nhúng lúc build) |

> Frontend gọi API bằng `process.env.NEXT_PUBLIC_API_URL` (trình duyệt gọi thẳng `localhost:3001`, nên không dùng tên service `backend`).

### Kịch bản demo end-to-end (Sprint Review)

**A. Luồng thật (dùng cho buổi Sprint Review):**

1. `docker compose up --build`, mở http://localhost:3000.
2. Menu → **Chọn món** → chọn size, topping → **Thêm vào giỏ** (badge "Xem giỏ hàng (n)" tăng).
3. Giỏ hàng: tăng/giảm/xóa món, tổng tiền tự tính → **Tiến hành thanh toán**.
4. Chưa đăng nhập → tự chuyển sang `/login` → bấm **Đăng ký**, nhập email + mật khẩu (≥ 8 ký tự) → tự đăng nhập và **quay lại đúng bước Thanh toán** (giỏ hàng vẫn giữ nguyên).
5. Chọn **Ví điện tử** hoặc **Thẻ ngân hàng** → **Xác nhận trả**. Frontend gọi `POST /orders` (đơn `PENDING`) rồi `POST /payments` (kèm `idempotencyKey`).
6. Tự chuyển tới **`/orders/<id>`** → màn hình xác nhận gọi `GET /orders/:id`: "Đặt hàng thành công!", **mã đơn** (`#1001`), **trạng thái `PAID`**, danh sách món, tổng tiền. Giỏ hàng được xóa.
7. Bấm **"Xem lịch sử đơn"** → `/orders` gọi `GET /orders/me` → đơn vừa đặt ở đầu danh sách.
8. Demo nhánh lỗi: đặt thêm một đơn, ở bước Thanh toán tích **"Giả lập thanh toán lỗi (demo)"** → màn hình "Thanh toán thất bại", trạng thái `PAYMENT_FAILED`, **giỏ hàng vẫn giữ nguyên** → bấm "Đặt lại" để thanh toán lại.
9. Đăng xuất (góc trên) → mở `/orders` → thẻ "Cần đăng nhập" (API trả `401` khi thiếu token).

> Giới hạn hiện tại: user và đơn hàng lưu trong bộ nhớ backend, `docker compose restart backend` sẽ mất dữ liệu (cần đăng ký lại).

**B. Tài khoản demo có sẵn đơn mẫu (tùy chọn):**

Tạo file `.env` ở thư mục gốc với `ENABLE_DEMO_SEED=true` rồi `docker compose up --build`. Ở trang `/orders` sẽ có nút **"Dùng tài khoản demo"** → backend cấp JWT cho `demo-user` và tạo 3 đơn mẫu (`PAID`, `PAYMENT_FAILED`, `COMPLETED`).

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

- **Đăng nhập (frontend)**: `/login` gọi `POST /auth/login`, rồi `setToken(accessToken)` trong `frontend/lib/auth.ts` (lưu `localStorage["accessToken"]`) và chuyển về `?next=`.
- **Thanh toán (frontend)**: `confirmPayment` trong `frontend/app/page.tsx` gọi `POST /orders` → `POST /payments` → `router.push('/orders/' + orderId)` cho cả trường hợp thành công lẫn thất bại. Thanh toán lỗi rồi thử lại với giỏ không đổi sẽ dùng lại đơn cũ (không tạo đơn trùng).
- **Backend**: `OrdersService.createOrder` và `PaymentsService` dùng chung `OrdersRepository` (`save(order)`), nên đơn tạo ra tự xuất hiện ở `/orders/me`.
- **Khi tích hợp Prisma**: chỉ cần thay thân các hàm trong `src/orders/orders.repository.ts`; service, controller và test e2e giữ nguyên.

### API thanh toán (Task 8)

| Endpoint | Body | Kết quả |
| -------- | ---- | ------- |
| `POST /payments` (cần JWT) | `{ "orderId": 1001, "method": "WALLET" \| "CARD" \| "FAIL", "idempotencyKey": "..." }` | `201` `{ success, orderId, status }` – `WALLET`/`CARD` → `PAID`; `FAIL` (giả lập cổng lỗi) → `PAYMENT_FAILED`. `400` sai dữ liệu / sai trạng thái, `404` không có đơn |

### Test

```bash
cd backend
npm test                                     # unit test: orders.service, jwt-auth.guard, demo.controller, auth.service
npm run test:e2e -- orders.e2e-spec.ts       # e2e: 401 / 200 / 404 / 400 cho /orders/me, /orders/:id và luồng demo-session
npm run test:e2e -- checkout.e2e-spec.ts     # e2e end-to-end: đăng ký → đăng nhập → POST /orders → POST /payments → xác nhận → lịch sử
```

---

## 12. API đăng ký / đăng nhập – JWT (Task 7)

Mã nguồn: `backend/src/auth/`. Mật khẩu băm bằng **bcrypt** (mặc định cost 10, đổi bằng `BCRYPT_ROUNDS` 4–15). JWT ký **HS256** bằng `JWT_SECRET`, sống **1 giờ**, payload `{ "sub": "<userId>", "email": "..." }`. Cần có `JWT_SECRET` trong `backend/.env` (`cp .env.example .env`) – backend tự đọc file này khi chạy local.

| Endpoint | Body | Thành công | Lỗi |
| -------- | ---- | ---------- | --- |
| `POST /auth/register` | `{ "email", "password" }` (mật khẩu 8–72 ký tự) | `201` `{ id, email, loyaltyPoints }` | `400` dữ liệu sai, `409` email đã đăng ký |
| `POST /auth/login` | `{ "email", "password" }` | `200` `{ accessToken, tokenType: "Bearer", expiresIn, user }` | `400` dữ liệu sai, `401` sai email/mật khẩu (cùng một thông báo) |

Email được chuẩn hóa (cắt khoảng trắng, chữ thường). Phản hồi không bao giờ chứa mật khẩu hay hash.

```bash
curl -X POST localhost:3001/auth/register -H 'content-type: application/json' \
  -d '{"email":"kh@maycha.vn","password":"matkhau123"}'
curl -X POST localhost:3001/auth/login -H 'content-type: application/json' \
  -d '{"email":"kh@maycha.vn","password":"matkhau123"}'
# dùng accessToken: -H 'Authorization: Bearer <accessToken>'
curl localhost:3001/orders/me -H 'Authorization: Bearer <accessToken>'
```

**Guard bảo vệ route đặt đơn:** `JwtAuthGuard` (`src/common/auth/jwt-auth.guard.ts`) trả `401` khi thiếu / sai chữ ký / hết hạn token. Tài khoản đang lưu **trong bộ nhớ** (mất khi restart) giống đơn hàng; khi có Prisma chỉ cần thay thân `src/auth/users.repository.ts`.

```bash
cd backend
npm test                                  # unit: auth.service (bcrypt, JWT, 409, 401)
npm run test:e2e -- auth.e2e-spec.ts      # e2e: register/login + guard 401/200
```
