# Hướng Dẫn Nấu Ăn

## Phân chia dữ liệu
Ứng dụng chia sẻ và quản lý công thức nấu ăn, gồm giao diện web tĩnh và API backend. Người dùng có thể tìm kiếm món ăn, xem công thức, đăng ký/đăng nhập, đăng và quản lý công thức, lưu món yêu thích, và gửi bình luận.

- FastAPI + SQLite lưu tài khoản, phiên đăng nhập và công thức do người dùng đăng.
- Giao diện, món mẫu, hình ảnh trong `images/` và video YouTube là tài nguyên frontend tĩnh.
- Bình luận chưa được triển khai nên hiện chưa cần database hay dịch vụ bên ngoài.
## Công nghệ

## Chạy trên Windows
- Frontend: HTML, CSS và JavaScript.
- Backend: Python, FastAPI và SQLAlchemy.
- Cơ sở dữ liệu mặc định: SQLite.

Mở PowerShell tại thư mục workspace:
## Yêu cầu

- Windows 10/11.
- Python 3.10 trở lên, có lệnh `py` hoặc `python` trong PowerShell.
- Hai cửa sổ PowerShell để chạy backend và frontend cùng lúc.

## Cài đặt lần đầu

Mở PowerShell tại thư mục dự án (thư mục có `README.md`) và chạy:

```powershell
py --version
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Nếu máy không nhận lệnh `py`, thay `py` bằng `python`.

Nếu PowerShell chặn kích hoạt môi trường ảo, không cần đổi Execution Policy; có thể dùng trực tiếp `backend\.venv\Scripts\python.exe` như các lệnh trong hướng dẫn này.

## Chạy chương trình

### 1. Khởi động backend

Trong cửa sổ PowerShell thứ nhất, từ thư mục gốc dự án:

```powershell
cd baimonsangt4.github
py -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Để cửa sổ này mở trong lúc sử dụng ứng dụng. Backend tự tạo các bảng và sáu danh mục món ăn khi khởi động. Mặc định, SQLite được lưu ở `backend\huong_dan_nau_an.db`.

Kiểm tra backend bằng cách mở:

- API: <http://127.0.0.1:8000/>
- Kiểm tra trạng thái và kết nối database: <http://127.0.0.1:8000/api/health>
- Tài liệu API tương tác: <http://127.0.0.1:8000/docs>

### 2. Khởi động giao diện

Mở cửa sổ PowerShell thứ hai tại thư mục gốc dự án:

```powershell
py -m http.server 5500 --bind 127.0.0.1
```

Nếu không có lệnh `py`, dùng:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

Mở terminal thứ hai tại thư mục workspace để chạy giao diện:
Mở <http://127.0.0.1:5500> trong trình duyệt. Giữ cả hai cửa sổ terminal đang chạy. Để dừng từng máy chủ, nhấn `Ctrl+C` trong cửa sổ tương ứng.

## Dữ liệu mẫu

Trang món ăn có sẵn dữ liệu hiển thị trong giao diện. Để nhập thêm các công thức mẫu đầy đủ từ `backend\sample_recipes.json` vào SQLite:

1. Khởi động backend ít nhất một lần để tạo database và bảng.
2. Dừng backend bằng `Ctrl+C`.
3. Trong PowerShell, chuyển vào thư mục backend và chạy script nạp mẫu:

```powershell
cd baimonsangt4.github
python -m http.server 5500
cd backend
.venv\Scripts\python.exe seed_recipes.py
```

Mở `http://127.0.0.1:5500`. Backend tự tạo các bảng SQLite và danh mục mẫu; dữ liệu database nằm trong `backend/huong_dan_nau_an.db`.
Script tạo bản sao lưu database trước khi ghi, không ghi đè công thức mẫu đã có và chỉ hỗ trợ SQLite. Chạy backend lại để tiếp tục sử dụng. Tài khoản nội bộ dùng để gán tác giả cho dữ liệu mẫu không dùng để đăng nhập.

## Sử dụng ứng dụng

1. Vào **Món ăn** để tìm theo tên (có dấu hoặc không dấu) và lọc theo danh mục.
2. Mở một món để xem chi tiết, nguyên liệu, cách làm, video (nếu có) và bình luận.
3. Đăng ký hoặc đăng nhập để đăng/sửa/xóa công thức, lưu món yêu thích và gửi bình luận.
4. Chỉ chủ công thức được sửa hoặc xóa công thức; chỉ người viết bình luận được xóa bình luận của mình.

## Khắc phục sự cố

- **Không thể kết nối máy chủ:** Kiểm tra cửa sổ backend còn chạy không và địa chỉ là `http://127.0.0.1:8000`.
- **Không tải được danh sách món hoặc bị lỗi CORS:** Mở giao diện qua máy chủ tại `http://127.0.0.1:5500`, không mở trực tiếp tệp HTML bằng `file://`.
- **Cổng 8000 hoặc 5500 đã được sử dụng:** Dừng chương trình khác đang dùng cổng đó hoặc chọn cổng khác. Nếu đổi cổng backend, cập nhật `apiBaseUrl` trong `config.js` và cấu hình CORS tương ứng.
- **Lỗi không tìm thấy `uvicorn`:** Cài dependencies bằng `backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt`, rồi chạy lại lệnh khởi động backend.
- **Muốn bắt đầu với database mới:** Dừng backend, sao lưu dữ liệu cần giữ trước khi tự xóa hoặc đổi tên `backend\huong_dan_nau_an.db`, rồi khởi động backend để tạo database rỗng mới. Thao tác này làm mất dữ liệu trong database cũ nếu không có bản sao lưu.

## Cấu hình

## Cấu hình triển khai
- `config.js`: đặt `apiBaseUrl` thành địa chỉ backend mà trình duyệt truy cập được.
- `FRONTEND_ORIGINS`: danh sách origin frontend được phép gọi API, phân tách bằng dấu phẩy. Mặc định có các địa chỉ localhost dùng trong phát triển, gồm `http://127.0.0.1:5500`.
- `DATABASE_URL`: tùy chọn đổi kết nối database; mặc định là SQLite cục bộ. Script `seed_recipes.py` chỉ hoạt động với database SQLite mặc định tại `backend\huong_dan_nau_an.db`.

- Đổi `apiBaseUrl` trong `config.js` sang URL backend đã triển khai.
- Đặt `FRONTEND_ORIGINS` thành origin frontend được phép truy cập, phân tách bằng dấu phẩy.
- Có thể đổi `DATABASE_URL`; mặc định dùng SQLite cục bộ.
- Chạy qua HTTPS khi đưa lên Internet. Token phiên nằm trong `localStorage` của trình duyệt.
Khi triển khai công khai, cấu hình origin phù hợp với frontend, dùng HTTPS và không dùng cấu hình phát triển mặc định cho môi trường production.