# 📋 Hệ Thống Quản Lý Dự Án Thông Minh

Hệ thống quản lý dự án tích hợp trí tuệ nhân tạo (AI) hỗ trợ dự đoán KPI nhân viên và cảnh báo nguy cơ trễ tiến độ dự án, sử dụng mô hình Machine Learning (Logistic Regression & Random Forest).

---

## 📌 Tổng Quan

| Thành phần | Công nghệ |
|---|---|
| **Frontend** | React Router v7, Vite, TailwindCSS v4, TypeScript |
| **Backend** | Node.js, Express.js, Sequelize ORM, Socket.IO |
| **Database** | MySQL |
| **AI/ML** | Python, scikit-learn (Logistic Regression, Random Forest) |
| **Upload ảnh** | Cloudinary |
| **Email** | Nodemailer (Gmail SMTP) |
| **Container** | Docker, Docker Compose |

---

## 📁 Cấu Trúc Thư Mục

```
DoAnTotNghiep/
├── client/                  # Frontend (React Router + Vite)
│   ├── app/                 # Source code chính
│   │   ├── components/      # Các component UI tái sử dụng
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   ├── provider/        # Context providers (Auth, ...)
│   │   ├── routes/          # Các trang (pages)
│   │   │   ├── auth/        # Đăng nhập, đăng ký
│   │   │   ├── dashboard/   # Trang quản trị
│   │   │   └── root/        # Layout gốc
│   │   └── type/            # TypeScript type definitions
│   ├── Dockerfile           # Dockerfile production
│   ├── Dockerfile.dev       # Dockerfile development
│   └── package.json
│
├── server/                  # Backend (Node.js + Express)
│   ├── src/
│   │   ├── config/          # Cấu hình DB, Cloudinary
│   │   ├── controllers/     # Xử lý request
│   │   ├── middlewares/     # Middleware xác thực, phân quyền
│   │   ├── migrations/      # Database migrations (Sequelize)
│   │   ├── models/          # Sequelize models
│   │   ├── routers/         # Định nghĩa API routes
│   │   ├── services/        # Business logic
│   │   ├── socket/          # Socket.IO handlers (chat, notifications)
│   │   └── utils/           # Helper functions
│   ├── server.js            # Entry point
│   ├── Dockerfile           # Dockerfile (bao gồm Python env)
│   └── package.json
│
├── HM/                      # Module Machine Learning (Python)
│   ├── data/                # Dữ liệu huấn luyện
│   ├── models/              # Các model đã train (.pkl)
│   │   ├── model_A.pkl      # KPI Onboarding (Logistic Regression)
│   │   ├── model_B.pkl      # KPI Internal (Logistic Regression)
│   │   └── rf_project_delay.pkl  # Dự đoán trễ dự án (Random Forest)
│   ├── src/                 # Source code Python
│   └── requirements.txt     # Python dependencies
│
├── docker-compose.yml       # Docker Compose orchestration
└── README.md                # File này
```

---

## ⚙️ Yêu Cầu Hệ Thống

