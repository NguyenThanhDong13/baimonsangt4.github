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


// ---------- Tải công thức ----------

async function taiCongThucTuAPI() {
    let response;

    try {
        response = await fetch(
            `${API_URL}/api/recipes/${recipeId}`
        );
    } catch {
        hienThiThongBaoLoi(
            "Không thể kết nối máy chủ. Vui lòng thử lại sau."
        );
        return;
    }

    if (response.status === 404) {
        hienThiThongBaoLoi(
            "Công thức không tồn tại hoặc đã bị xóa."
        );
        return;
    }

    if (!response.ok) {
        hienThiThongBaoLoi(
            "Máy chủ không thể tải công thức. Vui lòng thử lại sau."
        );
        return;
    }

    try {
        const recipe = await response.json();
        hienThiCongThuc(recipe);
    } catch (error) {
        console.error(error);
        hienThiThongBaoLoi(
            "Không thể hiển thị dữ liệu công thức."
        );
    }
}


function taiCongThucCu() {
    const monCoSan = congThuc[tenMonCu];
    const savedRecipes = getLocalStorage("recipes", []);

    const monDaLuu = Array.isArray(savedRecipes)
        ? savedRecipes.find(recipe => recipe.ten === tenMonCu)
        : null;

    if (!monCoSan && !monDaLuu) {
        hienThiThongBaoLoi("Không tìm thấy công thức.");
        return;
    }

    const recipe = monCoSan || monDaLuu;

    hienThiCongThuc({
        title: tenMonCu,
        description:
            recipe.moTa ||
            "Công thức đơn giản, phù hợp cho bữa cơm gia đình.",
        image_url: recipe.anh,
        video_url: recipe.video,
        cook_time: recipe.thoiGian || null,
        servings: null,
        difficulty: null,
        category: recipe.loai
            ? (danhMucMap[recipe.loai] || "Món ăn")
            : "Món ăn",
        ingredients: recipe.nguyenLieu || [],
        steps: recipe.cachLam || []
    });
}


// ---------- Hiển thị công thức ----------

let congThucDangXem = null;
let khauPhanCoBan = 4;

function chuyenSo(frac) {
    if (!frac) return null;
    if (frac.includes("/")) {
        const [tu, mau] = frac.split("/").map(Number);
        return mau ? tu / mau : null;
    }
    return Number(String(frac).replace(",", "."));
}

function dinhDangSo(value) {
    const lamTron = Math.round(value * 100) / 100;
    const nguyen = Math.round(lamTron);
    if (Math.abs(lamTron - nguyen) < 0.01) return String(nguyen);
    return String(lamTron).replace(".", ",");
}

function layKhauPhanCoBan(servings) {
    const match = String(servings || "").match(/\d+(?:[.,]\d+)?/);
    const parsed = match ? Number(match[0].replace(",", ".")) : 4;
    return parsed > 0 ? parsed : 4;
}

function scaleIngredientAmount(amount, ratio) {
    if (typeof amount !== "string") return amount;
    const match = amount.trim().match(/^([0-9]+(?:[.,][0-9]+)?(?:\/[0-9]+)?)(.*)$/);
    if (!match) return amount;
    const value = chuyenSo(match[1]);
    return value === null ? amount : `${dinhDangSo(value * ratio)}${match[2]}`;
}

function hienThiNguyenLieuTheoNguoi(servings) {
    const list = document.getElementById("chiTietNguyenLieu");
    if (!list || !congThucDangXem) return;
    list.replaceChildren();

    const ingredients = congThucDangXem.ingredients || [];
    const ratio = servings / khauPhanCoBan;
    ingredients.forEach(function (item) {
        const li = document.createElement("li");
        if (typeof item === "string") {
            li.textContent = scaleIngredientAmount(item, ratio);
        } else {
            if (item.amount) {
                li.textContent = [scaleIngredientAmount(item.amount, ratio), item.name]
                    .filter(Boolean).join(" ");
            } else {
                li.textContent = scaleIngredientAmount(item.name, ratio);
            }
        }
        list.appendChild(li);
    });

    if (!ingredients.length) {
        const li = document.createElement("li");
        li.textContent = "Chưa cập nhật nguyên liệu.";
        list.appendChild(li);
    }

    const portionNote = document.getElementById("ghiChuKhauPhan");
    if (portionNote) {
        portionNote.textContent = `Nguyên liệu đã được điều chỉnh cho ${servings} người từ công thức gốc ${khauPhanCoBan} người.`;
    }
}

