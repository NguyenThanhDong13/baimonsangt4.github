const thamSo = new URLSearchParams(window.location.search);
const tenMon = thamSo.get("mon");
const mon = congThuc[tenMon];

const tenDanhMuc = {
    "Cơm chiên": "Món chiên",
    "Đậu xốt cà chua": "Món xào",
    "Canh xương khoai tây cà rốt": "Món canh",
    "Bún bò": "Món nước"
};

if (!mon) {
    document.querySelector(".chi-tiet-mon").innerHTML = `
        <h1>Không tìm thấy công thức</h1>
        <p>Món ăn này chưa có dữ liệu công thức.</p>
        <a class="nut-quay-lai" href="mon-an.html">← Quay lại</a>
    `;
} else {
    document.title = tenMon + " - Hướng Dẫn Nấu Ăn";

    document.getElementById("chiTietTenMon").textContent = tenMon;
    document.getElementById("chiTietAnh").src = mon.anh;
    document.getElementById("chiTietAnh").alt = tenMon;
    document.getElementById("chiTietThoiGian").textContent = mon.thoiGian;
    document.getElementById("chiTietDanhMuc").textContent =
        tenDanhMuc[tenMon] || "Món ăn";

    document.getElementById("chiTietMoTa").textContent =
        "Công thức đơn giản, phù hợp cho bữa cơm gia đình.";

    const danhSachNguyenLieu =
        document.getElementById("chiTietNguyenLieu");

    mon.nguyenLieu.forEach(function (nguyenLieu) {
        const li = document.createElement("li");
        li.textContent = nguyenLieu;
        danhSachNguyenLieu.appendChild(li);
    });

    const danhSachCachLam =
        document.getElementById("chiTietCachLam");

    mon.cachLam.forEach(function (buoc) {
        const li = document.createElement("li");
        li.textContent = buoc;
        danhSachCachLam.appendChild(li);
    });
    const khungVideo = document.getElementById("khungVideo");

if (mon.video) {
    let linkVideo = mon.video;

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
}