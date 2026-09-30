# Hướng Dẫn Nấu Ăn

## Phân chia dữ liệu

- FastAPI + SQLite lưu tài khoản, phiên đăng nhập và công thức do người dùng đăng.
- Giao diện, món mẫu, hình ảnh trong `images/` và video YouTube là tài nguyên frontend tĩnh.
- Bình luận chưa được triển khai nên hiện chưa cần database hay dịch vụ bên ngoài.

## Chạy trên Windows

Mở PowerShell tại thư mục workspace:

```powershell
cd baimonsangt4.github
py -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Mở terminal thứ hai tại thư mục workspace để chạy giao diện:

```powershell
cd baimonsangt4.github
python -m http.server 5500
```

Mở `http://127.0.0.1:5500`. Backend tự tạo các bảng SQLite và danh mục mẫu; dữ liệu database nằm trong `backend/huong_dan_nau_an.db`.

## Cấu hình triển khai

- Đổi `apiBaseUrl` trong `config.js` sang URL backend đã triển khai.
- Đặt `FRONTEND_ORIGINS` thành origin frontend được phép truy cập, phân tách bằng dấu phẩy.
- Có thể đổi `DATABASE_URL`; mặc định dùng SQLite cục bộ.
- Chạy qua HTTPS khi đưa lên Internet. Token phiên nằm trong `localStorage` của trình duyệt.
