// كود لوحة الإدارة المتطورة

const API      = window.location.origin + '/api';
const ADMIN_PASS = 'yashjub2025';

// تسجيل الدخول
function doLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;

    if ((user === 'admin' || user === 'يشجب') && pass === ADMIN_PASS) {
        sessionStorage.setItem('yashjub_admin', 'true');
        document.getElementById('loginScreen').style.display  = 'none';
        document.getElementById('adminLayout').style.display  = 'flex';
        loadDashboard();
    } else {
        alert('❌ بيانات الدخول غير صحيحة');
    }
}

// تسجيل الخروج
function doLogout() {
    sessionStorage.removeItem('yashjub_admin');
    document.getElementById('loginScreen').style.display  = 'flex';
    document.getElementById('adminLayout').style.display  = 'none';
}

// التنقل بين الصفحات
function showPage(page) {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.getElementById(`page-${page}`).style.display = 'block';
    event.currentTarget.classList.add('active');

    if (page === 'orders')    loadOrdersPage();
    if (page === 'providers') loadProvidersPage();
    if (page === 'clients')   loadClientsPage();
}

// تحميل لوحة التحكم
async function loadDashboard() {
    try {
        const [ordersRes, providersRes, usersRes] = await Promise.all([
            fetch(`${API}/orders`),
            fetch(`${API}/providers`),
            fetch(`${API}/users`),
        ]);

        const ordersData    = await ordersRes.json();
        const providersData = await providersRes.json();
        const usersData     = await usersRes.json();

        const orders    = ordersData.success    ? ordersData.orders       : [];
        const providers = providersData.success ? providersData.providers : [];
        const users     = usersData.success     ? usersData.users         : [];

        // الإحصائيات
        const revenue    = orders.reduce((s, o) => s + o.price, 0);
        const commission = orders.reduce((s, o) => s + o.commission, 0);
        const completed  = orders.filter(o => o.status === 'completed');
        const pending    = orders.filter(o => o.status === 'pending');
        const cancelled  = orders.filter(o => o.status === 'cancelled');

        document.getElementById('s-revenue').textContent    = revenue.toLocaleString() + ' ر';
        document.getElementById('s-commission').textContent = commission.toLocaleString() + ' ر';
        document.getElementById('s-today').textContent      = orders.length;
        document.getElementById('s-active').textContent     = pending.length;
        document.getElementById('s-completed').textContent  = completed.length;
        document.getElementById('s-providers').textContent  = providers.length;
        document.getElementById('s-users').textContent      = users.length;

        document.getElementById('sc-active').textContent  = pending.length;
        document.getElementById('sc-pending').textContent = pending.length;
        document.getElementById('sc-done').textContent    = completed.length;
        document.getElementById('sc-cancel').textContent  = cancelled.length;

        document.getElementById('p-success').textContent = revenue.toLocaleString() + ' ر';
        document.getElementById('c-today').textContent   = commission;
        document.getElementById('c-week').textContent    = commission;
        document.getElementById('c-month').textContent   = commission;
        document.getElementById('c-year').textContent    = commission;

        document.getElementById('pendingBadge').textContent  = pending.length;
        document.getElementById('verifyBadge').textContent   = providers.length;

        // آخر الطلبات
        const statusBadge = {
            pending:   '<span class="badge badge-pending">انتظار</span>',
            accepted:  '<span class="badge badge-active">مقبول</span>',
            completed: '<span class="badge badge-done">مكتمل</span>',
            cancelled: '<span class="badge badge-cancel">ملغي</span>',
        };

        document.getElementById('recentOrders').innerHTML = orders.slice(0,5).map(o => `
            <tr>
                <td>#${o.id}</td>
                <td>${o.service}</td>
                <td dir="ltr" style="font-size:12px">+966${o.phone}</td>
                <td>${o.price} ر</td>
                <td>${statusBadge[o.status] || o.status}</td>
            </tr>
        `).join('');

        // أكثر الموردين نشاطاً
        document.getElementById('topProviders').innerHTML = providers.slice(0,5).map(p => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div class="provider-avatar-sm">👷</div>
                        <div>
                            <div style="font-size:13px;font-weight:600">${p.name}</div>
                            <div style="font-size:11px;color:var(--text3)">${p.service_type}</div>
                        </div>
                    </div>
                </td>
                <td>٠</td>
                <td>⭐ ${p.rating}</td>
                <td style="color:var(--gold)">٠ ر</td>
                <td style="color:var(--green)">٠٪</td>
            </tr>
        `).join('');

        // الرسوم البيانية
        buildCharts(orders);

    } catch(e) {
        console.log('خطأ في تحميل البيانات', e);
    }
}

// الرسوم البيانية
function buildCharts(orders) {
    // مخطط الطلبات
    const ctx1 = document.getElementById('ordersChart').getContext('2d');
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: Array.from({length:30}, (_,i) => `${i+1}`),
            datasets: [{
                label: 'الطلبات',
                data: Array.from({length:30}, () => Math.floor(Math.random()*20+5)),
                borderColor: '#F5C518',
                backgroundColor: 'rgba(245,197,24,0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Cairo' }, maxTicksLimit: 10 } },
                y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Cairo' } } }
            }
        }
    });

    // مخطط الإيرادات
    const ctx2 = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
            datasets: [{
                label: 'الإيرادات',
                data: [12000,18000,15000,22000,19000,25000,28000,24000,30000,26000,32000,35000],
                backgroundColor: '#F5C518',
                borderRadius: 6,
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Cairo', size: 10 } } },
                y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Cairo', size: 10 } } }
            }
        }
    });
}

// صفحة الطلبات
async function loadOrdersPage() {
    try {
        const res  = await fetch(`${API}/orders`);
        const data = await res.json();
        if (!data.success) return;

        const statusBadge = {
            pending:   '<span class="badge badge-pending">انتظار</span>',
            accepted:  '<span class="badge badge-active">مقبول</span>',
            completed: '<span class="badge badge-done">مكتمل</span>',
            cancelled: '<span class="badge badge-cancel">ملغي</span>',
        };

        document.getElementById('allOrdersTable').innerHTML = data.orders.map(o => `
            <tr>
                <td><strong>#${o.id}</strong></td>
                <td>${o.service}</td>
                <td dir="ltr">+966${o.phone}</td>
                <td>الرياض</td>
                <td>${o.price} ر</td>
                <td style="color:var(--gold)">${o.commission} ر</td>
                <td>${statusBadge[o.status] || o.status}</td>
                <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
                <td>
                    <select onchange="updateStatus(${o.id},this.value)"
                        style="font-family:Cairo,sans-serif;font-size:12px;padding:4px 8px;border-radius:6px;border:1px solid #ddd;cursor:pointer">
                        <option value="pending"   ${o.status==='pending'   ?'selected':''}>انتظار</option>
                        <option value="accepted"  ${o.status==='accepted'  ?'selected':''}>قبول</option>
                        <option value="completed" ${o.status==='completed' ?'selected':''}>مكتمل</option>
                        <option value="cancelled" ${o.status==='cancelled' ?'selected':''}>إلغاء</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch(e) {}
}

// صفحة الموردين
async function loadProvidersPage() {
    try {
        const res  = await fetch(`${API}/providers`);
        const data = await res.json();
        if (!data.success) return;

        const levelLabel = { basic:'🥈 أساسي', verified:'🥇 موثق', business:'🏆 شركة' };

        document.getElementById('allProvidersTable').innerHTML = data.providers.map(p => `
            <tr>
                <td>#${p.id}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="width:32px;height:32px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center">👷</div>
                        ${p.name}
                    </div>
                </td>
                <td dir="ltr">+966${p.phone}</td>
                <td>${p.service_type}</td>
                <td>${levelLabel[p.level] || p.level}</td>
                <td>⭐ ${p.rating}</td>
                <td>${p.is_available ? '<span class="badge badge-done">متاح</span>' : '<span class="badge badge-cancel">مشغول</span>'}</td>
                <td>
                    <button class="btn-detail" style="background:#10B981;color:#fff;border-color:#10B981">قبول</button>
                    <button class="btn-detail" style="background:#EF4444;color:#fff;border-color:#EF4444;margin-right:4px">رفض</button>
                </td>
            </tr>
        `).join('');
    } catch(e) {}
}

// صفحة العملاء
async function loadClientsPage() {
    try {
        const res  = await fetch(`${API}/users`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('allUsersTable').innerHTML = data.users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td dir="ltr">+966${u.phone}</td>
                <td>٠</td>
                <td style="color:var(--gold)">٠ ر</td>
                <td>${u.verified ? '✅ موثق' : '❌ غير موثق'}</td>
                <td>${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
            </tr>
        `).join('');
    } catch(e) {}
}

// تحديث حالة الطلب
async function updateStatus(id, status) {
    try {
        await fetch(`${API}/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    } catch(e) {}
}

// تحقق من الجلسة
if (sessionStorage.getItem('yashjub_admin') === 'true') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'flex';
    loadDashboard();
}