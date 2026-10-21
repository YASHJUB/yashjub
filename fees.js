// كود صفحة حاسبة الرسوم والدفع (معاهدة غوث)

const API = window.location.origin + '/api';

const FEE_RATE = 0.01;
let selectedPaymentMethod = null;

// الصفحة خاصة بوضع الإعلانات فقط (رسوم معاهدة غوث ماكو مفهوم ينطبق على النظام المدفوع)
(async function redirectAwayIfPaidMode() {
    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        if (data.activeSystem !== 'ads') window.location.href = 'index.html';
    } catch (e) {}
})();

// تحميل بيانات المستخدم بالسايد بار + سجل مدفوعاته
function loadFeesPage() {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        showAppAlert('⚠️ يجب تسجيل الدخول أولاً', () => window.location.href = 'login.html');
        return;
    }

    const savedName = localStorage.getItem('yashjub_name');
    document.getElementById('sidebarUserName').textContent = savedName || 'مستخدم غَوْث';
    document.getElementById('sidebarPhone').textContent    = `+966${phone}`;
    renderSidebarAvatar();

    loadNotifBell();
    setInterval(loadNotifBell, 60000);
    loadMessagesBadge();
    setInterval(loadMessagesBadge, 30000);
    loadFeePayments(phone);
}

// badge "الرسائل" بالسايد بار — مجموع غير المقروء بكل محادثات المستخدم (راجع نظام الرسائل الداخلية)
async function loadMessagesBadge() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/conversations/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const totalUnread = data.conversations.reduce((sum, c) => sum + (c.my_unread_count || 0), 0);
        const badge = document.getElementById('messagesBadge');
        if (!badge) return;
        badge.textContent   = totalUnread;
        badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    } catch (e) {}
}

// الصورة الشخصية (أفاتار) بالسايد بار — موحّدة للعميل والمزوّد (راجع "الصورة الشخصية" بـprofile.js)
function renderSidebarAvatar() {
    const avatarPath = localStorage.getItem('yashjub_avatar');
    const el = document.getElementById('sidebarUserIcon');
    if (el && avatarPath) el.innerHTML = `<img src="${avatarPath}" class="avatar-img" alt="">`;
}

// حساب الرسوم تلقائياً (1% من قيمة الخدمة المُدخلة)
function calculateFee() {
    const amount = parseFloat(document.getElementById('serviceAmountInput').value) || 0;
    const fee    = Math.round(amount * FEE_RATE * 100) / 100;

    document.getElementById('feeResultInput').value = fee.toLocaleString('en-US');
    document.getElementById('payNowBtn').disabled    = amount <= 0;
}

// ══ نافذة اختيار طريقة الدفع ══

function openPaymentModal() {
    const amount = parseFloat(document.getElementById('serviceAmountInput').value) || 0;
    if (amount <= 0) {
        alert('❌ يرجى إدخال قيمة الخدمة أولاً');
        return;
    }

    selectedPaymentMethod = null;
    document.querySelectorAll('.payment-method-option').forEach(el => el.classList.remove('selected'));
    document.getElementById('confirmPaymentBtn').disabled = true;
    document.getElementById('paymentModalOverlay').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('paymentModalOverlay').style.display = 'none';
}

function selectPaymentMethod(method, el) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-method-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('confirmPaymentBtn').disabled = false;
}

async function confirmPayment() {
    if (!selectedPaymentMethod) return;

    const phone         = localStorage.getItem('yashjub_phone');
    const serviceAmount = parseFloat(document.getElementById('serviceAmountInput').value) || 0;
    const feeAmount     = Math.round(serviceAmount * FEE_RATE * 100) / 100;

    try {
        const res  = await fetch(`${API}/fees/pay`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                providerPhone: phone,
                serviceAmount,
                feeAmount,
                paymentMethod: selectedPaymentMethod,
            }),
        });
        const data = await res.json();

        if (data.success) {
            closePaymentModal();
            showAppAlert('✅ تم تسجيل دفعتك بنجاح');
            document.getElementById('serviceAmountInput').value = '';
            calculateFee();
            loadFeePayments(phone);
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ سجل المدفوعات ══

async function loadFeePayments(phone) {
    try {
        const res  = await fetch(`${API}/fees/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const body = document.getElementById('feePaymentsBody');

        if (!data.payments.length) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">لا يوجد مدفوعات بعد</td></tr>';
            return;
        }

        body.innerHTML = data.payments.map(p => `
            <tr>
                <td>${new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA')}</td>
                <td>${Number(p.service_amount).toLocaleString('en-US')} ريال</td>
                <td>${Number(p.fee_amount).toLocaleString('en-US')} ريال</td>
                <td class="${p.status === 'paid' ? 'fee-status-paid' : 'fee-status-pending'}">${p.status === 'paid' ? 'مدفوع' : 'معلق'}</td>
            </tr>
        `).join('');
    } catch (e) {}
}

// ══ جرس الإشعارات ══

const NOTIF_TYPE_ICONS = {
    urgent: { icon: 'siren',    bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
    alert:  { icon: 'warning',  bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
    update: { icon: 'bell',     bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
    offer:  { icon: 'confetti', bg: 'rgba(245,197,24,0.15)', color: '#92700A' },
};

async function loadNotifBell() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/notifications/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const unreadCount = data.notifications.filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBellBadge');
        badge.textContent   = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';

        renderNotifDropdown(data.notifications.slice(0, 5));
    } catch (e) {}
}

function renderNotifDropdown(notifications) {
    const list = document.getElementById('notifDropdownList');

    if (!notifications.length) {
        list.innerHTML = '<div class="notif-dropdown-empty">لا توجد إشعارات</div>';
        return;
    }

    list.innerHTML = notifications.map(n => {
        const meta = NOTIF_TYPE_ICONS[n.type] || NOTIF_TYPE_ICONS.update;
        return `
            <div class="notif-dropdown-item ${n.is_read ? '' : 'unread'}" onclick="clickNotifItem(${n.id})">
                <div class="notif-dropdown-icon" style="background:${meta.bg};color:${meta.color}">
                    <svg class="icon"><use href="icons.svg#icon-${meta.icon}"></use></svg>
                </div>
                <div>
                    <div class="notif-dropdown-title">${n.title}</div>
                    <div class="notif-dropdown-message">${n.message}</div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

async function clickNotifItem(id) {
    try {
        await fetch(`${API}/notifications/${id}/read`, { method: 'PUT' });
        loadNotifBell();
    } catch (e) {}
    window.location.href = 'profile.html#notifications';
}

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('notifBellWrap');
    if (wrap && !wrap.contains(e.target)) {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// فتح/إغلاق السايد بار
function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// تسجيل الخروج
function logout() {
    localStorage.removeItem('yashjub_phone');
    localStorage.removeItem('yashjub_type');
    localStorage.removeItem('yashjub_name');
    localStorage.removeItem('yashjub_avatar');
    localStorage.removeItem('yashjub_username');
    window.location.href = 'index.html';
}

// الوضع الليلي
function toggleTheme() {
    const body = document.body;
    const btn  = document.getElementById('themeBtn');
    const isDark = body.classList.toggle('dark-mode');

    btn.innerHTML = isDark
        ? '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>'
        : '<svg class="icon"><use href="icons.svg#icon-moon"></use></svg>';
    localStorage.setItem('yashjub_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const theme = localStorage.getItem('yashjub_theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('themeBtn');
        if (btn) btn.innerHTML = '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>';
    }
}

// تشغيل عند فتح الصفحة
loadTheme();
loadFeesPage();
