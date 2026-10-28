(function () {
    const recipesBox = document.getElementById("shoppingRecipes");
    const ingredientsBox = document.getElementById("shoppingIngredients");
    const message = document.getElementById("shoppingMessage");
    const clearButton = document.getElementById("clearShopping");
    const printButton = document.getElementById("printShopping");

    let recipes = [];
    let checked = {};

    function normalize(text) {
        return text.normalize("NFC")
            .toLocaleLowerCase("vi")
            .trim()
            .replace(/\s+/g, " ");
    }

    function readStorage() {
        const savedRecipes = JSON.parse(
            localStorage.getItem("shoppingList") || "[]"
        );

        const savedChecked = JSON.parse(
            localStorage.getItem("shoppingChecked") || "{}"
        );

        if (
            !Array.isArray(savedRecipes) ||
            !savedRecipes.every(item =>
                item &&
                typeof item.key === "string" &&
                typeof item.title === "string" &&
                Array.isArray(item.ingredients) &&
                item.ingredients.every(line => typeof line === "string")
            ) ||
            !savedChecked ||
            typeof savedChecked !== "object" ||
            Array.isArray(savedChecked)
        ) {
            throw new Error("Dữ liệu danh sách không hợp lệ.");
        }

        recipes = savedRecipes;
        checked = savedChecked;
    }

    function parseIngredient(line) {
        const text = line.trim();

        const match = text.match(
            /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*(kg|ml|g|lít|l|quả|bát|muỗng|thìa|nhánh|củ|cái|tép|bó)\s+(.+)$/i
        );

        if (!match) {
            return {
                key: "text:" + normalize(text),
                text,
                quantity: null
            };
        }

        const parts = match[1].replace(",", ".").split("/");
        let quantity = Number(parts[0]);

        if (parts.length === 2) {
            const denominator = Number(parts[1]);

            if (!denominator) {
                return {
                    key: "text:" + normalize(text),
                    text,
                    quantity: null
                };
            }

            quantity /= denominator;
        }

        let unit = normalize(match[2]);
        const name = match[3].trim();

        if (unit === "kg") {
            quantity *= 1000;
            unit = "g";
        } else if (unit === "l" || unit === "lít") {
            quantity *= 1000;
            unit = "ml";
        }

        return {
            key: JSON.stringify([normalize(name), unit]),
            name,
            unit,
            quantity
        };
    }

    function collectIngredients() {
        const result = new Map();

        recipes.forEach(recipe => {
            recipe.ingredients.forEach(line => {
                if (!line.trim()) return;

                const ingredient = parseIngredient(line);
                const existing = result.get(ingredient.key);

                if (existing && ingredient.quantity !== null) {
                    existing.quantity += ingredient.quantity;
                } else if (!existing) {
                    result.set(ingredient.key, ingredient);
                }
            });
        });

        return Array.from(result.values());
    }

    function formatIngredient(item) {
        if (item.quantity === null) return item.text;

        const quantity = new Intl.NumberFormat("vi-VN", {
            maximumFractionDigits: 2
        }).format(item.quantity);

        return `${quantity} ${item.unit} ${item.name}`;
    }

    function render() {
        recipesBox.replaceChildren();
        ingredientsBox.replaceChildren();

        if (!recipes.length) {
            recipesBox.textContent =
                "Chưa chọn món. Mở trang chi tiết món để thêm vào danh sách.";
            ingredientsBox.textContent = "Chưa có nguyên liệu.";
            clearButton.disabled = true;
            printButton.disabled = true;
            return;
        }

        clearButton.disabled = false;
        printButton.disabled = false;

        recipes.forEach(recipe => {
            const row = document.createElement("div");
            row.className = "shopping-recipe";

            const title = document.createElement("span");
            title.textContent =
                `${recipe.title} — ${recipe.servings} người`;

            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Bỏ món";

            remove.onclick = function () {
                if (!confirm(`Bỏ ${recipe.title} khỏi danh sách?`)) {
                    return;
                }

                const next = recipes.filter(
                    item => item.key !== recipe.key
                );

                try {
                    localStorage.setItem(
                        "shoppingList",
                        JSON.stringify(next)
                    );

                    recipes = next;
                    render();
                    message.textContent = "Đã bỏ món khỏi danh sách.";
                } catch {
                    message.textContent = "Không thể lưu thay đổi.";
                }
            };

            row.append(title, remove);
            recipesBox.appendChild(row);
        });

        const ingredients = collectIngredients();

        ingredients.forEach(item => {
            const text = formatIngredient(item);

            // Khi lượng cần mua đổi, cần đánh dấu lại.
            const checkKey = JSON.stringify([item.key, text]);

            const label = document.createElement("label");
            label.className = "shopping-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = checked[checkKey] === true;

            const name = document.createElement("span");
            name.textContent = text;

            checkbox.onchange = function () {
                const next = { ...checked };

                if (checkbox.checked) {
                    next[checkKey] = true;
                } else {
                    delete next[checkKey];
                }

                try {
                    localStorage.setItem(
                        "shoppingChecked",
                        JSON.stringify(next)
                    );
                    checked = next;
                } catch {
                    checkbox.checked = !checkbox.checked;
                    message.textContent =
                        "Không thể lưu trạng thái đã mua.";
                }
            };

            label.append(checkbox, name);
            ingredientsBox.appendChild(label);
        });

        message.textContent =
            `Đã chọn ${recipes.length} món, gồm ` +
            `${ingredients.length} dòng nguyên liệu. ` +
            "Nguyên liệu cùng tên và đơn vị được cộng lại; " +
            "định lượng dạng chữ được giữ nguyên.";
    }

    clearButton.onclick = function () {
        if (!confirm("Xóa toàn bộ danh sách đi chợ?")) return;

        try {
            // Lưu danh sách rỗng trước để tránh khôi phục món cũ.
            localStorage.setItem("shoppingList", "[]");
            recipes = [];

            localStorage.removeItem("shoppingChecked");
            checked = {};

            render();
            message.textContent = "Đã xóa danh sách đi chợ.";
        } catch {
            render();
            message.textContent =
                "Có lỗi khi lưu. Hãy tải lại để kiểm tra danh sách.";
        }
    };

    printButton.onclick = function () {
        window.print();
    };

    try {
        readStorage();
        render();
    } catch (error) {
        console.error(error);
        message.textContent =
            "Không đọc được danh sách đã lưu. " +
            "Bạn có thể dùng nút Xóa toàn bộ danh sách để đặt lại.";
        printButton.disabled = true;
    }
})();