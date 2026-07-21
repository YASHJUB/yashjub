// كود الملف الشخصي

const API = window.location.origin + '/api';

async function loadProfile() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type') || 'client';

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
        document.getElementById('profileName').textContent  = 'مزود خدمة';
        document.getElementById('profileBadge').textContent = '👷 مزود';
        document.getElementById('profileBadge').style.background = 'rgba(245,197,24,0.2)';
        document.getElementById('profileBadge').style.color = '#92700A';
        document.getElementById('infoType').textContent    = 'مزود خدمة';
        document.getElementById('providerAction').style.display = 'flex';
    } else {
        document.getElementById('profileName').textContent  = 'عميل يشجب';
        document.getElementById('profileBadge').textContent = '👤 عميل';
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

function logoutProfile() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('yashjub_phone');
        localStorage.removeItem('yashjub_type');
        window.location.href = 'index.html';
    }
}

loadProfile();