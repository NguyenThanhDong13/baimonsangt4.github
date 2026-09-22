// Mở và đóng hộp gợi ý ở trang chủ.
function moGoiY() {
    const hop = document.getElementById("hopGoiY");
    if (hop) hop.style.display = "flex";
}

function dongGoiY() {
    const hop = document.getElementById("hopGoiY");
    if (hop) hop.style.display = "none";
}

function getLocalStorage(key, fallback = []) {
    try {
        const data = JSON.parse(localStorage.getItem(key));
        return data ?? fallback;
    } catch {
        return fallback;
    }
}

function saveLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getCurrentUser() {
    return getLocalStorage("currentUser", null);
}

function setCurrentUser(user) {
    if (user) {
        saveLocalStorage("currentUser", user);
    } else {
        localStorage.removeItem("currentUser");
    }
}

function updateAuthUI() {
    const authLink = document.querySelector(".auth-link");
    const recipeLink = document.querySelector(".recipe-link");
    const currentUser = getCurrentUser();

    if (!authLink) return;

    if (currentUser) {
        authLink.textContent = `Xin chào, ${currentUser.username}`;
        authLink.href = "#";
        authLink.addEventListener("click", function (event) {
            event.preventDefault();
            if (confirm("Bạn muốn đăng xuất?")) {
                setCurrentUser(null);
                updateAuthUI();
                window.location.href = "index.html";
            }
        }, { once: true });
    } else {
        authLink.textContent = "Đăng nhập";
        authLink.href = "dang-nhap.html";
    }

    if (recipeLink) {
        recipeLink.href = currentUser ? "dang-cong-thuc.html" : "dang-nhap.html";
    }
}

function setupLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    const message = document.getElementById("loginMessage");
    const users = getLocalStorage("users", [
        { username: "demo", password: "123456" }
    ]);

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!username || !password) {
            message.textContent = "Vui lòng nhập đầy đủ thông tin.";
            message.style.color = "#b00020";
            return;
        }

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            setCurrentUser({ username: user.username });
            message.textContent = "Đăng nhập thành công!";
            message.style.color = "#2e7d32";
            setTimeout(() => {
                window.location.href = "dang-cong-thuc.html";
            }, 500);
            return;
        }

        const existedUser = users.some(u => u.username === username);

        if (existedUser) {
            message.textContent = "Mật khẩu không đúng.";
            message.style.color = "#b00020";
            return;
        }

        users.push({ username, password });
        saveLocalStorage("users", users);
        setCurrentUser({ username });
        message.textContent = "Tạo tài khoản thành công!";
        message.style.color = "#2e7d32";
        setTimeout(() => {
            window.location.href = "dang-cong-thuc.html";
        }, 500);
    });
}

function setupRecipeForm() {
    const form = document.getElementById("recipeForm");
    if (!form) return;

    const message = document.getElementById("recipeMessage");
    const currentUser = getCurrentUser();

    if (!currentUser) {
        message.textContent = "Bạn cần đăng nhập để đăng công thức.";
        message.style.color = "#b00020";
        form.querySelectorAll("input, textarea, select, button").forEach(el => {
            el.disabled = true;
        });
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const recipeName = document.getElementById("recipeName").value.trim();
        const recipeCategory = document.getElementById("recipeCategory").value;
        const recipeDescription = document.getElementById("recipeDescription").value.trim();
        const recipeIngredients = document.getElementById("recipeIngredients").value
            .split(/\n+/)
            .map(item => item.trim())
            .filter(Boolean);
        const recipeSteps = document.getElementById("recipeSteps").value
            .split(/\n+/)
            .map(item => item.trim())
            .filter(Boolean);
        const recipeImage = document.getElementById("recipeImage").value.trim() || "images/default-food.jpg";

        if (!recipeName || !recipeCategory || !recipeDescription || recipeIngredients.length === 0 || recipeSteps.length === 0) {
            message.textContent = "Vui lòng điền đầy đủ thông tin.";
            message.style.color = "#b00020";
            return;
        }

        const recipes = getLocalStorage("recipes", []);

        recipes.unshift({
            id: Date.now() + "-" + Math.random().toString(16).slice(2),
            ten: recipeName,
            loai: recipeCategory,
            moTa: recipeDescription,
            anh: recipeImage,
            nguyenLieu: recipeIngredients,
            cachLam: recipeSteps,
            nguoiDang: currentUser.username
        });

        saveLocalStorage("recipes", recipes);
        message.textContent = "Đăng công thức thành công!";
        message.style.color = "#2e7d32";
        form.reset();
    });
}

