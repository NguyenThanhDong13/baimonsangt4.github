async function loadAdminPage() {
    const message = document.getElementById("adminMessage");
    const content = document.getElementById("adminContent");
    const tableBody = document.getElementById("userTableBody");

    if (!localStorage.getItem("authToken")) {
        message.textContent = "Bạn cần đăng nhập bằng tài khoản admin.";
        return;
    }

    try {
        const currentUser = await apiRequest("/api/auth/me");

        if (currentUser.role !== "admin") {
            message.textContent = "Bạn không có quyền truy cập trang quản trị.";
            return;
        }

        const users = await apiRequest("/api/admin/users");

        tableBody.replaceChildren();

        users.forEach(function (user) {
            const row = document.createElement("tr");

            [user.id, user.username, user.role].forEach(function (value) {
                const cell = document.createElement("td");
                cell.textContent = String(value);
                cell.style.padding = "12px";
                cell.style.borderBottom = "1px solid #ddd";
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        content.hidden = false;
        message.textContent = `Có ${users.length} tài khoản trong hệ thống.`;
    } catch (error) {
        content.hidden = true;
        message.textContent = error.message;
    }
}

loadAdminPage();