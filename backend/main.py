import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, delete, inspect
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session as DatabaseSession

from database import Base, engine, SessionLocal
from models import (
    Category,
    Comment,
    CookingStep,
    Favorite,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User,
    UserSession
)


is_new_database = not inspect(engine).has_table("users")

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
            "http://127.0.0.1:5500,http://localhost:5500,"
            "http://127.0.0.1:3000,http://localhost:3000"
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


# ---------- Kiểm tra dữ liệu đầu vào ----------

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
        normalized = [
            value.strip()
            for value in values
            if value.strip()
        ]
        if not normalized:
            raise ValueError("Cần có ít nhất một dòng nội dung")
        return normalized


# ---------- Database và xác thực ----------

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

    return (
        f"pbkdf2_sha256${PASSWORD_ITERATIONS}"
        f"${salt.hex()}${digest.hex()}"
    )


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

        return hmac.compare_digest(
            candidate.hex(),
            digest_hex
        )
    except (ValueError, TypeError):
        return False


def issue_session(db: DatabaseSession, user: User) -> str:
    token = secrets.token_urlsafe(32)

    db.add(
        UserSession(
            token_hash=hashlib.sha256(
                token.encode("utf-8")
            ).hexdigest(),
            user_id=user.id,
            expires_at=datetime.utcnow() + SESSION_LIFETIME
        )
    )

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

    token_hash = hashlib.sha256(
        credentials.credentials.encode("utf-8")
    ).hexdigest()

    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == token_hash
        )
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

    user = session.user

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Tài khoản của bạn đã bị khóa"
        )

    return user
def require_admin(
    user: User = Depends(get_current_user)
) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền quản trị"
        )

    return user
@app.get("/api/admin/users")
def list_users(
    admin: User = Depends(require_admin),
    db: DatabaseSession = Depends(get_db)
):
    users = db.scalars(
        select(User).order_by(User.id)
    ).all()

    return [
                {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active
        }
        for user in users
    ]
def seed_categories() -> None:
    db = SessionLocal()
    try:
        existing = set(
            db.scalars(select(Category.name)).all()
        )

        db.add_all(
            Category(name=name)
            for name in DANH_MUC.values()
            if name not in existing
        )
        db.commit()
    finally:
        db.close()
class AccountStatusInput(BaseModel):
    is_active: bool


@app.patch("/api/admin/users/{user_id}/status")
def update_account_status(
    user_id: int,
    payload: AccountStatusInput,
    admin: User = Depends(require_admin),
    db: DatabaseSession = Depends(get_db)
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tài khoản"
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=403,
            detail="Bạn không thể khóa tài khoản của mình"
        )

    if user.role != "user":
        raise HTTPException(
            status_code=403,
            detail="Chỉ được khóa hoặc mở khóa tài khoản thường"
        )

    user.is_active = payload.is_active

    if not payload.is_active:
        db.execute(
            delete(UserSession).where(
                UserSession.user_id == user.id
            )
        )

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active
    }

seed_categories()
if is_new_database:
    from seed_recipes import main as seed_sample_recipes

    seed_sample_recipes(create_backup=False)


# ---------- Kiểm tra API ----------

@app.get("/")
def trang_chu_api():
    return {
        "message": "API Hướng Dẫn Nấu Ăn đang chạy"
    }


@app.get("/api/health")
def kiem_tra_api():
    with SessionLocal() as db:
        db.execute(select(1))

    return {"status": "ok"}


# ---------- Tài khoản ----------

@app.post(
    "/api/auth/register",
    status_code=status.HTTP_201_CREATED
)
def dang_ky(
    payload: Credentials,
    db: DatabaseSession = Depends(get_db)
):
    existing_user = db.scalar(
        select(User).where(
            User.username == payload.username
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Tên đăng nhập đã tồn tại"
        )

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
        "user": {
            "id": user.id,
            "username": user.username
        }
    }


@app.post("/api/auth/login")
def dang_nhap(
    payload: Credentials,
    db: DatabaseSession = Depends(get_db)
):
    user = db.scalar(
        select(User).where(
            User.username == payload.username
        )
    )

    if not user or not verify_password(
        payload.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Tên đăng nhập hoặc mật khẩu không đúng"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Tài khoản của bạn đã bị khóa"
        )
    
    token = issue_session(db, user)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username
        }
    }