### Cài đặt bằng Docker (Khuyến nghị)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (bao gồm Docker Compose)
- [MySQL](https://dev.mysql.com/downloads/mysql/) **8.0+** (cài trên máy host)

### Cài đặt thủ công (không dùng Docker)
- [Node.js](https://nodejs.org/) **v20+** (khuyến nghị LTS)
- [Python](https://www.python.org/downloads/) **3.10+**
- [MySQL](https://dev.mysql.com/downloads/mysql/) **8.0+**
- npm (đi kèm Node.js)

---

## 🚀 Hướng Dẫn Cài Đặt

### Bước 1: Clone dự án

```bash
git clone https://github.com/phanthanhthang123/GR2.git
cd GR2
```

### Bước 2: Tạo database MySQL

Mở MySQL và tạo database:

```sql
CREATE DATABASE project_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **Lưu ý:** Đảm bảo MySQL đang chạy trên cổng `3306` với user `root` và password rỗng (mặc định). Nếu khác, hãy cập nhật biến môi trường tương ứng.

---

## 🐳 Cách 1: Cài Đặt Bằng Docker (Khuyến Nghị)

Đây là cách đơn giản nhất, chỉ cần 1 lệnh duy nhất.

### Bước 1: Đảm bảo MySQL đang chạy trên máy host

Docker container sẽ kết nối đến MySQL trên máy host thông qua `host.docker.internal`.

### Bước 2: Build và chạy

```bash
docker-compose up --build
```

> Lần đầu tiên sẽ mất vài phút để build images (cài Node.js, Python, dependencies).

### Bước 3: Truy cập ứng dụng

| Dịch vụ | URL |
|---|---|
| 🌐 **Frontend** | [http://localhost:5173](http://localhost:5173) |
| 🔧 **Backend API** | [http://localhost:5000](http://localhost:5000) |

### Các lệnh Docker hữu ích

```bash
# Chạy ở chế độ nền (detached)
docker-compose up -d

# Xem logs
docker-compose logs -f

# Xem logs từng service
docker-compose logs -f server
docker-compose logs -f client

# Dừng tất cả containers
docker-compose down

# Rebuild khi có thay đổi code
docker-compose up --build

# Restart chỉ client (khi sửa code frontend)
docker-compose restart client

# Restart chỉ server (khi sửa code backend)
docker-compose restart server
```

---

## 🔧 Cách 2: Cài Đặt Thủ Công (Không Dùng Docker)

### 2.1. Cài đặt Backend (Server)

```bash
# Di chuyển vào thư mục server
cd server

# Cài đặt Node.js dependencies
npm install

# Tạo file .env (copy từ mẫu bên dưới)
# Xem phần "Cấu hình biến môi trường" bên dưới

# Chạy database migrations
npx sequelize-cli db:migrate

# Khởi động server
npm start
```

Server sẽ chạy tại: `http://localhost:5000`

### 2.2. Cài đặt Frontend (Client)

Mở terminal mới:

```bash
# Di chuyển vào thư mục client
cd client

# Cài đặt dependencies
npm install

# Tạo file .env
echo "VITE_API_BASE_URL = http://localhost:5000/api/v1" > .env

# Khởi động dev server
npm run dev
```

Client sẽ chạy tại: `http://localhost:5173`

### 2.3. Cài đặt Python ML Environment

```bash
# Di chuyển vào thư mục HM
cd HM

# Tạo virtual environment
python -m venv .venv

# Kích hoạt virtual environment
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

> **Lưu ý:** Các model ML đã được train sẵn (`.pkl` files trong `HM/models/`). Không cần train lại trừ khi muốn cập nhật dữ liệu.

---

## 🔐 Cấu Hình Biến Môi Trường

### Server (`server/.env`)

```env
# Environment
NODE_ENV=development

# Server
PORT=5000
URL_REACT=http://localhost:5173

# Database (MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=project_manager
DB_PORT=3306

# JWT Secret Keys
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key

# Email (Gmail SMTP - dùng App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Cloudinary (Upload ảnh đại diện)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Client (`client/.env`)

```env
VITE_API_BASE_URL = http://localhost:5000/api/v1
```

> **Hướng dẫn tạo Gmail App Password:**
> 1. Truy cập [Google Account Security](https://myaccount.google.com/security)
> 2. Bật **2-Step Verification** (Xác minh 2 bước)
> 3. Vào **App passwords** → Tạo password mới cho ứng dụng
> 4. Copy password 16 ký tự vào `EMAIL_PASS`

---

## 🗄️ Database Migrations

Hệ thống sử dụng **Sequelize CLI** để quản lý schema database.

```bash
cd server

# Chạy tất cả migrations (tạo bảng)
npx sequelize-cli db:migrate

# Rollback migration cuối cùng
npx sequelize-cli db:migrate:undo

# Rollback tất cả migrations
npx sequelize-cli db:migrate:undo:all
```

> Khi dùng Docker, migrations sẽ tự động chạy khi container khởi động.

---

## 🤖 Module Machine Learning (HM)

Thư mục `HM/` chứa các mô hình AI/ML:

| Model | File | Mô tả |
|---|---|---|
| **Model A** | `model_A.pkl` | Dự đoán KPI nhân viên mới (Onboarding) dựa trên CPA, điểm phỏng vấn, điểm CV, kinh nghiệm |
| **Model B** | `model_B.pkl` | Dự đoán KPI nhân viên nội bộ dựa trên số năm tại công ty + thống kê task |
| **Random Forest** | `rf_project_delay.pkl` | Dự đoán nguy cơ trễ tiến độ dự án dựa trên 9 features |

### Train lại model (nếu cần)

```bash
cd HM
source .venv/bin/activate  # hoặc .venv\Scripts\activate trên Windows

# Train Model A (KPI Onboarding)
python -m src.train_model_A_lr

# Train Model B (KPI Internal)
python -m src.train_model_B_lr

# Train Random Forest (Project Delay)
python -m src.train_model_rf
```

---

## 📡 API Endpoints

Base URL: `http://localhost:5000/api/v1`

| Module | Prefix | Mô tả |
|---|---|---|
| Auth | `/auth` | Đăng nhập, đăng ký, quản lý tài khoản |
| Workspace | `/workspace` | Quản lý không gian làm việc |
| Project | `/project` | Quản lý dự án, dự đoán AI |
| Task | `/task` | Quản lý công việc |
| Chat | `/chat` | Nhắn tin, hội thoại |
| Notification | `/notification` | Thông báo real-time |

---

## 👥 Vai Trò Người Dùng

| Vai trò | Quyền hạn |
|---|---|
| **Admin** | Quản lý tất cả tài khoản, toàn quyền hệ thống |
| **Leader** | Tạo/quản lý dự án, giao task, xem dự đoán AI |
| **Member** | Thực hiện task được giao, xem thông tin cá nhân |

---

## 🛠️ Xử Lý Sự Cố

### MySQL không kết nối được
```bash
# Kiểm tra MySQL đang chạy
mysql -u root -p -e "SELECT 1;"

# Đảm bảo database tồn tại
mysql -u root -p -e "SHOW DATABASES LIKE 'project_manager';"
```

### Docker container lỗi
```bash
# Xem logs chi tiết
docker-compose logs -f server

# Rebuild từ đầu
docker-compose down
docker-compose up --build
```

### Port đã bị chiếm
```bash
# Kiểm tra port 5000 (Windows)
netstat -ano | findstr :5000

# Kiểm tra port 5173 (Windows)
netstat -ano | findstr :5173
```

### Lỗi Python/ML predictions
```bash
# Kiểm tra Python version
python --version

# Kiểm tra model files tồn tại
ls HM/models/
# Phải có: model_A.pkl, model_B.pkl, rf_project_delay.pkl
```

---

## 📝 Ghi Chú

- Hệ thống sử dụng **Socket.IO** cho chat real-time và thông báo.
- Cloudinary là tùy chọn — nếu không cấu hình, chức năng upload ảnh đại diện sẽ bị vô hiệu.
- File `.env` đã được thêm vào `.gitignore` — bạn cần tự tạo file `.env` khi clone dự án.
- Khi dùng Docker, code trong `client/app/` được mount volume nên thay đổi sẽ hot-reload tự động.

---

## 📄 Giấy Phép

Dự án đồ án tốt nghiệp — chỉ sử dụng cho mục đích học tập và nghiên cứu.
