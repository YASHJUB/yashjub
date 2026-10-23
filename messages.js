// كود صفحة الرسائل الداخلية (مرتبطة بالإعلانات)

const API = window.location.origin + '/api';

let myPhone             = null;
let conversations       = [];
let activeConversation  = null;
let messagesPollInterval  = null;
let convListPollInterval  = null;

function loadMessagesPage() {
    myPhone = localStorage.getItem('yashjub_phone');

    if (!myPhone) {
        showAppAlert('⚠️ يجب تسجيل الدخول أولاً', () => window.location.href = 'login.html');
        return;
    }

    const savedName = localStorage.getItem('yashjub_name');
    document.getElementById('sidebarUserName').textContent = savedName || 'مستخدم عتاد';
    document.getElementById('sidebarPhone').textContent    = `+966${myPhone}`;
    renderSidebarAvatar();

    loadNotifBell();
    setInterval(loadNotifBell, 60000);

    loadConversations();
    convListPollInterval = setInterval(loadConversations, 10000);
}

// ══ قائمة المحادثات ══

async function loadConversations() {
    try {
        const res  = await fetch(`${API}/conversations/${myPhone}`);
        const data = await res.json();
        if (!data.success) return;

        conversations = data.conversations;
        renderConversationsList(document.getElementById('convSearchInput').value.trim().toLowerCase());
        updateMessagesBadge();

        if (activeConversation) {
            // تحديث بيانات المحادثة المفتوحة (بدون إعادة فتحها) لو تغيّرت
            const updated = conversations.find(c => c.id === activeConversation.id);
            if (updated) activeConversation = updated;
        } else {
            // جاي من صفحة إعلان بمحادثة محددة عبر الرابط؟ افتحها تلقائياً أول مرة بس
            const params   = new URLSearchParams(window.location.search);
            const targetId = params.get('conversation');
            if (targetId) {
                const target = conversations.find(c => String(c.id) === String(targetId));
                if (target) openConversation(target.id, params.get('draft'));
            }
        }
    } catch (e) {}
}

function filterConversations() {
    renderConversationsList(document.getElementById('convSearchInput').value.trim().toLowerCase());
}

function renderConversationsList(filter) {
    const list = document.getElementById('conversationsList');
    let items = conversations;

    if (filter) {
        items = items.filter(c =>
            (c.other_name || '').toLowerCase().includes(filter) ||
            (c.ad_title || '').toLowerCase().includes(filter) ||
            (c.last_message || '').toLowerCase().includes(filter)
        );
    }

    if (!items.length) {
        list.innerHTML = `<div class="messages-empty-list">${conversations.length ? 'لا نتائج مطابقة' : 'لا يوجد محادثات بعد'}</div>`;
        return;
    }

    list.innerHTML = items.map(c => `
        <div class="conversation-item ${activeConversation && activeConversation.id === c.id ? 'active' : ''}" onclick="openConversation(${c.id})">
            <div class="conversation-avatar"><svg class="icon"><use href="icons.svg#icon-user"></use></svg></div>
            <div class="conversation-info">
                <div class="conversation-name">${escapeHtml(c.other_name || ('+966' + c.other_phone))} ${c.other_is_verified ? '<span class="verified-badge" title="حساب موثق">✅</span>' : ''}</div>
                <div class="conversation-ad-title">${escapeHtml(c.ad_title || '')}</div>
                <div class="conversation-last-msg">${escapeHtml(c.last_message || 'ابدأ المحادثة الآن')}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${c.last_message_at ? formatConvTime(c.last_message_at) : ''}</div>
                ${c.my_unread_count > 0 ? `<div class="conversation-unread-badge">${c.my_unread_count}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function formatConvTime(ts) {
    const d   = new Date(ts.replace(' ', 'T') + 'Z');
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' });
}

// badge "الرسائل" بالسايد بار — من نفس بيانات المحادثات المُحمَّلة أصلاً (بدون طلب إضافي)
function updateMessagesBadge() {
    const totalUnread = conversations.reduce((sum, c) => sum + (c.my_unread_count || 0), 0);
    const badge = document.getElementById('messagesBadge');
    if (!badge) return;
    badge.textContent   = totalUnread;
    badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
}

// ══ المحادثة النشطة ══

async function openConversation(id, draftText) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    activeConversation = conv;
    renderConversationsList(document.getElementById('convSearchInput').value.trim().toLowerCase());

    document.getElementById('chatEmptyState').style.display = 'none';
    document.getElementById('chatActiveArea').style.display = 'block';
    document.getElementById('chatHeaderName').innerHTML = escapeHtml(conv.other_name || ('+966' + conv.other_phone)) +
        (conv.other_is_verified ? ' <span class="verified-badge" title="حساب موثق">✅</span>' : '');
    document.getElementById('chatHeaderAd').textContent    = conv.ad_title || '';
    document.getElementById('chatGotoAdBtn').href = `ad-details.html?id=${conv.ad_id}`;

    // وضع الجوال: إظهار عمود المحادثة فوق قائمة المحادثات
    document.getElementById('messagesPage').classList.add('chat-open');

    if (draftText) {
        document.getElementById('messageInput').value = draftText;
    }

    await loadMessages(id);
    markConversationRead(id);

    clearInterval(messagesPollInterval);
    messagesPollInterval = setInterval(() => loadMessages(id), 10000);
}

function closeMobileChat() {
    document.getElementById('messagesPage').classList.remove('chat-open');
}

async function loadMessages(conversationId) {
    try {
        const res  = await fetch(`${API}/messages/${conversationId}`);
        const data = await res.json();
        if (!data.success) return;
        renderMessages(data.messages);
    } catch (e) {}
}

function renderMessages(messages) {
    const area = document.getElementById('chatMessagesArea');

    if (!messages.length) {
        area.innerHTML = '<div class="chat-empty-state" style="position:static;margin:auto">ابدأ المحادثة الآن</div>';
        return;
    }

    area.innerHTML = messages.map(m => `
        <div class="dm-bubble ${m.sender_phone === myPhone ? 'mine' : 'theirs'}">
            <div>${escapeHtml(m.message)}</div>
            <div class="dm-bubble-time">${formatConvTime(m.created_at)}</div>
        </div>
    `).join('');

    area.scrollTop = area.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function markConversationRead(conversationId) {
    try {
        await fetch(`${API}/messages/${conversationId}/read`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone: myPhone }),
        });
        loadConversations();
    } catch (e) {}
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text  = input.value.trim();
    if (!text || !activeConversation) return;

    input.value = '';

    try {
        const res  = await fetch(`${API}/messages`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                conversationId: activeConversation.id,
                senderPhone:    myPhone,
                message:        text,
            }),
        });
        const data = await res.json();

        if (data.success) {
            await loadMessages(activeConversation.id);
            loadConversations();
        } else {
            alert(`❌ ${data.message}`);
            input.value = text;
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
        input.value = text;
    }
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

// الصورة الشخصية (أفاتار) بالسايد بار — موحّدة للعميل والمزوّد (راجع "الصورة الشخصية" بـprofile.js)
function renderSidebarAvatar() {
    const avatarPath = localStorage.getItem('yashjub_avatar');
    const el = document.getElementById('sidebarUserIcon');
    if (el && avatarPath) el.innerHTML = `<img src="${avatarPath}" class="avatar-img" alt="">`;
}

// تشغيل عند فتح الصفحة
loadTheme();
loadMessagesPage();
