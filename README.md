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
cd apps/api
Copy-Item .env.example .env        # chỉ lần đầu
npm install                        # lần đầu, hoặc khi package.json thay đổi
$env:PORT=3001; npm run start:dev
```

```powershell
# ── Terminal 2: Frontend ─────────────────────────────
cd apps/web
npm install                        # lần đầu, hoặc khi package.json thay đổi
npm run dev
```

### 🍎 macOS / Linux / Git Bash

```bash
# ── Terminal 1: Backend ──────────────────────────────
cd apps/api
cp .env.example .env               # chỉ lần đầu
npm install                        # lần đầu, hoặc khi package.json thay đổi
PORT=3001 npm run start:dev
```

```bash
# ── Terminal 2: Frontend ─────────────────────────────
cd apps/web
npm install                        # lần đầu, hoặc khi package.json thay đổi
npm run dev
```

### 🌐 Mở trên trình duyệt

| Thành phần | Địa chỉ | Dấu hiệu chạy đúng |
| ---------- | ------- | ------------------ |
| **Frontend** (giao diện) | **http://localhost:3000** | Trang web hiển thị |
| **Backend** (API) | **http://localhost:3001** | Trả về chữ `Hello World!` |

Dừng server: `Ctrl + C` trong terminal tương ứng.

> ℹ️ Backend tự đọc `apps/api/.env` khi khởi động (dùng `process.loadEnvFile()` có sẵn trong Node, không cần thư viện). Nếu chưa có `.env`, backend mặc định chạy cổng **3001**. Các API cần đăng nhập (vd. `/orders/me`) yêu cầu `JWT_SECRET` – đã có sẵn trong `.env.example`.

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
13. [Nghiệp vụ đặt hàng & thanh toán (Task 10)](#13-nghiệp-vụ-đặt-hàng--thanh-toán-task-10)

---

## 1. Trạng thái hiện tại của dự án

| Hạng mục | Trạng thái |
| -------- | ---------- |
| Frontend – Menu, chi tiết, giỏ hàng, thanh toán | ✅ `/` – menu gọi `GET /products`; "Xác nhận trả" gọi `POST /orders` → `POST /payments` rồi chuyển sang `/orders/<id>` |
| Frontend – đăng nhập / đăng ký | ✅ `/login` – gọi `POST /auth/login`, `/auth/register`, lưu JWT, quay lại trang trước (`?next=`) |
| Frontend – xác nhận & lịch sử đơn (Task 9) | ✅ `/orders/[id]` (màn hình xác nhận), `/orders` (lịch sử) – gọi API thật kèm JWT |
| Backend (NestJS) | ✅ `GET /`, `GET /health`, `GET /products`, `GET /products/:id` |
| Backend – đăng ký / đăng nhập (Task 7) | ✅ `POST /auth/register`, `POST /auth/login` (bcrypt + JWT); role `CUSTOMER` / `ADMIN` |
| Backend – tạo đơn (Task 6) & thanh toán mock (Task 8) | ✅ `POST /orders`, `POST /payments` (cần JWT) |
| Backend – lịch sử & xác nhận đơn (Task 9) | ✅ `GET /orders/me`, `GET /orders/:id` (cần JWT) |
| Backend – nghiệp vụ đặt hàng & thanh toán (Task 10) | ✅ State machine, idempotency, tồn kho, voucher và loyalty; ghi dữ liệu qua Prisma/PostgreSQL, các thay đổi đơn và tồn kho dùng transaction |
| Validate đầu vào | ✅ `ValidationPipe` toàn cục (`src/app.setup.ts`) – dữ liệu sai trả `400` |
| Đọc file `.env` ở backend | ✅ `process.loadEnvFile()` trong `main.ts` |
| PostgreSQL / Prisma | ✅ Backend lưu tài khoản, menu/tồn kho, đơn hàng, thanh toán, idempotency và điểm loyalty trong PostgreSQL; migrations tự áp dụng khi backend Docker khởi động |
| Docker Compose | ✅ `docker-compose.yml` dựng `apps/api` + `apps/web` + PostgreSQL |
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

## 3. Cấu trúc thư mục theo assignment

```
brewlite/
├── apps/
│   ├── web/                         # Next.js frontend
│   └── api/                         # NestJS API và Prisma
├── docs/
│   ├── requirements/                # Assignment PDFs
│   ├── diagrams/                    # Architecture diagrams
│   ├── architecture/                # Database architecture and legacy notes
│   ├── traceability-matrix.md
│   └── deployment.md
├── tests/
│   └── api/                         # NestJS end-to-end tests
├── .github/
│   └── workflows/                   # CI
├── docker-compose.yml
├── .env.example
└── README.md
```

Backend và frontend là hai dự án Node độc lập; chạy `npm install` trong `apps/api/` và `apps/web/` tương ứng, không chạy ở thư mục gốc. E2E tests được đặt trong `tests/api/`.

| Thành phần | Cổng | Địa chỉ |
| ---------- | ---- | ------- |
| Frontend | `3000` | http://localhost:3000 |
| Backend | `3001` | http://localhost:3001 |

CI workflow: `.github/workflows/ci.yml`. Hướng dẫn triển khai: [`docs/deployment.md`](docs/deployment.md); sơ đồ kiến trúc: [`docs/diagrams/system-architecture.md`](docs/diagrams/system-architecture.md).

---

## 4. Cài đặt & chạy chi tiết

### 4.1. Lấy code về

```bash
git clone https://github.com/Bao3Q/Maycha.git
cd Maycha
```

### 4.2. Backend

**PostgreSQL phải chạy trước backend.** Nếu dùng Docker cho database nhưng chạy NestJS trực tiếp, chạy từ thư mục gốc repo:

```powershell
docker compose up -d db
```

1. **Vào thư mục:** `cd apps/api`
2. **Tạo `.env` từ file mẫu** (chỉ lần đầu):

   | Shell | Lệnh |
   | ----- | ---- |
   | PowerShell | `Copy-Item .env.example .env` |
   | CMD | `copy .env.example .env` |
   | macOS / Linux / Git Bash | `cp .env.example .env` |

3. **Cài thư viện:** `npm install`
   Thành công khi dòng cuối có `added N packages` hoặc `up to date, audited N packages`. Các dòng `npm warn` **không** phải lỗi.
4. **Sinh Prisma Client và áp dụng migration:** `npm run prisma:generate`, sau đó `npm run prisma:deploy`.
5. **Chạy chế độ phát triển** (tự khởi động lại khi sửa code):

   | Shell | Lệnh |
   | ----- | ---- |
   | PowerShell | `$env:PORT=3001; npm run start:dev` |
   | CMD | `set "PORT=3001" && npm run start:dev` |
   | macOS / Linux / Git Bash | `PORT=3001 npm run start:dev` |

   > Ở CMD phải có dấu ngoặc kép `"PORT=3001"`. Nếu viết `set PORT=3001 && ...`, CMD sẽ gán cả dấu cách thừa vào giá trị.

6. **Kiểm tra:** terminal in `Nest application successfully started` → mở http://localhost:3001 → thấy `Hello World!`.

### 4.3. Frontend

1. **Vào thư mục:** `cd apps/web`
2. **Cài thư viện:** `npm install`
3. **Chạy chế độ phát triển:** `npm run dev`
4. **Kiểm tra:** terminal in `Ready` và `Local: http://localhost:3000` → mở địa chỉ đó.
   Sửa `apps/web/app/page.tsx` và lưu, trang tự cập nhật.

