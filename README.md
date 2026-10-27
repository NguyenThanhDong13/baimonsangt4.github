# Hướng Dẫn Nấu Ăn

Ứng dụng chia sẻ và quản lý công thức nấu ăn, gồm giao diện web và API backend.

## Công nghệ và dữ liệu

- Frontend: HTML, CSS, JavaScript.
- Backend: Python, FastAPI, SQLAlchemy.
- SQLite lưu tài khoản, phiên đăng nhập, công thức, nguyên liệu, cách làm, yêu thích và bình luận.
- Ảnh trong `images/` là tài nguyên tĩnh; video được nhúng từ YouTube.

## Yêu cầu

- Python 3.10 trở lên.
- Các lệnh dưới đây sử dụng PowerShell trên Windows.
- Mở terminal tại thư mục gốc dự án, nơi có `README.md`.

## Cài đặt lần đầu

```powershell
py --version
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Nếu không có lệnh `py`, thay bằng `python`. Không cần kích hoạt môi trường ảo khi dùng trực tiếp đường dẫn Python như trên.

## Chạy backend

Từ thư mục gốc dự án:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Giữ terminal đang chạy. Backend tạo bảng và sáu danh mục mặc định. Database mặc định nằm tại `backend/huong_dan_nau_an.db`.

- API: http://127.0.0.1:8000/
- Kiểm tra database: http://127.0.0.1:8000/api/health
- Tài liệu API: http://127.0.0.1:8000/docs

## Chạy giao diện

Mở terminal thứ hai tại thư mục gốc dự án:

```powershell
py -m http.server 5500 --bind 127.0.0.1
```

Nếu không có `py`, thay bằng `python`.

Mở http://127.0.0.1:5500 trong trình duyệt. Nhấn Ctrl+C trong từng terminal để dừng máy chủ.

## Dữ liệu mẫu

Danh sách món được tải từ database. Để nhập dữ liệu từ `backend/sample_recipes.json`:

1. Khởi động backend ít nhất một lần để tạo database.
2. Dừng backend.
3. Từ thư mục gốc dự án, chạy:

```powershell
cd backend
.\.venv\Scripts\python.exe seed_recipes.py
```

Script chỉ hỗ trợ SQLite mặc định, tạo bản sao lưu và bỏ qua công thức mẫu đã tồn tại. Script không tự bổ sung nội dung thiếu cho các công thức đã có.

Khởi động lại backend sau khi nhập. Tài khoản nội bộ `__sample_recipes__` chỉ dùng để gán tác giả dữ liệu mẫu, không dùng để đăng nhập.

## Chức năng và phân quyền

- Tìm kiếm món bằng tiếng Việt có dấu hoặc không dấu, lọc theo danh mục.
- Xem nguyên liệu, cách làm và video nếu có.
- Đăng ký, đăng nhập, đăng công thức, lưu yêu thích và bình luận.
- Người dùng được sửa/xóa công thức của mình và xóa bình luận của mình.
- Admin được xem danh sách tài khoản, sửa/xóa mọi công thức và xóa bình luận.
- Backend kiểm tra quyền cho các thao tác quản lý.

## Cấp quyền admin đầu tiên

Đăng ký tài khoản bình thường trên web trước. Sau khi cập nhật database có cột `role`, dừng backend và chạy từ thư mục `backend`:

```powershell
.\.venv\Scripts\python.exe make_admin.py
```

Nhập tên tài khoản cần cấp quyền. Không đưa mật khẩu hoặc token vào mã nguồn.

## Cấu hình triển khai

- `config.js`: đặt `apiBaseUrl` thành URL backend mà trình duyệt truy cập được.
- `FRONTEND_ORIGINS`: các origin frontend được phép gọi API, phân tách bằng dấu phẩy.
- `DATABASE_URL`: tùy chọn thay kết nối database; mặc định dùng SQLite.
- Khi triển khai công khai, dùng HTTPS và cấu hình CORS theo địa chỉ frontend thực tế.
- Token đăng nhập hiện được lưu trong `localStorage` của trình duyệt.

## Khắc phục sự cố

- Không kết nối được API: kiểm tra backend đang chạy tại cổng 8000.
- Lỗi CORS: mở frontend qua máy chủ HTTP, không mở HTML bằng `file://`.
- Cổng bị chiếm: dừng chương trình đang dùng cổng; nếu đổi cổng, cập nhật URL API và CORS tương ứng.
- Thiếu thư viện: chạy lại lệnh cài `backend/requirements.txt` bằng Python trong môi trường ảo.
- Thay đổi model không tự cập nhật cấu trúc bảng đã tồn tại; cần chuyển đổi database phù hợp.
- Sao lưu database trước khi cập nhật cấu trúc hoặc đặt lại dữ liệu. Không xóa database nếu cần giữ tài khoản và bài đăng.