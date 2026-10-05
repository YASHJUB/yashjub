// كود صفحة سجل طلبات المزود

const API = window.location.origin + '/api';

let allOrders = [];

const LEVEL_BADGES = {
    basic:    { label: 'مزود أساسي', icon: 'medal-silver' },
    verified: { label: 'مزود موثق',  icon: 'medal-gold'   },
    business: { label: 'شركة',       icon: 'trophy'       },
};

// تحميل الصفحة
function loadProviderOrdersPage() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type');

    if (!phone || type !== 'provider') {
        showAppAlert('⚠️ هذه الصفحة للمزودين فقط', () => window.location.href = 'login.html');
        return;
    }

    document.getElementById('providerNameSidebar').textContent  = 'مزود خدمة';
    document.getElementById('providerPhoneSidebar').textContent = `+966${phone}`;

    loadProviderIdentity(phone);
    loadOrders(phone);

    loadNotifBell();
    setInterval(loadNotifBell, 60000);
}

// اسم المزود وشارة المستوى بالسايد بار
async function loadProviderIdentity(phone) {
    try {
        const res  = await fetch(`${API}/providers`);
        const data = await res.json();
        if (!data.success) return;

        const me = data.providers.find(p => p.phone === phone);
        if (!me) return;

        document.getElementById('providerNameSidebar').textContent = me.name;

        const levelBadge = LEVEL_BADGES[me.level] || LEVEL_BADGES.verified;
        document.getElementById('sidebarProviderBadge').innerHTML =
            `<svg class="icon"><use href="icons.svg#icon-${levelBadge.icon}"></use></svg> ${levelBadge.label}`;
    } catch (e) {}
}

// تحميل الطلبات
async function loadOrders(phone) {
    try {
        const res  = await fetch(`${API}/orders/provider/${phone}`);
        const data = await res.json();

        if (data.success) {
            allOrders = data.orders;
            document.getElementById('ordersCount').textContent = `${allOrders.length} طلب`;
            renderOrders(allOrders);
        }
    } catch(e) {
        console.log('خطأ في تحميل الطلبات');
    }
}

