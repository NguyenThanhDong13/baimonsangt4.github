import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from database import Base, engine, SessionLocal
from models import (
    Category, CookingStep, Ingredient,
    Recipe, RecipeIngredient, User
)

BACKEND = Path(__file__).resolve().parent
AUTHOR = "__sample_recipes__"
DISABLED_PASSWORD = "!sample-account-disabled"


def tach_nguyen_lieu(text):
    import re
    match = re.match(r"^([0-9]+(?:[.,][0-9]+)?(?:/[0-9]+)?(?:\s*(?:g|kg|ml|l|quả|bát|muỗng|cái|tổ|thìa))?)\s+(.+)$", text.strip(), re.IGNORECASE)
    if not match:
        return text.strip(), ""
    return match.group(2).strip(), match.group(1).strip()


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main():
    samples = json.loads(
        (BACKEND / "sample_recipes.json").read_text(
            encoding="utf-8-sig"
        )
    )

    if engine.url.get_backend_name() != "sqlite":
        raise RuntimeError("Script này chỉ hỗ trợ SQLite.")

    database = engine.url.database
    if not database or database == ":memory:":
        raise RuntimeError("Cần dùng tệp database SQLite.")

    database_path = Path(database).resolve()
    expected_path = BACKEND / "huong_dan_nau_an.db"

    if database_path != expected_path:
        raise RuntimeError(
            f"Database không đúng: {database_path}\n"
            f"Cần dùng: {expected_path}\n"
            "Hãy chạy lệnh từ thư mục backend."
        )

    if not database_path.exists():
        raise RuntimeError("Không tìm thấy database cũ. Dừng nhập.")

    print("Database:", database_path)

    # Tạo thêm bản sao lưu tự động trước khi nhập.
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup = BACKEND / f"huong_dan_nau_an.{stamp}.db.bak"

    with sqlite3.connect(database_path) as source:
        with sqlite3.connect(backup) as target:
            source.backup(target)

    print("Bản sao lưu:", backup)

    Base.metadata.create_all(engine)
    created = 0

    # Nếu nhập lỗi, toàn bộ giao dịch sẽ được hoàn tác.
    with SessionLocal.begin() as db:
        author = db.scalar(
            select(User).where(User.username == AUTHOR)
        )

        if author and author.password_hash != DISABLED_PASSWORD:
            raise RuntimeError(
                "Tên tác giả mẫu đã được tài khoản khác sử dụng."
            )

        if not author:
            author = User(
                username=AUTHOR,
                password_hash=DISABLED_PASSWORD
            )
            db.add(author)
            db.flush()

        # Xóa một lần để quan hệ nguyên liệu/cách làm được tạo lại sạch sẽ.
        for old_recipe in db.scalars(
            select(Recipe).where(Recipe.author_id == author.id)
        ).all():
            db.delete(old_recipe)
        db.flush()

        for item in samples:
            existing = db.scalar(
                select(Recipe).where(
                    Recipe.author_id == author.id,
                    Recipe.title == item["title"]
                )
            )

            # Cập nhật lại công thức mẫu để sửa định lượng hoặc dữ liệu Unicode cũ.
            if existing:
                db.delete(existing)
                db.flush()

            category = db.scalar(
                select(Category).where(
                    Category.name == item["category"]
                )
            )

            if not category:
                category = Category(name=item["category"])
                db.add(category)
                db.flush()

            recipe = Recipe(
                title=item["title"],
                description=item["description"],
                image_url=item["image_url"],
                cook_time=item.get("cook_time"),
                video_url=item.get("video_url"),
                servings="4 người",
                category=category,
                author=author
            )
            db.add(recipe)
            db.flush()

            ingredient_data = item["ingredients"]
            if not ingredient_data:
                ingredient_data = [
                    "500g thịt hoặc hải sản chính",
                    "300g rau củ",
                    "2 muỗng nước mắm",
                    "1 muỗng dầu ăn",
                    "Hành, tỏi"
                ]

            for raw_name in ingredient_data:
                name, amount = tach_nguyen_lieu(raw_name)
                ingredient = db.scalar(
                    select(Ingredient).where(
                        Ingredient.name == name
                    )
                )

                if not ingredient:
                    ingredient = Ingredient(name=name)
                    db.add(ingredient)
                    db.flush()

                db.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    amount=amount
                ))

            for index, content in enumerate(item["steps"], 1):
                db.add(CookingStep(
                    recipe_id=recipe.id,
                    step_number=index,
                    content=content
                ))

            created += 1

    print(f"Đã thêm: {created} món")
    print(f"Bỏ qua món mẫu đã có: {len(samples) - created}")
    print("Hoàn tất. Không ghi đè dữ liệu cũ.")


if __name__ == "__main__":
    main()