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

    loadProfileNotifications(phone);
}

// ══ إشعاراتي ══

const PROFILE_NOTIF_ICONS = {
    urgent: { icon: 'siren',    bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
    alert:  { icon: 'warning',  bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
    update: { icon: 'bell',     bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
    offer:  { icon: 'confetti', bg: 'rgba(245,197,24,0.15)', color: '#92700A' },
};

async function loadProfileNotifications(phone) {
    try {
        const res  = await fetch(`${API}/notifications/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const unread = data.notifications.filter(n => !n.is_read).length;
        document.getElementById('notifUnreadCount').textContent = unread > 0 ? `${unread} غير مقروءة` : '';

        const list = document.getElementById('profileNotifList');

        if (!data.notifications.length) {
            list.innerHTML = '<p style="text-align:center;color:#999;font-size:13px;padding:16px 0">لا توجد إشعارات</p>';
            return;
        }

        list.innerHTML = data.notifications.map(n => {
            const meta = PROFILE_NOTIF_ICONS[n.type] || PROFILE_NOTIF_ICONS.update;
            return `
                <div class="profile-notif-item ${n.is_read ? '' : 'unread'}" onclick="markProfileNotifRead(${n.id}, '${phone}')">
                    <div class="profile-notif-icon" style="background:${meta.bg};color:${meta.color}">
                        <svg class="icon"><use href="icons.svg#icon-${meta.icon}"></use></svg>
                    </div>
                    <div style="flex:1">
                        <div class="profile-notif-title">${n.title}</div>
                        <div class="profile-notif-message">${n.message}</div>
                        <div class="profile-notif-meta">
                            <span>${new Date(n.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</span>
                            <span>${n.is_read ? '' : '• غير مقروء'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {}
}

async function markProfileNotifRead(id, phone) {
    try {
        await fetch(`${API}/notifications/${id}/read`, { method: 'PUT' });
        loadProfileNotifications(phone);
    } catch (e) {}
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