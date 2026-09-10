// كود صفحة الفاتورة

const API = window.location.origin + '/api';

const PAYMENT_STATUS_LABELS = {
    paid:    '✅ مدفوع',
    pending: '🕓 معلق',
};

async function loadInvoice() {
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    if (!orderId) {
        showInvoiceError();
        return;
    }

    try {
        let res  = await fetch(`${API}/invoices/${orderId}`);
        let data = await res.json();

        // لو ما فيه فاتورة بعد (مثلاً طلب اكتمل قبل إضافة نظام الفواتير) نحاول ننشئها الآن
        if (!data.success) {
            res  = await fetch(`${API}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
            });
            data = await res.json();
        }

        if (!data.success) {
            showInvoiceError();
            return;
        }

        renderInvoice(data.invoice);

        if (params.get('autoprint') === '1') {
            setTimeout(() => window.print(), 400);
        }
    } catch (e) {
        showInvoiceError();
    }
}

function showInvoiceError() {
    document.getElementById('invoiceLoading').style.display = 'none';
    document.getElementById('invoiceError').style.display   = 'block';
}

function renderInvoice(inv) {
    document.getElementById('invoiceLoading').style.display = 'none';
    document.getElementById('invoiceContent').style.display = 'block';

    document.title = `فاتورة ${inv.invoice_number} - غَوْث`;

    document.getElementById('invNumber').textContent = inv.invoice_number;
    document.getElementById('invDate').textContent   = new Date(inv.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA');

    document.getElementById('invClientName').textContent  = inv.client_name || 'عميل غَوْث';
    document.getElementById('invClientPhone').textContent = `+966${inv.client_phone}`;

    document.getElementById('invService').textContent = inv.service;
    document.getElementById('invAddress').textContent = inv.address || '—';
    document.getElementById('invOrderId').textContent = `#${inv.order_id}`;

    document.getElementById('invPrice').textContent      = `${inv.price} ريال`;
    document.getElementById('invCommission').textContent = `${inv.commission} ريال`;
    document.getElementById('invTotal').textContent      = `${inv.total} ريال`;

    document.getElementById('invPaidBadge').textContent      = PAYMENT_STATUS_LABELS[inv.payment_status] || inv.payment_status;
    document.getElementById('invPaymentMethod').textContent  = inv.payment_method;
}

loadInvoice();