> Nếu cổng 3000 đang bận, Next.js sẽ **tự nhảy sang cổng khác** (3001, 3002…). Luôn đọc địa chỉ thực tế in ra trong terminal.

### 4.4. Những lần chạy sau

Không cần cài lại, chỉ cần:

| Shell | Terminal 1 (Backend) | Terminal 2 (Frontend) |
| ----- | -------------------- | --------------------- |
| PowerShell | `cd apps/api; $env:PORT=3001; npm run start:dev` | `cd apps/web; npm run dev` |
| macOS / Linux / Git Bash | `cd apps/api && PORT=3001 npm run start:dev` | `cd apps/web && npm run dev` |

Chạy lại `npm install` khi: vừa `git pull` và `package.json` / `package-lock.json` có thay đổi.

---

## 5. Biến môi trường

File: `apps/api/.env` (tạo từ `apps/api/.env.example`).

| Biến | Giá trị mẫu | Đang được dùng? | Ý nghĩa |
| ---- | ----------- | --------------- | ------- |
| `PORT` | `3001` | ✅ | Cổng backend, mặc định `3001` |
| `DATABASE_URL` | Chuỗi PostgreSQL trong `.env.example` | ✅ | Kết nối backend và Prisma tới PostgreSQL; database phải sẵn sàng trước khi khởi động API |
| `JWT_SECRET` | `super_secret_key_123` | ✅ | Khóa ký/xác thực JWT (HS256). `POST /auth/login` (Task 7) **phải ký bằng cùng khóa này** |
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | ✅ | Danh sách origin frontend được gọi API, cách nhau bằng dấu phẩy |
| `ENABLE_DEMO_SEED` | `false` | ✅ | `true` = bật `POST /dev/demo-session` (token + đơn mẫu cho tài khoản demo). Bản nộp để `false` |

