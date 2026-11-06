-- Tài khoản ADMIN mặc định để đăng nhập / thử API (Thunder Client, Postman...).
-- Email    : admin@maycha.vn
-- Mật khẩu : Admin@123456   (hash bcrypt bên dưới, cost 10)
--
-- Dùng ON CONFLICT để migration chạy lại trên database đã có sẵn tài khoản này
-- vẫn không lỗi, đồng thời đưa role về ADMIN và đặt lại mật khẩu về mật khẩu
-- mặc định ở trên (migration chỉ chạy một lần trên mỗi database).
INSERT INTO "User" ("id", "email", "passwordHash", "role", "loyaltyPoints", "createdAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin@maycha.vn',
  '$2b$10$6QjZRCXeZIk1rYpQaxbQfOZK4p.6T.DVVbWFXSFikJEgA.nMLrP56',
  'ADMIN',
  0,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET "role" = 'ADMIN',
    "passwordHash" = EXCLUDED."passwordHash";