// عرض الطلبات
function renderOrders(orders) {
    const container = document.getElementById('providerOrdersList');

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg class="icon"><use href="icons.svg#icon-inbox-empty"></use></svg></div>
                <div class="empty-title">لا يوجد طلبات</div>
                <div class="empty-sub">ابدأ باستقبال الطلبات الآن!</div>
            </div>`;
        return;
    }

    const statusLabels = {
        pending:               { label: 'انتظار',           color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
        accepted:              { label: 'مقبول',            color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
        arrived:               { label: 'وصلت',             color: '#92700A', bg: 'rgba(245,197,24,0.15)' },
        awaiting_confirmation: { label: 'بانتظار التأكيد',  color: '#92700A', bg: 'rgba(245,197,24,0.15)' },
        disputed:              { label: 'نزاع',             color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
        completed:             { label: 'مكتمل',             color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
        cancelled:             { label: 'ملغي',              color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
    };

    const serviceIcons = {
        'وايت ماء': 'truck', 'سطحة': 'tow-truck', 'حاوية': 'box', 'معدات ثقيلة': 'crane'
    };

    container.innerHTML = orders.map(o => {
        const status = statusLabels[o.status] || { label: o.status, color: '#888', bg: '#f0f0f0' };
        const icon   = serviceIcons[o.service] || 'wrench';
        const date   = new Date(o.created_at).toLocaleDateString('ar-SA');
        const net    = o.price - o.commission;

        return `
            <div class="provider-order-item">
                <div class="provider-order-top">
                    <div class="provider-order-service">
                        <div class="provider-order-icon"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg></div>
                        <div>
                            <div class="provider-order-name">${o.service}</div>
                            <div class="provider-order-date">${date}</div>
                        </div>
                    </div>
                    <span class="provider-order-status"
                        style="color:${status.color};background:${status.bg}">
                        ${status.label}
                    </span>
                </div>
                <div class="provider-order-divider"></div>
                <div class="provider-order-details">
                    <div class="provider-order-detail">
                        <span><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${o.address.substring(0, 30)}${o.address.length > 30 ? '...' : ''}</span>
                    </div>
                    <div class="provider-order-detail">
                        <span><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> صافي الأرباح: <strong>${net} ريال</strong></span>
                    </div>
                </div>
                ${o.status === 'pending' ? `
                <button class="btn-accept-real-order" onclick="acceptRealOrder(${o.id})">
                    <svg class="icon"><use href="icons.svg#icon-check"></use></svg> قبول الطلب
                </button>` : ''}
                ${(o.status === 'accepted' || o.status === 'arrived') ? `
                <div class="provider-order-chat-actions">
                    <button class="btn-chat" onclick="toggleProviderChat(${o.id})">
                        <svg class="icon"><use href="icons.svg#icon-chat"></use></svg> محادثة العميل
                    </button>
                    ${o.status === 'accepted' ? `
                    <button class="btn-arrived-order" onclick="markOrderArrived(${o.id})">
                        <svg class="icon"><use href="icons.svg#icon-pin"></use></svg> وصلت للموقع
                    </button>` : `
                    <button class="btn-complete-order" onclick="markOrderCompleted(${o.id})">
                        <svg class="icon"><use href="icons.svg#icon-check"></use></svg> اكتملت الخدمة
                    </button>`}
                </div>
                <div class="chat-panel" id="chatPanel-${o.id}" style="display:none">
                    <div class="chat-messages" id="chatMessages-${o.id}"></div>
                    <div class="chat-input-row">
                        <input type="text" id="chatInput-${o.id}" placeholder="اكتب ردك..." onkeydown="if(event.key==='Enter') sendProviderChatMessage(${o.id})"/>
                        <button class="btn-small" onclick="sendProviderChatMessage(${o.id})">إرسال</button>
                    </div>
                </div>` : ''}
                ${(o.status === 'completed' || o.status === 'cancelled') ? `
                <button class="btn-small" style="width:100%;margin-top:12px" onclick="openComplaintForm(${o.id}, '${o.phone}')">
                    <svg class="icon"><use href="icons.svg#icon-siren"></use></svg> تقديم بلاغ
                </button>` : ''}
            </div>
        `;
    }).join('');
}

// فلتر الطلبات
function filterOrders(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (status === 'all') {
        renderOrders(allOrders);
    } else {
        renderOrders(allOrders.filter(o => o.status === status));
    }
}

// قبول طلب حقيقي (pending → accepted)
async function acceptRealOrder(id) {
    if (!confirm('هل تريد قبول هذا الطلب؟')) return;

    try {
        const res  = await fetch(`${API}/orders/${id}/accept`, { method: 'PUT' });
        const data = await res.json();

        if (data.success) {
            alert('✅ تم قبول الطلب!');
            loadOrders(localStorage.getItem('yashjub_phone'));
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تسجيل وصول المزوّد لموقع الخدمة (accepted → arrived)
async function markOrderArrived(id) {
    if (!confirm('هل أنت متأكد إنك وصلت لموقع الخدمة؟')) return;

    try {
        const res  = await fetch(`${API}/orders/${id}/arrived`, { method: 'PUT' });
        const data = await res.json();

        if (data.success) {
            alert('📍 تم تسجيل وصولك للموقع!');
            loadOrders(localStorage.getItem('yashjub_phone'));
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// إبلاغ عن اكتمال الخدمة (arrived → awaiting_confirmation) — بانتظار تأكيد العميل قبل تحرير المبلغ
async function markOrderCompleted(id) {
    if (!confirm('هل أنت متأكد من اكتمال الخدمة؟')) return;

    try {
        const res  = await fetch(`${API}/orders/${id}/complete`, { method: 'PUT' });
        const data = await res.json();

        if (data.success) {
            showAppAlert('✅ تم إرسال طلب التأكيد للعميل\n\nسيتم تحرير مبلغك بعد تأكيد العميل\nأو تلقائياً خلال 24 ساعة', () => loadOrders(localStorage.getItem('yashjub_phone')));
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ محادثة العميل (للطلبات المقبولة) ══

let openChatOrderId          = null;
let providerChatPollInterval = null;

function toggleProviderChat(orderId) {
    // إغلاق أي محادثة ثانية مفتوحة قبل فتح هذي
    if (openChatOrderId && openChatOrderId !== orderId) {
        const prevPanel = document.getElementById(`chatPanel-${openChatOrderId}`);
        if (prevPanel) prevPanel.style.display = 'none';
    }

    const panel   = document.getElementById(`chatPanel-${orderId}`);
    const isOpen  = panel.style.display === 'block';

    if (providerChatPollInterval) {
        clearInterval(providerChatPollInterval);
        providerChatPollInterval = null;
    }

    if (isOpen) {
        panel.style.display = 'none';
        openChatOrderId = null;
        return;
    }

    panel.style.display = 'block';
    openChatOrderId = orderId;
    loadProviderChatMessages(orderId);
    providerChatPollInterval = setInterval(() => loadProviderChatMessages(orderId), 10000);
}

async function loadProviderChatMessages(orderId) {
    const container = document.getElementById(`chatMessages-${orderId}`);
    if (!container) return;

    try {
        const res  = await fetch(`${API}/chats/${orderId}`);
        const data = await res.json();
        if (!data.success) return;

        if (!data.messages.length) {
            container.innerHTML = '<div class="chat-empty">ابدأ المحادثة مع العميل...</div>';
            return;
        }

        const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;

        container.innerHTML = data.messages.map(m => `
            <div class="chat-bubble sender-${m.sender}">
                <div class="chat-bubble-text">${m.message}</div>
                <div class="chat-bubble-time">${new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `).join('');

        if (wasAtBottom) container.scrollTop = container.scrollHeight;
    } catch (e) {}
}

async function sendProviderChatMessage(orderId) {
    const input = document.getElementById(`chatInput-${orderId}`);
    const text  = input.value.trim();

    if (!text) return;

    input.value = '';

    try {
        await fetch(`${API}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                sender: 'provider',
                senderPhone: localStorage.getItem('yashjub_phone'),
                message: text,
            }),
        });
        loadProviderChatMessages(orderId);
    } catch (e) {}
}