File: `apps/web/.env.local` (tạo từ `apps/web/.env.example`, chỉ cần khi chạy `npm run dev`):

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
- [ ] `npm install` ở `apps/api/` kết thúc bằng `added …` hoặc `up to date …`
- [ ] `npm install` ở `apps/web/` kết thúc bằng `added …` hoặc `up to date …`
- [ ] http://localhost:3001 hiển thị `Hello World!`
- [ ] http://localhost:3001/orders/me trả `401` khi chưa đăng nhập
- [ ] http://localhost:3000 hiển thị trang web
- [ ] http://localhost:3000/orders hiển thị trang Lịch sử đơn (chưa đăng nhập → thẻ "Cần đăng nhập")
- [ ] http://localhost:3000/login đăng ký được tài khoản mới
- [ ] `git status` **không** hiện `.env` hay `node_modules/`

---

## 7. Danh sách lệnh npm

### Backend (`apps/api/`)

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
| `npm run prisma:generate` | Sinh Prisma Client từ `prisma/schema.prisma` |
| `npm run prisma:migrate` | Áp dụng migration còn thiếu; thêm `-- --name <tên>` khi tạo migration mới |
| `npm run prisma:deploy` | Áp dụng các migration đã commit (phù hợp môi trường chạy) |
| `npm run prisma:studio` | Mở Prisma Studio để xem dữ liệu |

Prisma schema, migrations và `DATABASE_URL` được khai báo trong `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` và `apps/api/prisma.config.ts`. Khi chạy local, khởi động PostgreSQL trước rồi chạy `npm run prisma:deploy` trong `apps/api/`; khi cần tạo migration mới dùng `npm run prisma:migrate -- --name <tên>`. Prisma Client được sinh vào `node_modules/@prisma/client` trong bước generate/build.

### Frontend (`apps/web/`)

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
| `nest: not found` / `'next' is not recognized…` | Chưa `npm install` hoặc đứng sai thư mục | `cd` vào đúng `apps/api/` hoặc `apps/web/` rồi `npm install` |
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
cd apps/api           # hoặc apps/web
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
| `backend` | `apps/api/Dockerfile` (multi-stage, chạy migration rồi NestJS bằng user `node`) | `3001` | chờ `db` healthy |
| `frontend` | `apps/web/Dockerfile` (`next build` → `next start`) | `3000` | `backend` |

Kiểm tra API đang hoạt động: `Invoke-RestMethod http://localhost:3001/health` phải trả về `status: ok`. Endpoint này xác nhận tiến trình API đang phản hồi; không kiểm tra kết nối PostgreSQL.

Biến cấu hình (đặt trong `.env` ở thư mục gốc, xem `.env.example`):

| Biến | Mặc định | Dùng cho |
| ---- | -------- | -------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `maycha` / `maycha_password` / `maycha_db` | `db`, và ghép thành `DATABASE_URL` cho `backend` |
| `JWT_SECRET` | `change_me_in_production` | `backend` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | `frontend` – nhúng lúc **build**, đổi giá trị thì phải `docker compose up --build` |
| `ENABLE_DEMO_SEED` | `false` | `backend` (bật `POST /dev/demo-session`) và `frontend` (nút demo, nhúng lúc build) |

> Backend tự chạy `prisma migrate deploy` trước khi khởi động API. Frontend gọi API bằng `process.env.NEXT_PUBLIC_API_URL` (trình duyệt gọi thẳng `localhost:3001`, nên không dùng tên service `backend`).

### Kịch bản demo end-to-end (Sprint Review)

**A. Luồng thật (dùng cho buổi Sprint Review):**

