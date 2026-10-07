const API_URL = window.APP_CONFIG?.apiBaseUrl || "http://127.0.0.1:8000";
const thamSo = new URLSearchParams(window.location.search);

const recipeId = thamSo.get("id");
const tenMonCu = thamSo.get("mon");

const danhMucMap = {
    nuoc: "Món nước",
    canh: "Món canh",
    chien: "Món chiên",
    kho: "Món khô",
    xao: "Món xào",
    nuong: "Món nướng"
};

async function taiCongThucTuAPI() {
    try {
        const response = await fetch(`${API_URL}/api/recipes/${recipeId}`);

        if (!response.ok) {
            throw new Error("Không tìm thấy công thức");
        }

        const recipe = await response.json();
        hienThiCongThuc(recipe);
    } catch (error) {
        hienThiThongBaoLoi("Không thể lấy dữ liệu từ API. Hãy kiểm tra API đang chạy.");
    }
}

function taiCongThucCu() {
    const monCoSan = congThuc[tenMonCu];
    const savedRecipes = JSON.parse(localStorage.getItem("recipes") || "[]");

    const monDaLuu = savedRecipes.find(function (recipe) {
        return recipe.ten === tenMonCu;
    });

    if (!monCoSan && !monDaLuu) {
        hienThiThongBaoLoi("Không tìm thấy công thức.");
        return;
    }

    const recipe = monCoSan || monDaLuu;

    hienThiCongThuc({
        title: tenMonCu,
        description: recipe.moTa || "Công thức đơn giản, phù hợp cho bữa cơm gia đình.",
        image_url: recipe.anh,
        video_url: recipe.video,
        cook_time: recipe.thoiGian || "25 phút",
        servings: "2–4 người",
        difficulty: "Dễ",
        category: recipe.loai
            ? (danhMucMap[recipe.loai] || "Món ăn")
            : "Món ăn",
        ingredients: recipe.nguyenLieu || [],
        steps: recipe.cachLam || []
    });
}

function hienThiCongThuc(recipe) {
    const tenMon = recipe.title || "Món ăn";

    document.title = `${tenMon} - Hướng Dẫn Nấu Ăn`;

    document.getElementById("chiTietTenMon").textContent = tenMon;
    document.getElementById("chiTietAnh").src =
        recipe.image_url || "images/default-food.jpg";
    document.getElementById("chiTietAnh").alt = tenMon;

    document.getElementById("chiTietDanhMuc").textContent =
        recipe.category || "Món ăn";

    document.getElementById("chiTietMoTa").textContent =
        recipe.description || "Chưa có mô tả.";

    document.getElementById("chiTietThoiGian").textContent =
        recipe.cook_time || "Chưa cập nhật";
    document.getElementById("chiTietKhauPhan").textContent =
        recipe.servings || "Chưa cập nhật";
    document.getElementById("chiTietDoKho").textContent =
        recipe.difficulty || "Chưa cập nhật";

    hienThiNutQuanLyCongThuc(recipe);

    const danhSachNguyenLieu = document.getElementById("chiTietNguyenLieu");
    danhSachNguyenLieu.innerHTML = "";

    (recipe.ingredients || []).forEach(function (item) {
        const li = document.createElement("li");

        if (typeof item === "string") {
            li.textContent = item;
        } else {
            li.textContent = [item.amount, item.name].filter(Boolean).join(" ");
        }

        danhSachNguyenLieu.appendChild(li);
    });
    if (!recipe.ingredients?.length) {
    const li = document.createElement("li");
    li.textContent = "Chưa cập nhật nguyên liệu.";
    danhSachNguyenLieu.appendChild(li);
}
    const danhSachCachLam = document.getElementById("chiTietCachLam");
    danhSachCachLam.innerHTML = "";

    (recipe.steps || []).forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = typeof item === "string" ? item : item.content;
        danhSachCachLam.appendChild(li);
    });
    if (!recipe.steps?.length) {
    const li = document.createElement("li");
    li.textContent = "Chưa cập nhật cách làm.";
    danhSachCachLam.appendChild(li);
}
    const khungVideo = document.getElementById("khungVideo");

    khungVideo.replaceChildren();
    const videoId = layIdVideoYouTube(recipe.video_url);
    if (videoId) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.title = `Video hướng dẫn ${tenMon}`;
        iframe.allowFullscreen = true;
        khungVideo.appendChild(iframe);
    } else {
        const placeholder = document.createElement("p");
        placeholder.className = "video-chua-co";
        placeholder.textContent = "Món ăn này chưa có video hướng dẫn.";
        khungVideo.appendChild(placeholder);
    }
}

function layIdVideoYouTube(link) {
    if (!link) return null;

    try {
        const url = new URL(link);
        if (url.protocol !== "https:") return null;

        let videoId = null;
        if (url.hostname === "youtu.be") {
            videoId = url.pathname.slice(1);
        } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
            if (url.pathname === "/watch") {
                videoId = url.searchParams.get("v");
            } else {
                const match = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})$/);
                videoId = match?.[1] || null;
            }
        }

        return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
    } catch {
        return null;
    }
}

function hienThiNutQuanLyCongThuc(recipe) {
    const actions = document.getElementById("recipeOwnerActions");
    const currentUser = getCurrentUser();
    if (!recipe.id || !currentUser || currentUser.username !== recipe.author) return;

    const editLink = document.getElementById("editRecipeLink");
    const deleteButton = document.getElementById("deleteRecipeButton");
    editLink.href = `dang-cong-thuc.html?id=${recipe.id}`;
    actions.hidden = false;

    deleteButton.addEventListener("click", async function () {
        if (!confirm("Bạn có chắc muốn xóa công thức này không?")) return;

        deleteButton.disabled = true;
        try {
            await apiRequest(`/api/recipes/${recipe.id}`, { method: "DELETE" });
            window.location.href = "mon-an.html";
        } catch (error) {
            alert(error.message);
            deleteButton.disabled = false;
        }
    });
}

function hienThiThongBaoLoi(noiDung) {
    document.querySelector(".chi-tiet-mon").innerHTML = `
        <h1>Không thể hiển thị công thức</h1>
        <p>${noiDung}</p>
        <a class="nut-quay-lai" href="mon-an.html">← Quay lại</a>
    `;
}

if (recipeId) {
    taiCongThucTuAPI();
} else {
    taiCongThucCu();
}