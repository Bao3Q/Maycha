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

> ⚠️ **Backend bắt buộc chạy với `PORT=3001`.** Hiện backend **chưa đọc file `.env`**, nên nếu thiếu biến này nó sẽ mặc định chiếm cổng **3000** và tranh cổng với frontend.

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

---

## 1. Trạng thái hiện tại của dự án

| Hạng mục | Trạng thái |
| -------- | ---------- |
| Frontend (Next.js) | ✅ Khởi tạo xong, đang là trang mẫu mặc định |
| Backend (NestJS) | ✅ Khởi tạo xong, có 1 route `GET /` trả về `Hello World!` |
| Đọc file `.env` ở backend | ❌ Chưa có (chưa cài `@nestjs/config`) |
| PostgreSQL / Prisma | ❌ Chưa tích hợp, **chưa cần cài database** |
| Docker Compose | ❌ Chưa có `docker-compose.yml` |
| Frontend gọi API backend | ❌ Chưa kết nối |

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
│   │   ├── main.ts          # Điểm khởi động, đọc biến PORT (mặc định 3000)
│   │   ├── app.module.ts    # Module gốc
│   │   ├── app.controller.ts# Route GET /
│   │   └── app.service.ts
│   ├── test/                # Test end-to-end
│   ├── .env.example         # Mẫu biến môi trường (được commit)
│   └── package.json
├── frontend/                # Giao diện – Next.js (App Router) + Tailwind CSS
│   ├── app/
│   │   ├── layout.tsx       # Layout chung
│   │   └── page.tsx         # Trang chủ "/"
│   ├── public/              # Ảnh, icon tĩnh
│   └── package.json
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
| `PORT` | `3001` | ⚠️ Chỉ khi đặt trực tiếp trong lệnh chạy | Cổng backend. `main.ts` đọc `process.env.PORT`, mặc định `3000` |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/maycha_db?schema=public` | ❌ Chưa | Chuỗi kết nối PostgreSQL cho Prisma (Sprint sau) |
| `JWT_SECRET` | `super_secret_key_123` | ❌ Chưa | Khóa ký JWT (Sprint 2) |

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
- [ ] http://localhost:3000 hiển thị trang web
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
