// Mở và đóng hộp gợi ý ở trang chủ.
function moGoiY() {
    const hop = document.getElementById("hopGoiY");
    if (hop) hop.style.display = "flex";
}

function dongGoiY() {
    const hop = document.getElementById("hopGoiY");
    if (hop) hop.style.display = "none";
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

// Đợi HTML tải xong rồi mới tìm các phần tử.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", khoiTaoTimKiem);
} else {
    khoiTaoTimKiem();
}