// كود الملف الشخصي

const API = window.location.origin + '/api';

async function loadProfile() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type') || 'client';
    const name  = localStorage.getItem('yashjub_name');

    if (!phone) {
        alert('⚠️ يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    // تحديث المعلومات الأساسية
    document.getElementById('profilePhone').textContent = `+966${phone}`;
    document.getElementById('infoPhone').textContent    = `+966${phone}`;
    document.getElementById('infoDate').textContent     = new Date().toLocaleDateString('ar-SA');

    if (type === 'provider') {
        document.getElementById('profileName').textContent  = name || 'مزود خدمة';
        document.getElementById('profileBadge').innerHTML = '<svg class="icon"><use href="icons.svg#icon-worker"></use></svg> مزود';
        document.getElementById('profileBadge').style.background = 'rgba(245,197,24,0.2)';
        document.getElementById('profileBadge').style.color = '#92700A';
        document.getElementById('infoType').textContent    = 'مزود خدمة';
        document.getElementById('providerAction').style.display = 'flex';
    } else {
        document.getElementById('profileName').textContent  = name || 'عميل يشجب';
        document.getElementById('profileBadge').innerHTML = '<svg class="icon"><use href="icons.svg#icon-user"></use></svg> عميل';
        document.getElementById('infoType').textContent    = 'عميل';
    }

    // جلب الإحصائيات
    try {
        const response = await fetch(`${API}/orders/user/${phone}`);
        const data     = await response.json();

        if (data.success) {
            const orders    = data.orders;
            const completed = orders.filter(o => o.status === 'completed').length;
            const spent     = orders.reduce((sum, o) => sum + o.price, 0);

            document.getElementById('statOrders').textContent    = orders.length;
            document.getElementById('statCompleted').textContent = completed;
            document.getElementById('statSpent').textContent     = spent.toLocaleString();
        }
    } catch (error) {
        console.log('خطأ في جلب الإحصائيات');
    }
}

// إظهار/إخفاء فورم تعديل الاسم
function toggleEditName() {
    const form = document.getElementById('editNameForm');
    const isHidden = form.style.display === 'none';

    form.style.display = isHidden ? 'flex' : 'none';

    if (isHidden) {
        document.getElementById('editNameInput').value = document.getElementById('profileName').textContent;
        document.getElementById('editNameInput').focus();
    }
}

// حفظ تعديل الاسم
async function saveEditedName() {
    const name  = document.getElementById('editNameInput').value.trim();
    const phone = localStorage.getItem('yashjub_phone');

    if (!name) {
        alert('❌ يرجى إدخال اسم صحيح');
        return;
    }

    try {
        const response = await fetch(`${API}/users/${phone}/name`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('yashjub_name', data.name);
            document.getElementById('profileName').textContent = data.name;
            document.getElementById('editNameForm').style.display = 'none';
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

function logoutProfile() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('yashjub_phone');
        localStorage.removeItem('yashjub_type');
        localStorage.removeItem('yashjub_name');
        window.location.href = 'index.html';
    }
}

loadProfile();