@app.get("/api/auth/me")
def thong_tin_tai_khoan(
    user: User = Depends(get_current_user)
):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role
    }


@app.post("/api/auth/logout")
def dang_xuat(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: DatabaseSession = Depends(get_db)
):
    if credentials is not None:
        token_hash = hashlib.sha256(
            credentials.credentials.encode("utf-8")
        ).hexdigest()

        session = db.scalar(
            select(UserSession).where(
                UserSession.token_hash == token_hash
            )
        )

        if session:
            db.delete(session)
            db.commit()

    return {"message": "Đã đăng xuất"}


# ---------- Danh mục ----------

@app.get("/api/categories")
def lay_danh_sach_danh_muc():
    db = SessionLocal()
    try:
        categories = db.scalars(
            select(Category).order_by(Category.id)
        ).all()

        return [
            {
                "id": item.id,
                "name": item.name
            }
            for item in categories
        ]
    finally:
        db.close()


# ---------- Hàm xử lý công thức ----------

def chuyen_cong_thuc_thanh_json(
    recipe,
    co_chi_tiet=False
):
    data = {
        "id": recipe.id,
        "title": recipe.title,
        "description": recipe.description,
        "image_url": recipe.image_url,
        "cook_time": recipe.cook_time,
        "servings": recipe.servings,
        "difficulty": recipe.difficulty,
        "category": recipe.category.name,
        "category_code": next(
            (
                code
                for code, name in DANH_MUC.items()
                if name == recipe.category.name
            ),
            None
        ),
        "author": recipe.author.username
    }

    if co_chi_tiet:
        data["video_url"] = recipe.video_url

        data["ingredients"] = [
            {
                "name": link.ingredient.name,
                "amount": link.amount
            }
            for link in recipe.ingredient_links
        ]

        data["steps"] = [
            {
                "step_number": step.step_number,
                "content": step.content
            }
            for step in sorted(
                recipe.steps,
                key=lambda item: item.step_number
            )
        ]

    return data


def cap_nhat_noi_dung_cong_thuc(
    recipe: Recipe,
    payload: RecipeInput,
    category: Category,
    db: DatabaseSession
) -> None:
    recipe.title = payload.title
    recipe.description = payload.description
    recipe.image_url = payload.image_url
    recipe.video_url = payload.video_url
    recipe.cook_time = payload.cook_time
    recipe.servings = payload.servings
    recipe.difficulty = payload.difficulty
    recipe.category = category

    recipe.ingredient_links.clear()
    recipe.steps.clear()

    for name in payload.ingredients:
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
        CookingStep(
            step_number=index,
            content=content
        )
        for index, content in enumerate(
            payload.steps,
            start=1
        )
    )


# ---------- Công thức ----------

@app.get("/api/recipes")
def lay_danh_sach_cong_thuc():
    db = SessionLocal()
    try:
        recipes = db.scalars(
            select(Recipe).order_by(
                Recipe.id.desc()
            )
        ).all()

        return [
            chuyen_cong_thuc_thanh_json(recipe)
            for recipe in recipes
        ]
    finally:
        db.close()


@app.post(
    "/api/recipes",
    status_code=status.HTTP_201_CREATED
)
def tao_cong_thuc(
    payload: RecipeInput,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    category_name = DANH_MUC.get(
        payload.category,
        payload.category
    )

    if category_name not in DANH_MUC.values():
        raise HTTPException(
            status_code=400,
            detail="Danh mục không hợp lệ"
        )

    category = db.scalar(
        select(Category).where(
            Category.name == category_name
        )
    )

    if not category:
        raise HTTPException(
            status_code=400,
            detail="Danh mục chưa được khởi tạo"
        )

    recipe = Recipe(
        category=category,
        author=user
    )
    db.add(recipe)

    cap_nhat_noi_dung_cong_thuc(
        recipe,
        payload,
        category,
        db
    )
    db.commit()

    return chuyen_cong_thuc_thanh_json(
        recipe,
        co_chi_tiet=True
    )


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

        return chuyen_cong_thuc_thanh_json(
            recipe,
            co_chi_tiet=True
        )
    finally:
        db.close()


@app.put("/api/recipes/{recipe_id}")
def cap_nhat_cong_thuc(
    recipe_id: int,
    payload: RecipeInput,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    recipe = db.get(Recipe, recipe_id)

    if not recipe:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy công thức"
        )

    if recipe.author_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền sửa công thức này"
        )

    category_name = DANH_MUC.get(
        payload.category,
        payload.category
    )

    if category_name not in DANH_MUC.values():
        raise HTTPException(
            status_code=400,
            detail="Danh mục không hợp lệ"
        )

    category = db.scalar(
        select(Category).where(
            Category.name == category_name
        )
    )

    if not category:
        raise HTTPException(
            status_code=400,
            detail="Danh mục chưa được khởi tạo"
        )

    cap_nhat_noi_dung_cong_thuc(
        recipe,
        payload,
        category,
        db
    )
    db.commit()

    return chuyen_cong_thuc_thanh_json(
        recipe,
        co_chi_tiet=True
    )


