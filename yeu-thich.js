const favoriteList = document.getElementById("favoriteList");
const favoriteStatus = document.getElementById("favoriteStatus");
const favoriteLogin = document.getElementById("favoriteLogin");
const favoriteRetry = document.getElementById("favoriteRetry");


function capNhatSoMonYeuThich() {
    const count = favoriteList.children.length;

    favoriteStatus.textContent = count > 0
        ? `Bạn đã lưu ${count} món yêu thích.`
        : "Bạn chưa lưu món yêu thích nào. Hãy chọn món ở trang Món ăn.";
}


function taoTheMonYeuThich(recipe) {
    const card = document.createElement("div");
    card.className = "mon-card";

    const link = document.createElement("a");
    link.className = "favorite-detail-link";
    link.href = `chi-tiet-mon.html?id=${recipe.id}`;

    const image = document.createElement("img");
    image.src = recipe.image_url || "images/Com chien.jpg";
    image.alt = recipe.title;
    image.loading = "lazy";

    const title = document.createElement("h2");
    title.textContent = recipe.title;

    const description = document.createElement("p");
    description.textContent = recipe.description || "";

    const category = document.createElement("span");
    category.textContent = recipe.category || "Món ăn";

    link.append(image, title, description, category);

    const removeButton = document.createElement("button");
    removeButton.className = "favorite-remove";
    removeButton.type = "button";
    removeButton.textContent = "♥ Bỏ yêu thích";
    removeButton.setAttribute(
        "aria-label",
        `Bỏ yêu thích món ${recipe.title}`
    );

    removeButton.onclick = async function () {
        if (removeButton.disabled) return;

        removeButton.disabled = true;

        try {
            await apiRequest(`/api/favorites/${recipe.id}`, {
                method: "DELETE"
            });

            card.remove();
            capNhatSoMonYeuThich();
        } catch (error) {
            favoriteStatus.textContent = error.message;
        } finally {
            removeButton.disabled = false;
        }
    };

    card.append(link, removeButton);
    return card;
}


async function taiDanhSachYeuThich() {
    favoriteList.replaceChildren();
    favoriteLogin.hidden = true;
    favoriteRetry.hidden = true;

    if (!localStorage.getItem("authToken")) {
        favoriteStatus.textContent =
            "Bạn cần đăng nhập để xem các món yêu thích.";
        favoriteLogin.hidden = false;
        return;
    }

    favoriteStatus.textContent = "Đang tải món yêu thích...";
    favoriteRetry.disabled = true;

    try {
        const recipes = await apiRequest("/api/favorites");

        if (!Array.isArray(recipes)) {
            throw new Error("Dữ liệu yêu thích không hợp lệ.");
        }

        const cards = recipes.map(taoTheMonYeuThich);
        favoriteList.replaceChildren(...cards);
        capNhatSoMonYeuThich();
    } catch (error) {
        favoriteList.replaceChildren();
        favoriteStatus.textContent = error.message;
        favoriteRetry.hidden = false;
        favoriteLogin.hidden = false;
    } finally {
        favoriteRetry.disabled = false;
    }
}


favoriteRetry.onclick = taiDanhSachYeuThich;
taiDanhSachYeuThich();