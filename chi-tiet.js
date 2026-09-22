const thamSo = new URLSearchParams(window.location.search);
const tenMon = thamSo.get("mon");
const mon = congThuc[tenMon];
const savedRecipes = JSON.parse(localStorage.getItem("recipes") || "[]");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const savedRecipe = savedRecipes.find(function (recipe) {
    return recipe.ten === tenMon;
});

const tenDanhMuc = {
    "Cơm chiên": "Món chiên",
    "Đậu xốt cà chua": "Món xào",
    "Canh xương khoai tây cà rốt": "Món canh",
    "Bún bò": "Món nước"
};

if (!mon && !savedRecipe) {
    document.querySelector(".chi-tiet-mon").innerHTML = `
        <h1>Không tìm thấy công thức</h1>
        <p>Món ăn này chưa có dữ liệu công thức.</p>
        <a class="nut-quay-lai" href="mon-an.html">← Quay lại</a>
    `;
} else {
    const recipeToShow = mon || savedRecipe;
    document.title = tenMon + " - Hướng Dẫn Nấu Ăn";

    document.getElementById("chiTietTenMon").textContent = tenMon;
    document.getElementById("chiTietAnh").src = recipeToShow.anh || "images/default-food.jpg";
    document.getElementById("chiTietAnh").alt = tenMon;
    document.getElementById("chiTietThoiGian").textContent = recipeToShow.thoiGian || "25 phút";
    document.getElementById("chiTietDanhMuc").textContent =
        recipeToShow.loai ? (function () {
            const danhMucMap = {
                nuoc: "Món nước",
                canh: "Món canh",
                chien: "Món chiên",
                kho: "Món khô",
                xao: "Món xào",
                nuong: "Món nướng"
            };
            return danhMucMap[recipeToShow.loai] || "Món ăn";
        })() : (tenDanhMuc[tenMon] || "Món ăn");

    document.getElementById("chiTietMoTa").textContent =
        recipeToShow.moTa || "Công thức đơn giản, phù hợp cho bữa cơm gia đình.";

    const danhSachNguyenLieu =
        document.getElementById("chiTietNguyenLieu");

    const nguyenLieu = recipeToShow.nguyenLieu || [];
    nguyenLieu.forEach(function (nguyenLieuItem) {
        const li = document.createElement("li");
        li.textContent = nguyenLieuItem;
        danhSachNguyenLieu.appendChild(li);
    });

    const danhSachCachLam =
        document.getElementById("chiTietCachLam");

    const cachLam = recipeToShow.cachLam || [];
    cachLam.forEach(function (buoc) {
        const li = document.createElement("li");
        li.textContent = buoc;
        danhSachCachLam.appendChild(li);
    });

    const khungVideo = document.getElementById("khungVideo");

    if (recipeToShow.video) {
        let linkVideo = recipeToShow.video;

        if (linkVideo.includes("watch?v=")) {
            linkVideo = linkVideo.replace("watch?v=", "embed/");
        } else if (linkVideo.includes("youtu.be/")) {
            const videoId = linkVideo.split("youtu.be/")[1].split("?")[0];
            linkVideo = "https://www.youtube.com/embed/" + videoId;
        }

        khungVideo.innerHTML = `
            <iframe
                src="${linkVideo}"
                title="Video hướng dẫn ${tenMon}"
                allowfullscreen>
            </iframe>
        `;
    } else {
        khungVideo.innerHTML = `
            <p class="video-chua-co">
                Món ăn này chưa có video hướng dẫn.
            </p>
        `;
    }

    if (savedRecipe && currentUser && currentUser.username === savedRecipe.nguoiDang) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "nut-xoa-cong-thuc";
        deleteButton.textContent = "🗑 Xóa công thức";
        deleteButton.addEventListener("click", function () {
            const ok = confirm("Bạn có chắc muốn xóa công thức này không?");
            if (!ok) return;

            const remaining = savedRecipes.filter(function (recipe) {
                return recipe.id !== savedRecipe.id && recipe.ten !== savedRecipe.ten;
            });
            localStorage.setItem("recipes", JSON.stringify(remaining));
            window.location.href = "mon-an.html";
        });

        const infoPanel = document.querySelector(".chi-tiet-thong-tin");
        if (infoPanel) {
            infoPanel.appendChild(deleteButton);
        }
    }
}