@app.delete(
    "/api/recipes/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def xoa_cong_thuc(
    recipe_id: int,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    recipe = db.get(Recipe, recipe_id)

    if not recipe:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy công thức"
        )

    if recipe.author_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền xóa công thức này"
        )

    db.delete(recipe)
    db.commit()


# ---------- Yêu thích ----------

@app.get("/api/favorites")
def lay_mon_yeu_thich(
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    recipes = db.scalars(
        select(Recipe)
        .join(
            Favorite,
            Favorite.recipe_id == Recipe.id
        )
        .where(Favorite.user_id == user.id)
        .order_by(
            Favorite.created_at.desc(),
            Recipe.id.desc()
        )
    ).all()

    return [
        chuyen_cong_thuc_thanh_json(recipe)
        for recipe in recipes
    ]


@app.put("/api/favorites/{recipe_id}")
def luu_mon_yeu_thich(
    recipe_id: int,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    if db.get(Recipe, recipe_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy công thức"
        )

    statement = (
        sqlite_insert(Favorite)
        .values(
            user_id=user.id,
            recipe_id=recipe_id
        )
        .on_conflict_do_nothing(
            index_elements=["user_id", "recipe_id"]
        )
    )

    db.execute(statement)
    db.commit()

    return {
        "recipe_id": recipe_id,
        "is_favorite": True
    }


@app.delete(
    "/api/favorites/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def bo_mon_yeu_thich(
    recipe_id: int,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    db.execute(
        delete(Favorite).where(
            Favorite.user_id == user.id,
            Favorite.recipe_id == recipe_id
        )
    )
    db.commit()
    # ---------- Bình luận ----------

class CommentInput(BaseModel):
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "Nội dung bình luận không được để trống"
            )

        return value


def comment_json(comment):
    return {
        "id": comment.id,
        "recipe_id": comment.recipe_id,
        "user_id": comment.user_id,
        "username": comment.user.username,
        "content": comment.content,
        "created_at": comment.created_at.isoformat()
    }


@app.get("/api/recipes/{recipe_id}/comments")
def lay_binh_luan(
    recipe_id: int,
    db: DatabaseSession = Depends(get_db)
):
    if db.get(Recipe, recipe_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy công thức"
        )

    comments = db.scalars(
        select(Comment)
        .where(Comment.recipe_id == recipe_id)
        .order_by(
            Comment.created_at.desc(),
            Comment.id.desc()
        )
    ).all()

    return [
        comment_json(comment)
        for comment in comments
    ]


@app.post(
    "/api/recipes/{recipe_id}/comments",
    status_code=status.HTTP_201_CREATED
)
def gui_binh_luan(
    recipe_id: int,
    payload: CommentInput,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    if db.get(Recipe, recipe_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy công thức"
        )

    comment = Comment(
        recipe_id=recipe_id,
        user=user,
        content=payload.content
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    return comment_json(comment)


@app.delete(
    "/api/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def xoa_binh_luan(
    comment_id: int,
    user: User = Depends(get_current_user),
    db: DatabaseSession = Depends(get_db)
):
    comment = db.get(Comment, comment_id)

    if comment is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bình luận"
        )

    if comment.user_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền xóa bình luận này"
        )

    db.delete(comment)
    db.commit()