function deleteRecipeById(recipeId) {
    const currentUser = getCurrentUser();
    const recipes = getLocalStorage("recipes", []);
    const remainingRecipes = recipes.filter(function (recipe) {
        const id = recipe.id || recipe.ten;
        return id !== recipeId;
    });

    saveLocalStorage("recipes", remainingRecipes);

    if (!currentUser) {
        return;
    }

    const danhSach = document.querySelector(".danh-sach-mon");
    if (danhSach) {
        const targetCard = danhSach.querySelector("[data-recipe-id='" + recipeId + "']");
        if (targetCard) {
            targetCard.remove();
        }
    }
}

function renderSavedRecipes() {
    const danhSach = document.querySelector(".danh-sach-mon");
    if (!danhSach) return;

    const savedRecipes = getLocalStorage("recipes", []);
    if (savedRecipes.length === 0) return;

    savedRecipes.forEach(function (recipe) {
        const card = document.createElement("div");
        const recipeId = recipe.id || recipe.ten;

        card.className = "mon-card recipe-card";
        card.dataset.recipeId = recipeId;
        card.innerHTML = `
            <img src="${recipe.anh || 'images/default-food.jpg'}" alt="${recipe.ten}">
            <h2>${recipe.ten}</h2>
            <p>${recipe.moTa}</p>
            <span>${getRecipeLabel(recipe.loai)}</span>
            <button type="button" class="delete-recipe-btn" data-recipe-id="${recipeId}">Xóa</button>
        `;

        const danhMucMap = {
            nuoc: "Món nước",
            canh: "Món canh",
            chien: "Món chiên",
            kho: "Món khô",
            xao: "Món xào",
            nuong: "Món nướng"
        };

        card.addEventListener("click", function (event) {
            if (event.target.closest(".delete-recipe-btn")) {
                return;
            }
            window.location.href = `chi-tiet-mon.html?mon=${encodeURIComponent(recipe.ten)}`;
        });

        const deleteButton = card.querySelector(".delete-recipe-btn");
        deleteButton.addEventListener("click", function (event) {
            event.stopPropagation();
            const currentUser = getCurrentUser();
            const recipeOwner = recipe.nguoiDang || "";

            if (!currentUser || currentUser.username !== recipeOwner) {
                alert("Bạn không có quyền xóa công thức này.");
                return;
            }

            const ok = confirm("Bạn có chắc muốn xóa công thức này không?");
            if (!ok) return;

            deleteRecipeById(recipeId);
            card.remove();
        });

        card.querySelector("span").textContent = danhMucMap[recipe.loai] || "Món ăn";
        danhSach.appendChild(card);
    });
}

function getRecipeLabel(category) {
    const labels = {
        nuoc: "Món nước",
        canh: "Món canh",
        chien: "Món chiên",
        kho: "Món khô",
        xao: "Món xào",
        nuong: "Món nướng"
    };
    return labels[category] || "Món ăn";
}

