// كود لوحة المزود

const API = window.location.origin + '/api';

let countdownInterval;
let countdownSeconds = 60;
let allOrders = [];
let currentProviderId = null;
let editingProductId   = null;
let productMap    = null;
let productMarker = null;

// تحميل الصفحة
function loadProvider() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type');

    if (!phone || type !== 'provider') {
        alert('⚠️ هذه الصفحة للمزودين فقط');
        window.location.href = 'login.html';
        return;
    }

    // تحديث البيانات
    document.getElementById('providerName').textContent        = 'مزود خدمة';
    document.getElementById('providerPhone').textContent       = `+966${phone}`;
    document.getElementById('providerNameSidebar').textContent = 'مزود خدمة';
    document.getElementById('providerPhoneSidebar').textContent = `+966${phone}`;

    // تحميل الطلبات
    loadOrders(phone);

    // تحميل بيانات المزود (لمعرفة نوع الخدمة وإظهار قسم المنتجات)
    loadProviderProfile(phone);

    // محاكاة طلب وارد
    simulateIncomingOrder();
}

// تحميل بيانات المزود الحالي
async function loadProviderProfile(phone) {
    try {
        const res  = await fetch(`${API}/providers`);
        const data = await res.json();

        if (!data.success) return;

        const me = data.providers.find(p => p.phone === phone);
        if (!me) return;

        if (me.service_type === 'حاوية') {
            currentProviderId = me.id;
            document.getElementById('myProductsSection').style.display = 'block';
            loadProducts();
        }
    } catch (e) {
        console.log('خطأ في تحميل بيانات المزود');
    }
}

// تحميل الطلبات
async function loadOrders(phone) {
    try {
        const res  = await fetch(`${API}/orders/user/${phone}`);
        const data = await res.json();

        if (data.success) {
            allOrders = data.orders;
            renderOrders(allOrders);
            updateStats(allOrders);
            updateWallet(allOrders);
        }
    } catch(e) {
        console.log('خطأ في تحميل الطلبات');
    }
}

// تحديث الإحصائيات
function updateStats(orders) {
    const today     = new Date().toLocaleDateString('ar-SA');
    const todayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at).toLocaleDateString('ar-SA');
        return orderDate === today;
    });

    const weekRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.price - o.commission), 0);

    document.getElementById('statToday').textContent = todayOrders.length;
    document.getElementById('statWeek').textContent  = weekRevenue.toLocaleString();
    document.getElementById('ordersCount').textContent = `${orders.length} طلب`;
}

