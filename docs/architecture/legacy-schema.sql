-- ========================================================
-- 1. BẢNG USERS (Quản lý thông tin người dùng / khách hàng)
-- ========================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'CUSTOMER', -- CUSTOMER, ADMIN, BARISTA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 2. BẢNG PRODUCTS (Quản lý danh mục sản phẩm/đồ uống)
-- ========================================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 3. BẢNG ORDERS (Quản lý thông tin đơn hàng - Task 6)
-- ========================================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PAID, PREPARING, COMPLETED, CANCELLED
    total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user
        FOREIGN KEY(user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ========================================================
-- 4. BẢNG ORDER_ITEMS (Chi tiết các món trong đơn hàng)
-- ========================================================
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    size VARCHAR(10) NOT NULL, -- S, M, L
    toppings TEXT[], -- Danh sách các topping kèm theo
    qty INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY(order_id) 
        REFERENCES orders(id)
        ON DELETE CASCADE
);

-- ========================================================
-- 5. BẢNG PAYMENTS (Quản lý giao dịch thanh toán - Task 8)
-- ========================================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL, -- MOMO, ZALOPAY, VNPAY, BANK_TRANSFER
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    transaction_code VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_order
        FOREIGN KEY(order_id) 
        REFERENCES orders(id)
        ON DELETE CASCADE
);

-- ========================================================
-- 6. TẠO CÁC INDEX TỐI ƯU HÓA HIỆU SUẤT TRUY VẤN
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- ========================================================
-- 7. TÀI KHOẢN ADMIN MẪU (mật khẩu ban đầu: 123456)
-- Chạy sau phần tạo bảng users. Mật khẩu được lưu dạng bcrypt.
-- ========================================================
INSERT INTO users (id, email, password, full_name, role)
VALUES (
    'admin-maycha',
    'admin@maycha.vn',
    '$2b$10$YnOdTsMSCr3wKLOIOKB0v.s6m1s/t7UB6THBuTVgn7mRq/Anifetu',
    'Maycha Admin',
    'ADMIN'
)
ON CONFLICT (email) DO NOTHING;
