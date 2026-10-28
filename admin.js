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

        await loadPendingRecipes();
        content.hidden = false;
        message.textContent =
            `Có ${users.length} tài khoản trong hệ thống.`;
    } catch (error) {
        content.hidden = true;
        message.textContent = error.message;
    }
}

async function loadPendingRecipes() {
    const container = document.getElementById("pendingRecipeList");
    if (!container) return;

    try {
        const recipes = await apiRequest("/api/admin/recipes/pending");
        container.replaceChildren();

        if (!recipes.length) {
            const empty = document.createElement("p");
            empty.textContent = "Không có công thức nào đang chờ duyệt.";
            container.appendChild(empty);
            return;
        }

        recipes.forEach(function (recipe) {
            const card = document.createElement("article");
            card.className = "pending-recipe-card";

            const title = document.createElement("h3");
            title.textContent = recipe.title;
            card.appendChild(title);

            const author = document.createElement("p");
            author.textContent = `Người đăng: ${recipe.author}`;
            card.appendChild(author);

            const description = document.createElement("p");
            description.className = "pending-recipe-description";
            description.textContent = recipe.description || "Không có mô tả.";
            card.appendChild(description);

            const details = document.createElement("div");
            details.className = "pending-recipe-details";

            const meta = document.createElement("p");
            meta.textContent = [
                recipe.cook_time ? `Thời gian: ${recipe.cook_time}` : null,
                recipe.servings ? `Khẩu phần: ${recipe.servings}` : null
            ].filter(Boolean).join(" | ");
            details.appendChild(meta);

            const ingredientTitle = document.createElement("h4");
            ingredientTitle.textContent = "Nguyên liệu";
            details.appendChild(ingredientTitle);
            const ingredients = document.createElement("ul");
            (recipe.ingredients || []).forEach(function (ingredient) {
                const item = document.createElement("li");
                item.textContent = typeof ingredient === "string"
                    ? ingredient
                    : [ingredient.amount, ingredient.name].filter(Boolean).join(" ");
                ingredients.appendChild(item);
            });
            details.appendChild(ingredients);

            const stepTitle = document.createElement("h4");
            stepTitle.textContent = "Cách làm";
            details.appendChild(stepTitle);
            const steps = document.createElement("ol");
            (recipe.steps || []).forEach(function (step) {
                const item = document.createElement("li");
                item.textContent = typeof step === "string" ? step : step.content;
                steps.appendChild(item);
            });
            details.appendChild(steps);
            card.appendChild(details);

            const form = document.createElement("form");
            form.className = "moderation-form";

            const categoryLabel = document.createElement("label");
            categoryLabel.textContent = "Danh mục:";
            const category = document.createElement("select");
            category.required = true;
            [
                ["nuoc", "Món nước"], ["canh", "Món canh"], ["chien", "Món chiên"],
                ["kho", "Món khô"], ["xao", "Món xào"], ["nuong", "Món nướng"]
            ].forEach(function ([value, text]) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = text;
                category.appendChild(option);
            });

            const difficultyLabel = document.createElement("label");
            difficultyLabel.textContent = "Độ khó:";
            const difficulty = document.createElement("select");
            difficulty.required = true;
            ["Dễ", "Trung bình", "Khó"].forEach(function (value) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                difficulty.appendChild(option);
            });

            form.append(categoryLabel, category, difficultyLabel, difficulty);

            async function moderate(action) {
                if (action === "approve" && (!category.value || !difficulty.value)) return;
                if (!confirm(action === "approve"
                    ? `Duyệt công thức “${recipe.title}”?`
                    : `Từ chối công thức “${recipe.title}”?`)) return;

                try {
                    await apiRequest(`/api/admin/recipes/${recipe.id}/moderation`, {
                        method: "PATCH",
                        body: JSON.stringify({
                            category: category.value,
                            difficulty: difficulty.value,
                            action: action
                        })
                    });
                    card.remove();
                } catch (error) {
                    window.alert(error.message);
                }
            }

            const approve = document.createElement("button");
            approve.type = "button";
            approve.textContent = "Duyệt công thức";
            approve.onclick = () => moderate("approve");

            const reject = document.createElement("button");
            reject.type = "button";
            reject.className = "reject-recipe-button";
            reject.textContent = "Từ chối";
            reject.onclick = () => moderate("reject");

            form.append(approve, reject);
            card.appendChild(form);
            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

loadAdminPage();