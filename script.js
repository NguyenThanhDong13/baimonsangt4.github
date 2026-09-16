function moGoiY() {
    document.getElementById("hopGoiY").style.display = "flex";
}
function dongGoiY() {
    document.getElementById("hopGoiY").style.display = "none";
}

// Lọc món ăn theo danh mục
const monAn = [
    {
        ten: "Phở bò",
        anh: "images/Pho bo.jpg",
        moTa: "Món nước truyền thống Việt Nam",
        loai: "nuoc"
    },
    {
        ten: "Phở gà",
        anh: "images/Pho ga.jpg",
        moTa: "Phở gà thơm ngon",
        loai: "nuoc"
    },
    {
        ten: "Bún bò",
        anh: "images/Bun bo.jpg",
        moTa: "Món nước đặc trưng Việt Nam",
        loai: "nuoc"
    },
    {
        ten: "Gà chiên nước mắm",
        anh: "images/Ga chien.jpg",
        moTa: "Thơm ngon, giòn rụm",
        loai: "chien"
    },
    {
        ten: "Canh chua cá lóc",
        anh: "images/Canh chua.jpg",
        moTa: "Món canh cho bữa cơm gia đình",
        loai: "canh"
    },
    {
        ten: "Rau muống xào",
        anh: "images/Rau muong xao.jpg",
        moTa: "Món xào đơn giản",
        loai: "xao"
    }
];

const tenDanhMuc = {
    canh: "Món canh",
    nuoc: "Món nước",
    chien: "Món chiên",
    kho: "Món khô",
    xao: "Món xào",
    nuong: "Món nướng"
};

// Lấy loại món ăn trên URL
const params = new URLSearchParams(window.location.search);
const loai = params.get("loai");

// Tìm khu vực hiển thị món ăn
const danhSach = document.getElementById("danhSachMon");

// Lọc món ăn
const monDuocLoc = monAn.filter(function(mon) {
    return mon.loai === loai;
});

// Hiển thị món ăn
monDuocLoc.forEach(function(mon) {
    danhSach.innerHTML += `
        <div class="mon-card">
            <img src="${mon.anh}" alt="${mon.ten}">
            <h2>${mon.ten}</h2>
            <p>${mon.moTa}</p>
            <span>${tenDanhMuc[loai]}</span>
        </div>
    `;
});