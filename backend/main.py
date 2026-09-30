import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session as DatabaseSession

from database import Base, engine, SessionLocal
import models
from models import (
    Category,
    CookingStep,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User,
    UserSession
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API Hướng Dẫn Nấu Ăn",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:3000,http://localhost:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

SESSION_LIFETIME = timedelta(days=14)
PASSWORD_ITERATIONS = 310_000
security = HTTPBearer(auto_error=False)
DANH_MUC = {
    "nuoc": "Món nước",
    "canh": "Món canh",
    "chien": "Món chiên",
    "kho": "Món khô",
    "xao": "Món xào",
    "nuong": "Món nướng"
}


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Tên đăng nhập cần có ít nhất 3 ký tự")
        return normalized


class RecipeInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str
    description: str = Field(min_length=1)
    image_url: str | None = Field(default=None, max_length=500)
    video_url: str | None = Field(default=None, max_length=500)
    cook_time: str | None = Field(default=None, max_length=50)
    servings: str | None = Field(default=None, max_length=50)
    difficulty: str | None = Field(default=None, max_length=50)
    ingredients: list[str] = Field(min_length=1, max_length=100)
    steps: list[str] = Field(min_length=1, max_length=100)

    @field_validator("title", "description")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Trường này không được để trống")
        return normalized

    @field_validator("ingredients", "steps")
    @classmethod
    def normalize_lines(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values if value.strip()]
        if not normalized:
            raise ValueError("Cần có ít nhất một dòng nội dung")
        return normalized


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS
    )
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations)
        )
        return hmac.compare_digest(candidate.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def issue_session(db: DatabaseSession, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(UserSession(
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        user_id=user.id,
        expires_at=datetime.utcnow() + SESSION_LIFETIME
    ))
    return token


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: DatabaseSession = Depends(get_db)
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vui lòng đăng nhập",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == token_hash)
    )
    if not session or session.expires_at <= datetime.utcnow():
        if session:
            db.delete(session)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return session.user


def seed_categories() -> None:
    db = SessionLocal()
    try:
        existing = set(db.scalars(select(Category.name)).all())
        db.add_all(
            Category(name=name)
            for name in DANH_MUC.values()
            if name not in existing
        )
        db.commit()
    finally:
        db.close()


seed_categories()


@app.get("/")
def trang_chu_api():
    return {"message": "API Hướng Dẫn Nấu Ăn đang chạy"}

@app.get("/api/health")
def kiem_tra_api():
    with SessionLocal() as db:
        db.execute(select(1))
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def dang_ky(payload: Credentials, db: DatabaseSession = Depends(get_db)):
    existing_user = db.scalar(
        select(User).where(User.username == payload.username)
    )
    if existing_user:
        raise HTTPException(status_code=409, detail="Tên đăng nhập đã tồn tại")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password)
    )
    db.add(user)
    db.flush()
    token = issue_session(db, user)
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username}
    }


@app.post("/api/auth/login")
def dang_nhap(payload: Credentials, db: DatabaseSession = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")

    token = issue_session(db, user)
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username}
    }


@app.get("/api/auth/me")
def thong_tin_tai_khoan(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}


@app.post("/api/auth/logout")
def dang_xuat(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: DatabaseSession = Depends(get_db)
):
    if credentials is not None:
        token_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
        session = db.scalar(
            select(UserSession).where(UserSession.token_hash == token_hash)
        )
        if session:
            db.delete(session)
            db.commit()
    return {"message": "Đã đăng xuất"}

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
        "category_code": next(
            (code for code, name in DANH_MUC.items() if name == recipe.category.name),
            None
        ),
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


@app.post("/api/recipes", status_code=status.HTTP_201_CREATED)
def tao_cong_thuc(
    payload: RecipeInput,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    category_name = DANH_MUC.get(payload.category, payload.category)
    if category_name not in DANH_MUC.values():
        raise HTTPException(status_code=400, detail="Danh mục không hợp lệ")

    category = db.scalar(select(Category).where(Category.name == category_name))
    if not category:
        raise HTTPException(status_code=400, detail="Danh mục chưa được khởi tạo")

    recipe = Recipe(
        title=payload.title,
        description=payload.description,
        image_url=payload.image_url,
        video_url=payload.video_url,
        cook_time=payload.cook_time,
        servings=payload.servings,
        difficulty=payload.difficulty,
        category_id=category.id,
        author_id=user.id
    )
    db.add(recipe)
    db.flush()

    for name in payload.ingredients:
        ingredient = db.scalar(select(Ingredient).where(Ingredient.name == name))
        if not ingredient:
            ingredient = Ingredient(name=name)
            db.add(ingredient)
            db.flush()
        db.add(RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ingredient.id,
            amount=""
        ))

    db.add_all(
        CookingStep(recipe_id=recipe.id, step_number=index, content=content)
        for index, content in enumerate(payload.steps, start=1)
    )
    db.commit()
    return chuyen_cong_thuc_thanh_json(recipe, co_chi_tiet=True)


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


@app.delete("/api/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def xoa_cong_thuc(
    recipe_id: int,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Không tìm thấy công thức")
    if recipe.author_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa công thức này")

    db.delete(recipe)
    db.commit()