import json
import sqlite3
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

        for item in samples:
            existing = db.scalar(
                select(Recipe.id).where(
                    Recipe.author_id == author.id,
                    Recipe.title == item["title"]
                )
            )

            if existing:
                continue

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
                category=category,
                author=author
            )
            db.add(recipe)

            for name in item["ingredients"]:
                ingredient = db.scalar(
                    select(Ingredient).where(
                        Ingredient.name == name
                    )
                )

                if not ingredient:
                    ingredient = Ingredient(name=name)
                    db.add(ingredient)
                    db.flush()

                recipe.ingredient_links.append(
                    RecipeIngredient(
                        ingredient=ingredient,
                        amount=""
                    )
                )

            recipe.steps.extend(
                CookingStep(step_number=index, content=content)
                for index, content in enumerate(item["steps"], 1)
            )

            created += 1

    print(f"Đã thêm: {created} món")
    print(f"Bỏ qua món mẫu đã có: {len(samples) - created}")
    print("Hoàn tất. Không ghi đè dữ liệu cũ.")


if __name__ == "__main__":
    main()