1. `docker compose up --build`, mở http://localhost:3000.
2. Menu → **Chọn món** → chọn size, topping → **Thêm vào giỏ** (badge "Xem giỏ hàng (n)" tăng).
3. Giỏ hàng: tăng/giảm/xóa món, tổng tiền tự tính → **Tiến hành thanh toán**.
4. Chưa đăng nhập → tự chuyển sang `/login` → bấm **Đăng ký**, nhập email + mật khẩu (≥ 8 ký tự) → tự đăng nhập và **quay lại đúng bước Thanh toán** (giỏ hàng vẫn giữ nguyên).
5. Chọn **Ví điện tử** hoặc **Thẻ ngân hàng** → **Xác nhận trả**. Frontend gọi `POST /orders` (đơn `PENDING`) rồi `POST /payments` (kèm `idempotencyKey`).
6. Tự chuyển tới **`/orders/<id>`** → màn hình xác nhận gọi `GET /orders/:id`: "Đặt hàng thành công!", mã đơn, **trạng thái `PAID`**, danh sách món, tổng tiền. Giỏ hàng được xóa.
7. Bấm **"Xem lịch sử đơn"** → `/orders` gọi `GET /orders/me` → đơn vừa đặt ở đầu danh sách.
8. Demo nhánh lỗi: đặt thêm một đơn, ở bước Thanh toán tích **"Giả lập thanh toán lỗi (demo)"** → màn hình "Thanh toán thất bại", trạng thái `PAYMENT_FAILED`, **giỏ hàng vẫn giữ nguyên** → bấm "Đặt lại" để thanh toán lại.
9. Đăng xuất (góc trên) → mở `/orders` → thẻ "Cần đăng nhập" (API trả `401` khi thiếu token).

> Tài khoản, đơn, thanh toán, tồn kho và loyalty được lưu trong PostgreSQL volume `db_data`; restart backend không xóa dữ liệu. Không dùng `docker compose down -v` nếu cần giữ database.

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
| `/orders/[id]` – Xác nhận | `apps/web/app/orders/[id]/page.tsx` | `GET /orders/:id` | Tiêu đề theo trạng thái, **mã đơn**, **trạng thái**, món (size, topping, SL), tổng tiền, giờ đặt. Đơn `PENDING` tự hỏi lại mỗi 3 giây (tối đa 1 phút) |
| `/orders` – Lịch sử | `apps/web/app/orders/page.tsx` | `GET /orders/me` | Danh sách đơn mới nhất trước, bấm để mở chi tiết; trạng thái rỗng có nút "Xem menu" |

Cả hai trang xử lý: đang tải, chưa đăng nhập / token hết hạn (`401` → xóa token, hiện thẻ đăng nhập), không tìm thấy (`404`/`400`), mất kết nối backend (nút "Thử lại").

### Endpoint demo (chỉ khi `ENABLE_DEMO_SEED=true`)

| Endpoint | Mô tả |
| -------- | ----- |
| `POST /dev/demo-session` | Trả `{ accessToken, user, orders }` cho tài khoản cố định `demo-user` (token hạn 8 giờ). Lần đầu tạo 3 đơn mẫu; gọi lại không tạo trùng. Không nhận `userId` từ client nên không giả mạo được user thật. Tắt cờ → `404` |

### Ghi chú tích hợp cho các task khác

- **Đăng nhập (frontend)**: `/login` gọi `POST /auth/login`, rồi `setToken(accessToken)` trong `apps/web/lib/auth.ts` (lưu `localStorage["accessToken"]`) và chuyển về `?next=`.
- **Thanh toán (frontend)**: `confirmPayment` trong `apps/web/app/page.tsx` gọi `POST /orders` → `POST /payments` → `router.push('/orders/' + orderId)` cho cả trường hợp thành công lẫn thất bại. Thanh toán lỗi rồi thử lại với giỏ không đổi sẽ dùng lại đơn cũ (không tạo đơn trùng).
- **Backend**: `OrdersService.createOrder` và `PaymentsService` dùng chung `OrdersRepository` (`save(order)`), nên đơn tạo ra tự xuất hiện ở `/orders/me`.
- **Persistence**: repository lưu dữ liệu nghiệp vụ qua Prisma/PostgreSQL; schema hiện hành và migrations nằm trong `apps/api/prisma/`.

### API thanh toán (Task 8)

| Endpoint | Body | Kết quả |
| -------- | ---- | ------- |
| `POST /payments` (cần JWT) | `{ "orderId": 1001, "method": "WALLET" \| "CARD" \| "FAIL", "idempotencyKey": "..." }` | `201` `{ success, orderId, status }` – `WALLET`/`CARD` → `PAID`; `FAIL` (giả lập cổng lỗi) → `PAYMENT_FAILED`. `400` sai dữ liệu / sai trạng thái, `404` không có đơn |

### Test

```bash
cd apps/api
npm test                                     # unit test: orders.service, jwt-auth.guard, demo.controller, auth.service
npm run test:e2e -- orders.e2e-spec.ts       # e2e: 401 / 200 / 404 / 400 cho /orders/me, /orders/:id và luồng demo-session
npm run test:e2e -- checkout.e2e-spec.ts     # e2e end-to-end: đăng ký → đăng nhập → POST /orders → POST /payments → xác nhận → lịch sử
```