// تحديث المحفظة
function updateWallet(orders) {
    const completed = orders.filter(o => o.status === 'completed');
    const pending   = orders.filter(o => o.status === 'pending');

    const totalEarned   = completed.reduce((sum, o) => sum + (o.price - o.commission), 0);
    const pendingAmount = pending.reduce((sum, o) => sum + o.price, 0);

    document.getElementById('walletBalance').textContent  = `${totalEarned.toLocaleString()} ريال`;
    document.getElementById('walletTotal').textContent    = totalEarned.toLocaleString();
    document.getElementById('walletPending').textContent  = pendingAmount.toLocaleString();
    document.getElementById('walletWithdrawn').textContent = '0';
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
        pending:   { label: 'انتظار',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
        accepted:  { label: 'مقبول',   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
        completed: { label: 'مكتمل',   color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
        cancelled: { label: 'ملغي',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
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
                ${o.status === 'accepted' ? `
                <button class="btn-complete-order" onclick="completeOrder(${o.id})">
                    <svg class="icon"><use href="icons.svg#icon-check"></use></svg> تأكيد الاكتمال
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

// محاكاة طلب وارد
function simulateIncomingOrder() {
    const phone = localStorage.getItem('yashjub_phone');

    // شوف إذا في طلب في localStorage
    const savedOrder = localStorage.getItem('yashjub_order');
    if (savedOrder) {
        const order = JSON.parse(savedOrder);
        document.getElementById('newOrderService').textContent = `${order.icon} ${order.service}`;
        document.getElementById('newOrderAddress').textContent = order.address;
        document.getElementById('newOrderAmount').textContent  = `${order.price} ريال`;
        document.getElementById('newOrderClient').textContent  = `+966${phone}`;
        document.getElementById('newOrderSection').style.display = 'block';
        startCountdown();
    } else {
        document.getElementById('newOrderSection').style.display = 'none';
    }
}

// العداد التنازلي
function startCountdown() {
    countdownSeconds = 60;
    const fill = document.getElementById('countdownFill');
    const num  = document.getElementById('countdownNum');

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        countdownSeconds--;
        num.textContent  = countdownSeconds;
        fill.style.width = `${(countdownSeconds / 60) * 100}%`;

        if (countdownSeconds <= 0) {
            clearInterval(countdownInterval);
            rejectOrder();
        }
    }, 1000);
}

// قبول الطلب
function acceptOrder() {
    clearInterval(countdownInterval);
    document.getElementById('newOrderSection').style.display = 'none';

    const savedOrder = localStorage.getItem('yashjub_order');
    if (savedOrder) {
        const order = JSON.parse(savedOrder);
        const net   = Math.round(order.price * 0.95);

        // تحديث الإحصائيات
        const current = parseInt(document.getElementById('statToday').textContent) || 0;
        document.getElementById('statToday').textContent = current + 1;

        alert(`✅ تم قبول الطلب!\n\nتوجه للموقع المحدد:\n📍 ${order.address}\n\nصافي أرباحك: ${net} ريال`);
        localStorage.removeItem('yashjub_order');

        // تحديث الصفحة
        loadProvider();
    }
}

// رفض الطلب
function rejectOrder() {
    clearInterval(countdownInterval);
    document.getElementById('newOrderSection').style.display = 'none';
    localStorage.removeItem('yashjub_order');
}

// تأكيد اكتمال الطلب
async function completeOrder(id) {
    if (!confirm('هل اكتملت الخدمة؟')) return;

    try {
        await fetch(`${API}/orders/${id}/status`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status: 'completed' })
        });

        alert('✅ تم تأكيد اكتمال الخدمة!');
        loadProvider();
    } catch(e) {
        alert('❌ خطأ في الاتصال');
    }
}

// تغيير حالة التوفر
function toggleAvailability() {
    const toggle = document.getElementById('availToggle');
    const label  = document.getElementById('availLabel');

    if (toggle.checked) {
        label.textContent    = 'متاح';
        label.style.color    = '#10B981';
    } else {
        label.textContent    = 'مشغول';
        label.style.color    = '#EF4444';
        clearInterval(countdownInterval);
        document.getElementById('newOrderSection').style.display = 'none';
    }
}

// طلب سحب
function requestWithdraw() {
    const balance = document.getElementById('walletBalance').textContent;
    alert(`💳 طلب سحب\n\nالرصيد المتاح: ${balance}\n\nسيتم تحويل المبلغ لحسابك البنكي خلال 24-72 ساعة`);
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

// ══ منتجات مزود الحاوية ══

const productSizeLabels = { small: 'صغيرة (3م)', medium: 'متوسطة (6م)', large: 'كبيرة (12م)' };

// تحميل المنتجات
async function loadProducts() {
    try {
        const res  = await fetch(`${API}/products/provider/${currentProviderId}`);
        const data = await res.json();

        if (data.success) {
            renderProducts(data.products);
        }
    } catch (e) {
        console.log('خطأ في تحميل المنتجات');
    }
}

// عرض المنتجات
function renderProducts(products) {
    const container = document.getElementById('productsList');

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg class="icon"><use href="icons.svg#icon-box"></use></svg></div>
                <div class="empty-title">لا يوجد منتجات بعد</div>
                <div class="empty-sub">أضف أول منتج لك الآن!</div>
            </div>`;
        return;
    }

    container.innerHTML = products.map(p => `
        <div class="product-item">
            <div class="product-item-top">
                <div>
                    <div class="product-item-name">${p.name}</div>
                    <div class="product-item-desc">${p.description || ''}</div>
                </div>
                <span class="product-item-status" style="${p.is_available
                    ? 'color:#10B981;background:rgba(16,185,129,0.1)'
                    : 'color:#EF4444;background:rgba(239,68,68,0.1)'}">
                    ${p.is_available ? 'متاح' : 'غير متاح'}
                </span>
            </div>
            <div class="product-item-details">
                <span><svg class="icon"><use href="icons.svg#icon-box"></use></svg> ${productSizeLabels[p.size] || p.size}</span>
                <span><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> ${p.price} ريال / ${p.min_days} أيام على الأقل</span>
                <span><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${p.city} — ${p.neighborhood}</span>
            </div>
            <div class="product-item-actions">
                <button class="btn-small" onclick='editProduct(${JSON.stringify(p)})'><svg class="icon"><use href="icons.svg#icon-edit-pencil"></use></svg> تعديل</button>
                <button class="btn-small btn-delete-product" onclick="deleteProduct(${p.id})"><svg class="icon"><use href="icons.svg#icon-trash"></use></svg> حذف</button>
            </div>
        </div>
    `).join('');
}

// إظهار/إخفاء فورم المنتج
function toggleProductForm() {
    const form = document.getElementById('productForm');
    const isHidden = form.style.display === 'none';

    if (isHidden) {
        form.style.display = 'block';
        initProductMap();
    } else {
        form.style.display = 'none';
        resetProductForm();
    }
}

// ══ خريطة اختيار موقع المنتج ══

function initProductMap() {
    if (!productMap) {
        productMap = L.map('productMap').setView([24.7136, 46.6753], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(productMap);

        productMap.on('click', (e) => setProductMarker(e.latlng.lat, e.latlng.lng));
    }

    // الخريطة كانت مخفية (display:none) — لازم نحدّث حجمها بعد ما تظهر
    setTimeout(() => productMap.invalidateSize(), 100);
}

function setProductMarker(lat, lng) {
    if (productMarker) {
        productMarker.setLatLng([lat, lng]);
    } else {
        productMarker = L.marker([lat, lng]).addTo(productMap);
    }

    document.getElementById('productLat').value = lat;
    document.getElementById('productLng').value = lng;
}

function useMyLocationForProduct() {
    if (!navigator.geolocation) {
        alert('❌ المتصفح ما يدعم تحديد الموقع');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            productMap.setView([latitude, longitude], 15);
            setProductMarker(latitude, longitude);
        },
        () => {
            alert('❌ ما قدرنا نحدد موقعك — تأكد من تفعيل صلاحية الموقع بالمتصفح');
        }
    );
}

// تفريغ الفورم
function resetProductForm() {
    editingProductId = null;
    document.getElementById('productName').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productSize').value = 'small';
    document.getElementById('productPrice').value = '';
    document.getElementById('productMinDays').value = '10';
    document.getElementById('productCity').value = '';
    document.getElementById('productNeighborhood').value = '';
    document.getElementById('productAvailable').value = '1';
    document.getElementById('productLat').value = '';
    document.getElementById('productLng').value = '';
    document.getElementById('saveProductBtn').textContent = 'حفظ المنتج';

    if (productMarker) {
        productMap.removeLayer(productMarker);
        productMarker = null;
    }
}

// حفظ منتج (إضافة أو تعديل)
async function saveProduct() {
    const name         = document.getElementById('productName').value.trim();
    const description  = document.getElementById('productDescription').value.trim();
    const size         = document.getElementById('productSize').value;
    const price        = document.getElementById('productPrice').value;
    const minDays      = document.getElementById('productMinDays').value;
    const city         = document.getElementById('productCity').value;
    const neighborhood = document.getElementById('productNeighborhood').value.trim();
    const isAvailable  = document.getElementById('productAvailable').value === '1';
    const lat          = document.getElementById('productLat').value || null;
    const lng          = document.getElementById('productLng').value || null;

    if (!name || !size || !price || !minDays || !city || !neighborhood) {
        alert('❌ يرجى تعبئة جميع الحقول المطلوبة');
        return;
    }

    try {
        const url    = editingProductId ? `${API}/products/${editingProductId}` : `${API}/products`;
        const method = editingProductId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                providerId: currentProviderId,
                name, description, size, price, minDays, city, neighborhood, isAvailable, lat, lng,
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('productForm').style.display = 'none';
            resetProductForm();
            loadProducts();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تعديل منتج
function editProduct(product) {
    editingProductId = product.id;

    document.getElementById('productName').value         = product.name;
    document.getElementById('productDescription').value  = product.description || '';
    document.getElementById('productSize').value         = product.size;
    document.getElementById('productPrice').value        = product.price;
    document.getElementById('productMinDays').value      = product.min_days;
    document.getElementById('productCity').value         = product.city;
    document.getElementById('productNeighborhood').value = product.neighborhood;
    document.getElementById('productAvailable').value    = product.is_available ? '1' : '0';
    document.getElementById('saveProductBtn').textContent = 'تحديث المنتج';

    document.getElementById('productForm').style.display = 'block';
    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });

    initProductMap();
    if (product.lat && product.lng) {
        setTimeout(() => {
            productMap.setView([product.lat, product.lng], 14);
            setProductMarker(product.lat, product.lng);
        }, 150);
    }
}

// حذف منتج
async function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    try {
        await fetch(`${API}/products/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تشغيل
loadProvider();