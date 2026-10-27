import sqlite3
from pathlib import Path

database = Path(__file__).resolve().parent / "huong_dan_nau_an.db"

if not database.is_file():
    raise SystemExit("Không tìm thấy database. Dừng cập nhật.")

with sqlite3.connect(database) as connection:
    columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(users)")
    }

    if not columns:
        raise SystemExit("Không tìm thấy bảng users. Dừng cập nhật.")

    if "is_active" in columns:
        print("Đã có cột is_active, không cần thêm.")
    else:
        connection.execute(
            "ALTER TABLE users "
            "ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
        )
        print("Đã thêm cột is_active thành công.")