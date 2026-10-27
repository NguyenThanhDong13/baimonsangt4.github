async function loadAdminPage() {
    const message = document.getElementById("adminMessage");
    const content = document.getElementById("adminContent");
    const tableBody = document.getElementById("userTableBody");

    content.hidden = true;

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

            function addCell(text) {
                const cell = document.createElement("td");
                cell.textContent = text;
                cell.style.padding = "12px";
                cell.style.borderBottom = "1px solid #ddd";
                row.appendChild(cell);
                return cell;
            }

            addCell(String(user.id));
            addCell(user.username);
            addCell(user.role);

            const statusCell = addCell("");
            const actionCell = addCell("");

            function updateStatus() {
                statusCell.textContent = user.is_active
                    ? "Hoạt động"
                    : "Đã khóa";
            }

            updateStatus();

            if (
                user.role !== "user" ||
                user.id === currentUser.id ||
                user.username === "__sample_recipes__"
            ) {
                actionCell.textContent = "—";
            } else {
                const button = document.createElement("button");
                button.type = "button";
                button.style.padding = "8px 12px";
                button.style.cursor = "pointer";

                function updateButton() {
                    button.textContent = user.is_active
                        ? "Khóa"
                        : "Mở khóa";
                }

                updateButton();

                button.onclick = async function () {
                    const nextActive = !user.is_active;
                    const action = nextActive ? "mở khóa" : "khóa";

                    if (!confirm(
                        `Bạn muốn ${action} tài khoản ${user.username}?`
                    )) {
                        return;
                    }

                    button.disabled = true;
                    message.textContent = "Đang cập nhật...";

                    try {
                        const updated = await apiRequest(
                            `/api/admin/users/${user.id}/status`,
                            {
                                method: "PATCH",
                                body: JSON.stringify({
                                    is_active: nextActive
                                })
                            }
                        );

                        user.is_active = updated.is_active;
                        updateStatus();
                        updateButton();
                        message.textContent =
                            `Đã ${action} tài khoản ${user.username}.`;
                    } catch (error) {
                        message.textContent = error.message;
                    } finally {
                        button.disabled = false;
                    }
                };

                actionCell.appendChild(button);
            }

            tableBody.appendChild(row);
        });

        content.hidden = false;
        message.textContent =
            `Có ${users.length} tài khoản trong hệ thống.`;
    } catch (error) {
        content.hidden = true;
        message.textContent = error.message;
    }
}

loadAdminPage();