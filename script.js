const API_BASE_URL = window.APP_CONFIG?.apiBaseUrl || "http://127.0.0.1:8000";

async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";

    const token = localStorage.getItem("authToken");
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch {
        throw new Error("Không thể kết nối máy chủ. Hãy kiểm tra backend đang chạy.");
    }

    const result = response.status === 204
        ? null
        : await response.json().catch(() => null);

    if (!response.ok) {
        const detail = result?.detail;
        const message = Array.isArray(detail)
            ? detail.map(item => item.msg).join(" ")
            : detail || "Yêu cầu không thành công.";
        throw new Error(message);
    }

    return result;
}

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
        localStorage.removeItem("authToken");
    }
}

function updateAuthUI() {
    const authLink = document.querySelector(".auth-link");
    const recipeLink = document.querySelector(".recipe-link");
    const currentUser = localStorage.getItem("authToken")
        ? getCurrentUser()
        : null;

    if (!authLink) return;

    if (currentUser) {
        authLink.textContent = `Xin chào, ${currentUser.username}`;
        authLink.href = "#";
        authLink.addEventListener("click", async function (event) {
            event.preventDefault();
            if (confirm("Bạn muốn đăng xuất?")) {
                try {
                    await apiRequest("/api/auth/logout", { method: "POST" });
                } catch {
                    // Dù API không sẵn sàng, phiên trên trình duyệt vẫn được xóa.
                }
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
    const title = document.getElementById("authTitle");
    const subtitle = document.getElementById("authSubtitle");
    const loginMode = document.getElementById("loginMode");
    const registerMode = document.getElementById("registerMode");
    const confirmPasswordField = document.getElementById("confirmPasswordField");
    const confirmPassword = document.getElementById("confirmPassword");
    const submitButton = document.getElementById("authSubmit");
    let isRegistering = false;

    function setMode(registering) {
        isRegistering = registering;
        title.textContent = registering ? "Đăng ký" : "Đăng nhập";
        subtitle.textContent = registering
            ? "Tạo tài khoản để chia sẻ công thức món ăn của bạn."
            : "Đăng nhập để đăng công thức món ăn của bạn.";
        submitButton.textContent = registering ? "Tạo tài khoản" : "Đăng nhập";
        confirmPasswordField.hidden = !registering;
        confirmPassword.required = registering;
        document.getElementById("password").autocomplete = registering
            ? "new-password"
            : "current-password";
        loginMode.setAttribute("aria-pressed", String(!registering));
        registerMode.setAttribute("aria-pressed", String(registering));
        message.textContent = "";
    }

    loginMode.addEventListener("click", () => setMode(false));
    registerMode.addEventListener("click", () => setMode(true));

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        if (!username || !password) {
            message.textContent = "Vui lòng nhập đầy đủ thông tin.";
            message.style.color = "#b00020";
            return;
        }

        if (isRegistering && password !== confirmPassword.value) {
            message.textContent = "Mật khẩu xác nhận không khớp.";
            message.style.color = "#b00020";
            return;
        }

        try {
            const result = await apiRequest(
                isRegistering ? "/api/auth/register" : "/api/auth/login",
                {
                    method: "POST",
                    body: JSON.stringify({ username, password })
                }
            );
            localStorage.setItem("authToken", result.access_token);
            setCurrentUser(result.user);
            message.textContent = isRegistering
                ? "Tạo tài khoản thành công!"
                : "Đăng nhập thành công!";
            message.style.color = "#2e7d32";
            setTimeout(() => {
                window.location.href = "dang-cong-thuc.html";
            }, 500);
        } catch (error) {
            message.textContent = error.message;
            message.style.color = "#b00020";
        }
    });
}

async function setupRecipeForm() {
    const form = document.getElementById("recipeForm");
    if (!form) return;

    const message = document.getElementById("recipeMessage");
    const resultLink = document.getElementById("recipeResultLink");
    const formTitle = document.getElementById("recipeFormTitle");
    const submitButton = form.querySelector('button[type="submit"]');
    const recipeId = new URLSearchParams(window.location.search).get("id");
    const currentUser = localStorage.getItem("authToken")
        ? getCurrentUser()
        : null;
    const setFormEnabled = enabled => {
        form.querySelectorAll("input, textarea, select, button").forEach(el => {
            el.disabled = !enabled;
        });
    };

    if (!currentUser) {
        message.textContent = "Bạn cần đăng nhập để đăng công thức.";
        message.style.color = "#b00020";
        setFormEnabled(false);
        return;
    }

    if (recipeId) {
        setFormEnabled(false);
        message.textContent = "Đang tải công thức...";
        message.style.color = "";

        try {
            const recipe = await apiRequest(`/api/recipes/${recipeId}`);
            if (recipe.author !== currentUser.username) {
                throw new Error("Bạn không có quyền sửa công thức này.");
            }

            document.getElementById("recipeName").value = recipe.title || "";
            document.getElementById("recipeCategory").value = recipe.category_code || "";
            document.getElementById("recipeDescription").value = recipe.description || "";
            document.getElementById("recipeCookTime").value = recipe.cook_time || "";
            document.getElementById("recipeServings").value = recipe.servings || "";
            document.getElementById("recipeDifficulty").value = recipe.difficulty || "";
            document.getElementById("recipeIngredients").value = (recipe.ingredients || [])
                .map(item => typeof item === "string" ? item : [item.amount, item.name].filter(Boolean).join(" "))
                .join("\n");
            document.getElementById("recipeSteps").value = (recipe.steps || [])
                .map(item => typeof item === "string" ? item : item.content)
                .join("\n");
            document.getElementById("recipeImage").value = recipe.image_url || "";
            document.getElementById("recipeVideo").value = recipe.video_url || "";
            formTitle.textContent = "Sửa công thức";
            submitButton.textContent = "Lưu thay đổi";
            message.textContent = "";
            setFormEnabled(true);
        } catch (error) {
            message.textContent = error.message;
            message.style.color = "#b00020";
            setFormEnabled(false);
            return;
        }
    }

    form.addEventListener("submit", async function (event) {
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
        const recipeImage = document.getElementById("recipeImage").value.trim();
        const recipeVideo = document.getElementById("recipeVideo").value.trim();

        if (!recipeName || !recipeCategory || !recipeDescription || recipeIngredients.length === 0 || recipeSteps.length === 0) {
            message.textContent = "Vui lòng điền đầy đủ thông tin.";
            message.style.color = "#b00020";
            return;
        }

        submitButton.disabled = true;
        try {
            const recipe = await apiRequest(
                recipeId ? `/api/recipes/${recipeId}` : "/api/recipes",
                {
                    method: recipeId ? "PUT" : "POST",
                    body: JSON.stringify({
                        title: recipeName,
                        category: recipeCategory,
                        description: recipeDescription,
                        image_url: recipeImage || "images/Com chien.jpg",
                        video_url: recipeVideo || null,
                        cook_time: document.getElementById("recipeCookTime").value.trim() || null,
                        servings: document.getElementById("recipeServings").value.trim() || null,
                        difficulty: document.getElementById("recipeDifficulty").value.trim() || null,
                        ingredients: recipeIngredients,
                        steps: recipeSteps
                    })
                }
            );
            message.textContent = recipeId
                ? "Cập nhật công thức thành công!"
                : "Đăng công thức thành công!";
            message.style.color = "#2e7d32";
            if (!recipeId) form.reset();
            resultLink.replaceChildren();
            const detailsLink = document.createElement("a");
            detailsLink.href = `chi-tiet-mon.html?id=${recipe.id}`;
            detailsLink.textContent = "Xem công thức";
            resultLink.appendChild(detailsLink);
            resultLink.hidden = false;
        } catch (error) {
            message.textContent = error.message;
            message.style.color = "#b00020";
        } finally {
            submitButton.disabled = false;
        }
    });
}

async function renderSavedRecipes() {
    const danhSach = document.querySelector(".danh-sach-mon");
    if (!danhSach) return;

    let savedRecipes;
    try {
        savedRecipes = await apiRequest("/api/recipes");
     } catch (error) {
        console.error(error.message);

        danhSach.replaceChildren();
        danhSach.hidden = false;

        const thongBao = document.createElement("p");
        thongBao.setAttribute("role", "alert");
        thongBao.textContent =
            "Không thể kết nối máy chủ để tải món ăn. Vui lòng thử lại sau.";
        danhSach.appendChild(thongBao);

        const soKetQua = document.getElementById("soKetQua");
        if (soKetQua) soKetQua.textContent = "";

        const khongCoKetQua = document.getElementById("khongCoKetQua");
        if (khongCoKetQua) khongCoKetQua.hidden = true;

        return false;
    }
    // Thay các thẻ món HTML bằng danh sách đã tải từ database.
    danhSach.replaceChildren();
    savedRecipes.forEach(function (recipe) {
        const card = document.createElement("div");
        const recipeId = recipe.id;

        card.className = "mon-card recipe-card";
        card.dataset.recipeId = recipeId;
        const image = document.createElement("img");
        image.src = recipe.image_url || "images/Com chien.jpg";
        image.alt = recipe.title;
        const title = document.createElement("h2");
        title.textContent = recipe.title;
        const description = document.createElement("p");
        description.textContent = recipe.description || "";
        const category = document.createElement("span");
        category.textContent = recipe.category;
        card.append(image, title, description, category);

        card.addEventListener("click", function (event) {
            if (event.target.closest(".recipe-card-actions")) {
                return;
            }
            window.location.href = `chi-tiet-mon.html?id=${recipeId}`;
        });

        const currentUser = getCurrentUser();
        if (currentUser && currentUser.username === recipe.author) {
            const actions = document.createElement("div");
            actions.className = "recipe-card-actions";
            actions.addEventListener("click", event => event.stopPropagation());

            const editLink = document.createElement("a");
            editLink.className = "edit-recipe-btn";
            editLink.href = `dang-cong-thuc.html?id=${recipeId}`;
            editLink.textContent = "Sửa";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-recipe-btn";
            deleteButton.textContent = "Xóa";
            deleteButton.addEventListener("click", async function (event) {
                event.stopPropagation();
                if (!confirm("Bạn có chắc muốn xóa công thức này không?")) return;
                try {
                    await apiRequest(`/api/recipes/${recipeId}`, { method: "DELETE" });
                    card.remove();
                } catch (error) {
                    alert(error.message);
                }
            });
            actions.append(editLink, deleteButton);
            card.appendChild(actions);
        }

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

async function initApp() {
    updateAuthUI();
    setupLogin();
    await setupRecipeForm();
    const ketQuaTaiMon = await renderSavedRecipes();
    if (ketQuaTaiMon !== false) {
        khoiTaoTimKiem();
    }
}

// Đợi HTML tải xong rồi mới tìm các phần tử.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}