// Chuyển tiếng Việt có dấu thành không dấu để tìm kiếm.
// Ví dụ: "Phở Bò" -> "pho bo", "Đậu" -> "dau".
function chuanHoa(chuoi) {
    return chuoi
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function khoiTaoTimKiem() {
    const form = document.getElementById("formTimKiem");

    // Trang chủ không có form lọc nên không cần chạy phần này.
    if (!form) return;

    const input = document.getElementById("tuKhoa");
    const select = document.getElementById("locDanhMuc");
    const nutXoa = document.getElementById("xoaBoLoc");
    const soKetQua = document.getElementById("soKetQua");
    const khongCoKetQua = document.getElementById("khongCoKetQua");
    const danhSach = document.querySelector(".danh-sach-mon");

    const tenDanhMuc = {
        nuoc: "Món nước",
        canh: "Món canh",
        chien: "Món chiên",
        kho: "Món khô",
        xao: "Món xào",
        nuong: "Món nướng"
    };

    // Lấy toàn bộ món ăn có sẵn trong trang.
    const cacMon = Array.from(
        danhSach.querySelectorAll(".mon-card")
    ).map(function (theMon) {
        return {
            the: theMon,
            noiDung: chuanHoa(theMon.textContent),
            danhMuc: theMon.querySelector("span").textContent.trim()
        };
    });

    function locMonAn() {
        const tuKhoa = chuanHoa(input.value);
        const cacTu = tuKhoa.split(" ").filter(Boolean);
        const danhMucDangChon = select.value;

        let soMon = 0;

        cacMon.forEach(function (mon) {
            // Món phải chứa tất cả các từ người dùng nhập.
            const dungTuKhoa = cacTu.every(function (tu) {
                return mon.noiDung.includes(tu);
            });

            const dungDanhMuc =
                danhMucDangChon === "" ||
                mon.danhMuc === tenDanhMuc[danhMucDangChon];

            const hienThi = dungTuKhoa && dungDanhMuc;

            mon.the.hidden = !hienThi;

            if (hienThi) soMon++;
        });

        const noiDungTim = input.value.trim();

        soKetQua.textContent =
            `Hiển thị ${soMon}/${cacMon.length} món ăn` +
            (noiDungTim ? ` cho "${noiDungTim}"` : "") +
            ".";

        khongCoKetQua.hidden = soMon !== 0;
        danhSach.hidden = soMon === 0;
    }

    // Ghi từ khóa và danh mục lên URL để tải lại vẫn giữ bộ lọc.
    function capNhatURL() {
        const url = new URL(window.location.href);
        const tuKhoa = input.value.trim();

        if (tuKhoa) {
            url.searchParams.set("q", tuKhoa);
        } else {
            url.searchParams.delete("q");
        }

        if (select.value) {
            url.searchParams.set("loai", select.value);
        } else {
            url.searchParams.delete("loai");
        }

        try {
            window.history.replaceState(null, "", url);
        } catch {
            // Một số trình duyệt hạn chế đổi URL khi mở file trực tiếp.
            // Chức năng lọc vẫn hoạt động.
        }
    }

    function timKiem() {
        locMonAn();
        capNhatURL();
    }

    // Nhận từ khóa từ trang chủ hoặc danh mục từ URL.
    function docBoLocTuURL() {
        const params = new URLSearchParams(window.location.search);
        const loai = params.get("loai");

        input.value = params.get("q") || "";

        select.value = Object.prototype.hasOwnProperty.call(
            tenDanhMuc,
            loai
        ) ? loai : "";

        locMonAn();
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        timKiem();
    });

    // Lọc ngay khi người dùng nhập.
    input.addEventListener("input", timKiem);
    select.addEventListener("change", timKiem);

    nutXoa.addEventListener("click", function () {
        input.value = "";
        select.value = "";

        timKiem();
        input.focus();
    });

    window.addEventListener("popstate", docBoLocTuURL);

    docBoLocTuURL();
}

function initApp() {
    updateAuthUI();
    setupLogin();
    setupRecipeForm();
    renderSavedRecipes();
    khoiTaoTimKiem();
}

// Đợi HTML tải xong rồi mới tìm các phần tử.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}