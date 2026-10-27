(async function () {
    const idMon = new URLSearchParams(
        window.location.search
    ).get("id");

    const form = document.getElementById("commentForm");
    const input = document.getElementById("commentContent");
    const submit = document.getElementById("commentSubmit");
    const message = document.getElementById("commentMessage");
    const list = document.getElementById("commentList");
    const login = document.getElementById("commentLogin");
    const reload = document.getElementById("commentReload");

    if (!form || !list) return;

    let comments = [];
    let user = null;
    let loaded = false;
    let sending = false;

    function updateForm() {
        input.disabled = !user || !loaded || sending;
        submit.disabled = input.disabled;
    }

    function render() {
        list.replaceChildren();

        if (!comments.length) {
            const empty = document.createElement("p");
            empty.textContent =
                "Chưa có bình luận. Hãy chia sẻ ý kiến của bạn!";
            list.appendChild(empty);
            return;
        }

        comments.forEach(function (comment) {
            const card = document.createElement("article");
            card.className = "comment-card";

            const author = document.createElement("strong");
            author.textContent = comment.username;

            const time = document.createElement("small");
            time.textContent = comment.created_at
                .replace("T", " ")
                .slice(0, 19);

            const content = document.createElement("p");
            content.className = "comment-text";
            content.textContent = comment.content;

            card.append(author, time, content);

            if (
    user &&
    (user.id === comment.user_id || user.role === "admin")
) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.textContent = "Xóa bình luận";

                remove.onclick = async function () {
                    if (
                        remove.disabled ||
                        !confirm("Xóa bình luận này?")
                    ) {
                        return;
                    }

                    remove.disabled = true;

                    try {
                        await apiRequest(
                            `/api/comments/${comment.id}`,
                            { method: "DELETE" }
                        );

                        comments = comments.filter(
                            item => item.id !== comment.id
                        );

                        render();
                        message.textContent = "Đã xóa bình luận.";
                    } catch (error) {
                        message.textContent = error.message;
                    } finally {
                        remove.disabled = false;
                    }
                };

                card.appendChild(remove);
            }

            list.appendChild(card);
        });
    }

    async function loadComments() {
        reload.disabled = true;
        loaded = false;
        updateForm();
        message.textContent = "Đang tải bình luận...";

        try {
            const result = await apiRequest(
                `/api/recipes/${idMon}/comments`
            );

            if (!Array.isArray(result)) {
                throw new Error("Dữ liệu bình luận không hợp lệ.");
            }

            comments = result;
            loaded = true;
            render();
            message.textContent = "";
        } catch (error) {
            message.textContent = error.message;
        } finally {
            reload.disabled = false;
            updateForm();
        }
    }

    form.onsubmit = async function (event) {
        event.preventDefault();

        if (sending || !loaded) return;

        if (!user || !localStorage.getItem("authToken")) {
            message.textContent =
                "Bạn cần đăng nhập để gửi bình luận.";
            login.hidden = false;
            return;
        }

        const content = input.value.trim();

        if (!content || Array.from(content).length > 1000) {
            message.textContent =
                "Nhập bình luận từ 1 đến 1.000 ký tự, " +
                "không chỉ chứa khoảng trắng.";
            return;
        }

        sending = true;
        updateForm();
        message.textContent = "Đang gửi...";

        try {
            const comment = await apiRequest(
                `/api/recipes/${idMon}/comments`,
                {
                    method: "POST",
                    body: JSON.stringify({ content })
                }
            );

            comments.unshift(comment);
            render();
            input.value = "";
            message.textContent = "Đã gửi bình luận.";
        } catch (error) {
            message.textContent = error.message;
        } finally {
            sending = false;
            updateForm();
        }
    };

    updateForm();
    login.hidden = true;

    if (
        !idMon ||
        !/^\d+$/.test(idMon) ||
        Number(idMon) < 1
    ) {
        message.textContent =
            "Mở món từ trang Món ăn để xem và gửi bình luận.";
        reload.hidden = true;
        return;
    }

    reload.onclick = loadComments;

    if (localStorage.getItem("authToken")) {
        try {
            user = await apiRequest("/api/auth/me");
        } catch (error) {
            login.hidden = false;
            login.textContent = "Đăng nhập lại để gửi bình luận";
        }
    } else {
        login.hidden = false;
    }

    await loadComments();
})();