function khoiTaoBoChonKhauPhan() {
    const select = document.getElementById("soNguoiAn");
    if (!select) return;
    let saved = Number(localStorage.getItem("familyServing"));
    if (!saved || saved < 1 || saved > 10) saved = khauPhanCoBan <= 10 ? khauPhanCoBan : 4;
    select.value = String(saved);

    const update = () => {
        const count = Math.max(1, Math.min(10, Number(select.value)));
        localStorage.setItem("familyServing", String(count));
        document.getElementById("chiTietKhauPhan").textContent = `${count} người`;
        hienThiNguyenLieuTheoNguoi(count);
    };

    select.onchange = update;
    document.getElementById("giamNguoiAn").onclick = () => {
        select.value = String(Math.max(1, Number(select.value) - 1)); update();
    };
    document.getElementById("tangNguoiAn").onclick = () => {
        select.value = String(Math.min(10, Number(select.value) + 1)); update();
    };
    update();
}

function hienThiCongThuc(recipe) {
    congThucDangXem = recipe;
    khauPhanCoBan = layKhauPhanCoBan(recipe.servings);
    const tenMon = recipe.title || "Món ăn";

    document.title = `${tenMon} - Hướng Dẫn Nấu Ăn`;

    document.getElementById("chiTietTenMon").textContent = tenMon;

    const anh = document.getElementById("chiTietAnh");
    anh.src = recipe.image_url || "images/Com chien.jpg";
    anh.alt = tenMon;

    document.getElementById("chiTietDanhMuc").textContent =
        recipe.category || "Món ăn";

    document.getElementById("chiTietMoTa").textContent =
        recipe.description || "Chưa có mô tả.";

    document.getElementById("chiTietThoiGian").textContent =
        recipe.cook_time || "Chưa cập nhật";

    khoiTaoBoChonKhauPhan();

    document.getElementById("chiTietDoKho").textContent =
        recipe.difficulty || "Chưa cập nhật";

    hienThiNutQuanLyCongThuc(recipe);

    const danhSachCachLam =
        document.getElementById("chiTietCachLam");
    danhSachCachLam.replaceChildren();

    (recipe.steps || []).forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = typeof item === "string"
            ? item
            : item.content;

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
        placeholder.textContent =
            "Món ăn này chưa có video hướng dẫn.";
        khungVideo.appendChild(placeholder);
    }

    // Lỗi nút yêu thích không làm mất nội dung công thức.
    khoiTaoNutYeuThich(recipe).catch(function (error) {
        console.error("Không thể khởi tạo nút yêu thích:", error);
    });
}


// ---------- Video YouTube ----------

function layIdVideoYouTube(link) {
    if (!link) return null;

    try {
        const url = new URL(link);
        if (url.protocol !== "https:") return null;

        let videoId = null;

        if (url.hostname === "youtu.be") {
            videoId = url.pathname.slice(1);
        } else if (
            ["youtube.com", "www.youtube.com", "m.youtube.com"]
                .includes(url.hostname)
        ) {
            if (url.pathname === "/watch") {
                videoId = url.searchParams.get("v");
            } else {
                const match = url.pathname.match(
                    /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})$/
                );
                videoId = match?.[1] || null;
            }
        }

        return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)
            ? videoId
            : null;
    } catch {
        return null;
    }
}


// ---------- Sửa và xóa công thức ----------

