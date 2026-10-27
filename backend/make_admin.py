from sqlalchemy import select

from database import SessionLocal
from models import User

username = input("Tên đăng nhập muốn cấp quyền admin: ").strip()

if not username:
    raise SystemExit("Tên đăng nhập không được để trống.")

with SessionLocal.begin() as db:
    user = db.scalar(
        select(User).where(User.username == username)
    )

    if user is None:
        raise SystemExit(
            "Không tìm thấy tài khoản. Hãy đăng ký tài khoản trên web trước."
        )

    user.role = "admin"

print(f"Đã cấp quyền admin cho: {username}")