// ══ تقديم بلاغ عن عميل ══

let complaintOrderId       = null;
let complaintReportedPhone = null;

function openComplaintForm(orderId, clientPhone) {
    complaintOrderId       = orderId;
    complaintReportedPhone = clientPhone || null;
    document.getElementById('complaintType').value        = 'تأخر';
    document.getElementById('complaintDescription').value = '';
    document.getElementById('complaintFormOverlay').style.display = 'flex';
}

function closeComplaintForm() {
    document.getElementById('complaintFormOverlay').style.display = 'none';
    complaintOrderId       = null;
    complaintReportedPhone = null;
}

async function submitComplaint() {
    const phone       = localStorage.getItem('yashjub_phone');
    const type        = document.getElementById('complaintType').value;
    const description = document.getElementById('complaintDescription').value.trim();

    if (!description) {
        alert('❌ يرجى كتابة تفاصيل البلاغ');
        return;
    }

    try {
        const res  = await fetch(`${API}/complaints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: complaintOrderId,
                reporterPhone: phone,
                reporterType: 'provider',
                reportedPhone: complaintReportedPhone,
                reportedType: complaintReportedPhone ? 'client' : null,
                type, description,
            }),
        });
        const data = await res.json();

        if (data.success) {
            closeComplaintForm();
            alert(`✅ تم إرسال بلاغك بنجاح — رقم البلاغ للمتابعة: #${data.complaint.id}`);
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تسجيل الخروج
function providerLogout() {
    localStorage.removeItem('yashjub_phone');
    localStorage.removeItem('yashjub_type');
    localStorage.removeItem('yashjub_name');
    window.location.href = 'index.html';
}

// السايد بار
function toggleSidebar() {
    document.getElementById('appSidebar').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
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

// إغلاق قائمة الإشعارات عند الضغط خارجها
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('notifBellWrap');
    if (wrap && !wrap.contains(e.target)) {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// ══ الوضع الليلي ══

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

// تشغيل
loadProviderOrdersPage();
loadTheme();