function hienThiNutQuanLyCongThuc(recipe) {
    const actions = document.getElementById("recipeOwnerActions");
    if (!actions) return;

    actions.hidden = true;

    const currentUser = getCurrentUser();

    if (
        !recipe.id ||
        !localStorage.getItem("authToken") ||
        !currentUser ||
        currentUser.username !== recipe.author
    ) {
        return;
    }

    const editLink = document.getElementById("editRecipeLink");
    const deleteButton = document.getElementById("deleteRecipeButton");

    editLink.href = `dang-cong-thuc.html?id=${recipe.id}`;
    actions.hidden = false;

    deleteButton.onclick = async function () {
        if (deleteButton.disabled) return;

        if (!confirm("Bạn có chắc muốn xóa công thức này không?")) {
            return;
        }

        deleteButton.disabled = true;

        try {
            await apiRequest(`/api/recipes/${recipe.id}`, {
                method: "DELETE"
            });
            window.location.href = "mon-an.html";
        } catch (error) {
            alert(error.message);
            deleteButton.disabled = false;
        }
    };
}


// ---------- Lưu và bỏ yêu thích ----------

async function khoiTaoNutYeuThich(recipe) {
    const nut = document.querySelector(".nut-yeu-thich");
    if (!nut) return;

    let thongBao = document.getElementById("favoriteMessage");

    if (!thongBao) {
        thongBao = document.createElement("p");
        thongBao.id = "favoriteMessage";
        thongBao.setAttribute("role", "status");
        nut.insertAdjacentElement("afterend", thongBao);
    }

    thongBao.textContent = "";
    nut.onclick = null;
    nut.disabled = false;

    if (!recipe.id) {
        nut.disabled = true;
        thongBao.textContent =
            "Mở món từ trang Món ăn để lưu yêu thích.";
        return;
    }

    let daLuu = false;
    let daTai = false;

    function capNhatNut() {
        nut.textContent = daLuu
            ? "♥ Bỏ yêu thích"
            : "♡ Lưu công thức";

        nut.setAttribute("aria-pressed", String(daLuu));
    }

    async function taiTrangThai() {
        nut.disabled = true;
        thongBao.textContent =
            "Đang kiểm tra trạng thái yêu thích...";

        try {
            const danhSach = await apiRequest("/api/favorites");

            if (!Array.isArray(danhSach)) {
                throw new Error("Dữ liệu yêu thích không hợp lệ.");
            }

            daLuu = danhSach.some(mon => mon.id === recipe.id);
            daTai = true;
            capNhatNut();
            thongBao.textContent = "";
        } catch (error) {
            daTai = false;
            nut.textContent = "Thử lại";
            thongBao.textContent = error.message;
        } finally {
            nut.disabled = false;
        }
    }

    nut.onclick = async function () {
        if (nut.disabled) return;

        if (!localStorage.getItem("authToken")) {
            alert("Bạn cần đăng nhập để lưu món yêu thích.");
            window.location.href = "dang-nhap.html";
            return;
        }

        if (!daTai) {
            await taiTrangThai();
            return;
        }

        nut.disabled = true;
        thongBao.textContent = "";

        try {
            await apiRequest(`/api/favorites/${recipe.id}`, {
                method: daLuu ? "DELETE" : "PUT"
            });

            daLuu = !daLuu;
            capNhatNut();

            thongBao.textContent = daLuu
                ? "Đã lưu món vào yêu thích."
                : "Đã bỏ món khỏi yêu thích.";
        } catch (error) {
            thongBao.textContent = error.message;
        } finally {
            nut.disabled = false;
        }
    };

    capNhatNut();

    if (localStorage.getItem("authToken")) {
        await taiTrangThai();
    }
}


// ---------- Thông báo lỗi ----------

function hienThiThongBaoLoi(noiDung) {
    const main = document.querySelector(".chi-tiet-mon");
    if (!main) return;

    const title = document.createElement("h1");
    title.textContent = "Không thể hiển thị công thức";

    const message = document.createElement("p");
    message.textContent = noiDung;

    const backLink = document.createElement("a");
    backLink.className = "nut-quay-lai";
    backLink.href = "mon-an.html";
    backLink.textContent = "← Quay lại";

    main.replaceChildren(title, message, backLink);
}


// ---------- Khởi động trang ----------

if (recipeId) {
    taiCongThucTuAPI();
} else {
    taiCongThucCu();
}