---

## 12. API đăng ký / đăng nhập – JWT (Task 7)

Mã nguồn: `apps/api/src/auth/`. Mật khẩu băm bằng **bcrypt** (mặc định cost 10, đổi bằng `BCRYPT_ROUNDS` 4–15). JWT ký **HS256** bằng `JWT_SECRET`, sống **1 giờ**, payload `{ "sub": "<userId>", "email": "..." }`. Cần có `JWT_SECRET` trong `apps/api/.env` (`cp .env.example .env`) – backend tự đọc file này khi chạy local.

| Endpoint | Body | Thành công | Lỗi |
| -------- | ---- | ---------- | --- |
| `POST /auth/register` | `{ "email", "password" }` (mật khẩu 8–72 ký tự) | `201` `{ id, email, loyaltyPoints }` | `400` dữ liệu sai, `409` email đã đăng ký |
| `POST /auth/login` | `{ "email", "password" }` | `200` `{ accessToken, tokenType: "Bearer", expiresIn, user }` | `400` dữ liệu sai, `401` sai email/mật khẩu (cùng một thông báo) |

Email được chuẩn hóa (cắt khoảng trắng, chữ thường). Tài khoản đăng ký mới mặc định có role `CUSTOMER`; role được lưu trong PostgreSQL và đưa vào JWT. Phản hồi không bao giờ chứa mật khẩu hay hash. Hiện ứng dụng chưa có API quản trị được giới hạn riêng theo role.

```bash
curl -X POST localhost:3001/auth/register -H 'content-type: application/json' \
  -d '{"email":"kh@maycha.vn","password":"matkhau123"}'
curl -X POST localhost:3001/auth/login -H 'content-type: application/json' \
  -d '{"email":"kh@maycha.vn","password":"matkhau123"}'
# dùng accessToken: -H 'Authorization: Bearer <accessToken>'
curl localhost:3001/orders/me -H 'Authorization: Bearer <accessToken>'
```

**Guard bảo vệ route đặt đơn:** `JwtAuthGuard` (`src/common/auth/jwt-auth.guard.ts`) trả `401` khi thiếu / sai chữ ký / hết hạn token. Tài khoản được lưu trong PostgreSQL.

```bash
cd apps/api
npm test                                  # unit: auth.service (bcrypt, JWT, 409, 401)
npm run test:e2e -- auth.e2e-spec.ts      # e2e: register/login + guard 401/200
```

## 13. Nghiệp vụ đặt hàng & thanh toán (Task 10)

Các API nghiệp vụ cần JWT:

| Endpoint | Mô tả |
| -------- | ----- |
| `POST /orders` | Kiểm tra giỏ hàng và voucher, giữ tồn kho, tạo đơn `PENDING`; nếu thao tác lưu đơn lỗi thì tồn kho được rollback |
| `PATCH /orders/:id/status` | Chỉ cho phép các bước theo state machine; khi hủy đơn, cập nhật trạng thái và hoàn kho trong cùng transaction PostgreSQL |
| `POST /payments` | Mock thanh toán `WALLET`/`CARD`/`MOMO`/`VNPAY`; gửi `Idempotency-Key` (hoặc `X-Idempotency-Key`) để phát lại kết quả của cùng yêu cầu |
| `GET /payments/loyalty` | Trả số điểm loyalty của tài khoản |

State machine chính: `PENDING → PAID → PREPARING → READY → COMPLETED`. `PENDING` và `PAID` có thể chuyển sang `CANCELLED`; `PAYMENT_FAILED` có thể thanh toán lại thành `PAID` hoặc hủy. Trạng thái kết thúc không được chuyển tiếp.

Mỗi key idempotency được giới hạn theo user và nội dung yêu cầu. Dùng lại key với đơn/phương thức khác trả `409 Conflict`. Voucher hiện có: `MAYCHA10` giảm 10% và `BREWLITE20` giảm tối đa 20.000đ. Điểm được cộng sau thanh toán thành công, theo tỷ lệ 1 điểm / 10.000đ thực trả.

Đơn hàng cùng các dòng hàng, giữ/hoàn tồn kho, trạng thái thanh toán, idempotency và điểm loyalty được ghi trong transaction PostgreSQL. Các sản phẩm mẫu được upsert khi backend khởi động; stock hiện có được giữ nguyên.

### Test Task 10

```powershell
cd apps/api
npm test -- src/orders/backend.advanced.spec.ts
```
