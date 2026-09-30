from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from sqlalchemy import inspect, select

from database import Base, engine, SessionLocal
import models
from models import (
    Category,
    CookingStep,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API Hướng Dẫn Nấu Ăn",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
@app.get("/")
def trang_chu_api():
    return {"message": "API Hướng Dẫn Nấu Ăn đang chạy"}

@app.get("/api/health")
def kiem_tra_api():
    return {"status": "CSDL đã kết nối"}

@app.post("/api/setup/categories")
def tao_danh_muc_mau():
    danh_muc_mau = [
        "Món nước",
        "Món canh",
        "Món chiên",
        "Món xào",
        "Món nướng",
        "Món khô"
    ]

    db = SessionLocal()

    try:
        danh_muc_da_co = db.scalars(select(Category.name)).all()

        danh_muc_moi = [
            Category(name=ten)
            for ten in danh_muc_mau
            if ten not in danh_muc_da_co
        ]

        db.add_all(danh_muc_moi)
        db.commit()

        return {
            "message": "Đã tạo danh mục mẫu",
            "so_danh_muc_them": len(danh_muc_moi)
        }
    finally:
        db.close()

@app.get("/api/categories")
def lay_danh_sach_danh_muc():
    db = SessionLocal()

    try:
        danh_muc = db.scalars(
            select(Category).order_by(Category.id)
        ).all()

        return [
            {"id": item.id, "name": item.name}
            for item in danh_muc
        ]
    finally:
        db.close()

@app.get("/api/database/tables")
def xem_cac_bang():
    return {"tables": inspect(engine).get_table_names()}

@app.post("/api/setup/com-chien")
def tao_mon_com_chien():
    db = SessionLocal()

    try:
        admin = db.scalar(
            select(User).where(User.username == "admin")
        )

        if not admin:
            admin = User(
                username="admin",
                password_hash="123456"
            )
            db.add(admin)
            db.flush()

        category = db.scalar(
            select(Category).where(Category.name == "Món chiên")
        )

        if not category:
            return {"message": "Chưa có danh mục Món chiên"}

        da_co_mon = db.scalar(
            select(Recipe).where(Recipe.title == "Cơm chiên")
        )

        if da_co_mon:
            return {"message": "Món Cơm chiên đã có trong CSDL"}

        recipe = Recipe(
            title="Cơm chiên",
            description="Công thức đơn giản, phù hợp cho bữa cơm gia đình.",
            image_url="images/Com chien.jpg",
            video_url="https://www.youtube.com/watch?v=_cdBAMq5KZ0",
            cook_time="25 phút",
            servings="2–4 người",
            difficulty="Dễ",
            category_id=category.id,
            author_id=admin.id
        )

        db.add(recipe)
        db.flush()

        nguyen_lieu = [
            ("Cơm nguội", "2 bát"),
            ("Trứng", "2 quả"),
            ("Cà rốt", "1 củ"),
            ("Đậu Hà Lan", "100g"),
            ("Hành lá", "2 nhánh"),
            ("Dầu ăn", "2 muỗng canh"),
            ("Nước mắm", "1 muỗng cà phê"),
            ("Tiêu", "1 ít")
        ]

        for ten, so_luong in nguyen_lieu:
            ingredient = db.scalar(
                select(Ingredient).where(Ingredient.name == ten)
            )

            if not ingredient:
                ingredient = Ingredient(name=ten)
                db.add(ingredient)
                db.flush()

            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    amount=so_luong
                )
            )

        cac_buoc = [
            "Làm tơi cơm nguội.",
            "Đánh đều trứng với một ít gia vị.",
            "Phi thơm hành, cho trứng vào đảo nhanh.",
            "Cho cơm, cà rốt và đậu Hà Lan vào chảo.",
            "Nêm nước mắm, tiêu và đảo đến khi cơm săn.",
            "Thêm hành lá rồi tắt bếp."
        ]

        for so_thu_tu, noi_dung in enumerate(cac_buoc, start=1):
            db.add(
                CookingStep(
                    recipe_id=recipe.id,
                    step_number=so_thu_tu,
                    content=noi_dung
                )
            )

        db.commit()

        return {
            "message": "Đã thêm Cơm chiên vào CSDL",
            "recipe_id": recipe.id
        }
    finally:
        db.close()


def chuyen_cong_thuc_thanh_json(recipe, co_chi_tiet=False):
    du_lieu = {
        "id": recipe.id,
        "title": recipe.title,
        "description": recipe.description,
        "image_url": recipe.image_url,
        "cook_time": recipe.cook_time,
        "servings": recipe.servings,
        "difficulty": recipe.difficulty,
        "category": recipe.category.name,
        "author": recipe.author.username
    }

    if co_chi_tiet:
        du_lieu["video_url"] = recipe.video_url

        du_lieu["ingredients"] = [
            {
                "name": link.ingredient.name,
                "amount": link.amount
            }
            for link in recipe.ingredient_links
        ]

        du_lieu["steps"] = [
            {
                "step_number": step.step_number,
                "content": step.content
            }
            for step in sorted(recipe.steps, key=lambda item: item.step_number)
        ]

    return du_lieu


@app.get("/api/recipes")
def lay_danh_sach_cong_thuc():
    db = SessionLocal()

    try:
        recipes = db.scalars(
            select(Recipe).order_by(Recipe.id.desc())
        ).all()

        return [
            chuyen_cong_thuc_thanh_json(recipe)
            for recipe in recipes
        ]
    finally:
        db.close()


@app.get("/api/recipes/{recipe_id}")
def lay_chi_tiet_cong_thuc(recipe_id: int):
    db = SessionLocal()

    try:
        recipe = db.get(Recipe, recipe_id)

        if not recipe:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy công thức"
            )

        return chuyen_cong_thuc_thanh_json(recipe, co_chi_tiet=True)
    finally:
        db.close()