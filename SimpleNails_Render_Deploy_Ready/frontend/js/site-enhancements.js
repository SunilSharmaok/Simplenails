/* SimpleNails UX 2.0 — safe attachment lists, three-step checkout and dashboard.
   This file intentionally extends the existing site without requiring a new build tool. */
'use strict';
const projectAssets = { files: [], links: [], uploadPending: false };
let uploadSequence = 0;
let clearingUploadWidget = false;
let projectPaymentBusy = false;
const PENDING_ORDER_KEY = 'sn_v2_pending_order';
const PROJECT_PRICES = {
    'Basic - Light edits': 100,
    'Full - Advanced edits': 1000,
    'Custom - specified what customer need': 2000
};
const byId = id => document.getElementById(id);
function safeLink(raw) {
    try {
        if (typeof raw !== 'string' || raw.length > 2000) return null;
        const link = new URL(raw);
        if (link.protocol !== 'https:' || link.username || link.password || link.port || link.hash ||
            /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)|\.(local|internal|localhost)$/i.test(link.hostname) ||
            /^\d+\.\d+\.\d+\.\d+$/.test(link.hostname)) return null;
        return link.href;
    } catch { return null; }
}
function addTextNode(tag, value, className = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
}
function savePendingOrder(pending) { try { sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(pending)); } catch { console.warn('Session storage unavailable; payment can still continue.'); } }
function clearPendingOrder() { try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* storage unavailable */ } }
function getPendingOrder() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_ORDER_KEY) || 'null'); } catch { return null; }
}
function syncRecoveryButton() {
    const info = getPendingOrder();
    const activeUser = auth?.currentUser;
    const button = byId('recover-payment-btn');
    if (button) button.hidden = !(info?.orderId && info?.uid && info.uid === activeUser?.uid);
}
function markUploadError(message) {
    const error = byId('asset-error');
    if (error) { error.textContent = message || ''; error.hidden = !message; }
}
function uploadStatus(message) {
    const status = byId('upload-status');
    if (status) status.textContent = message || '';
}
function assetCount() { return projectAssets.files.length + projectAssets.links.length; }
function renderAssets() {
    const container = byId('file-previews');
    if (!container) return;
    container.replaceChildren();
    if (!assetCount()) {
        const empty = addTextNode('p', 'No attachments yet. Upload files or add a link above.', 'asset-empty');
        container.appendChild(empty);
    }
    const rows = [
        ...projectAssets.files.map((file, i) => ({ ...file, type: 'file', position: i })),
        ...projectAssets.links.map((link, i) => ({ ...link, type: 'link', position: i }))
    ];
    rows.forEach(asset => {
        const row = document.createElement('div'); row.className = 'asset-item';
        const icon = addTextNode('span', asset.type === 'file' ? '↥' : '↗', 'asset-item-icon');
        const meta = document.createElement('div'); meta.className = 'asset-item-meta';
        meta.appendChild(addTextNode('strong', asset.type === 'file' ? asset.name : asset.label, 'asset-item-title'));
        const info = asset.type === 'file' ? `${asset.size ? (asset.size / 1024 / 1024).toFixed(2) + ' MB' : 'Uploaded file'} · Uploaded` : `${new URL(asset.url).hostname} · Linked`;
        meta.appendChild(addTextNode('span', info, 'asset-item-subtitle'));
        const open = document.createElement('a'); open.className = 'asset-item-open'; open.textContent = 'Open';
        open.href = asset.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
        open.setAttribute('aria-label', `Open ${asset.type === 'file' ? asset.name : asset.label} in new tab`);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'asset-item-remove';
        remove.textContent = '×'; remove.title = 'Remove attachment';
        remove.setAttribute('aria-label', `Remove ${asset.type === 'file' ? asset.name : asset.label}`);
        remove.addEventListener('click', () => {
            if (formLocked || projectPaymentBusy) return;
            projectAssets[asset.type === 'file' ? 'files' : 'links'].splice(asset.position, 1);
            markUploadError(''); uploadStatus(''); renderAssets();
        });
        row.append(icon, meta, open, remove); container.appendChild(row);
    });
    const badge = byId('asset-count'); if (badge) badge.textContent = `${assetCount()} / 20`;
    const hidden = byId('file_hidden'); if (hidden) hidden.value = projectAssets.files[0]?.url || projectAssets.links[0]?.url || '';
}
function addLinkFromInputs() {
    if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
    if (formLocked || projectPaymentBusy) return;
    const input = byId('asset-url-input');
    const url = safeLink(input?.value.trim());
    if (!url) { markUploadError('Enter a valid public HTTPS link (not a local/private address).'); input?.focus(); return; }
    if (projectAssets.links.length >= 15 || assetCount() >= 20) { markUploadError('Limit reached: 15 links and 20 attachments in total.'); return; }
    if ([...projectAssets.files, ...projectAssets.links].some(item => item.url === url)) { markUploadError('That link is already included.'); return; }
    const label = byId('asset-link-name')?.value.trim().slice(0, 120) || new URL(url).hostname;
    projectAssets.links.push({ url, label });
    input.value = ''; byId('asset-link-name').value = '';
    markUploadError(''); renderAssets(); input.focus();
}

function initFileUpload() {
    if (!byId('projectForm')) return;
    byId('add-url-btn')?.addEventListener('click', addLinkFromInputs);
    byId('asset-url-input')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); addLinkFromInputs(); }
    });
    byId('paste-url-btn')?.addEventListener('click', async () => {
        if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
        try {
            const url = await navigator.clipboard.readText();
            byId('asset-url-input').value = url.trim();
            addLinkFromInputs();
        } catch { byId('asset-url-input').focus(); markUploadError('Clipboard unavailable. Paste the URL into the box, then select Add link.'); }
    });
    if (typeof uploadcare === 'undefined' || typeof uploadcare.MultipleWidget !== 'function') {
        uploadStatus('File uploads are unavailable right now. You can still add links, or refresh to retry.');
        return;
    }
    try {
        uploadcareWidget = uploadcare.MultipleWidget('#uploadcare-file');
        uploadcareWidget.onChange(group => {
            if (!group || clearingUploadWidget) return;
            const sequence = ++uploadSequence;
            const items = group.files?.() || [];
            if (!Array.isArray(items) || !items.length) return;
            projectAssets.uploadPending = true;
            markUploadError(''); uploadStatus(`Uploading ${items.length} file(s)… Please finish before continuing.`);
            Promise.all(items.map(file => new Promise((resolve, reject) => file.done(resolve).fail(reject))))
                .then(infos => {
                    if (sequence !== uploadSequence) return;
                    const added = [];
                    for (const info of infos) {
                        const url = safeLink(info.cdnUrl);
                        const size = Number(info.size || 0);
                        if (!url || new URL(url).hostname !== 'ucarecdn.com' || size > 10 * 1024 * 1024) throw new Error('One file is invalid or exceeds 10 MB.');
                        if (projectAssets.files.some(file => file.url === url)) continue;
                        if (projectAssets.files.length + added.length >= 15 || assetCount() + added.length >= 20) throw new Error('You can attach up to 15 files and 20 items in total.');
                        added.push({ name: String(info.name || 'Uploaded file').slice(0, 200), size, url });
                    }
                    projectAssets.files.push(...added);
                    uploadStatus(`${added.length} file(s) uploaded successfully. You can add another batch.`);
                    renderAssets();
                    clearingUploadWidget = true;
                    uploadcareWidget.value(null); // We keep uploaded files in projectAssets to allow another batch.
                    setTimeout(() => { clearingUploadWidget = false; }, 0);
                })
                .catch(error => markUploadError(error.message || 'Upload failed. Try selecting the files again.'))
                .finally(() => { if (sequence === uploadSequence) { projectAssets.uploadPending = false; } });
        });
    } catch (error) {
        console.error('Uploadcare initialization:', error);
        uploadStatus('File uploader could not initialize. Please refresh or use cloud links.');
    }
    renderAssets();
}
function validateStep(step) {
    if (String(step) === '1') {
        const fields = ['nameField', 'emailField', 'mobileField', 'serviceField', 'editingPreferences', 'messageField'];
        for (const id of fields) {
            const field = byId(id);
            if (!field || !field.value.trim() || !field.checkValidity()) {
                showAlert('Please check your details', 'Complete each required field with a valid value before continuing.', 'warning');
                field?.focus(); return false;
            }
        }
        if (!/^\d{10}$/.test(byId('mobileField').value.trim())) {
            showAlert('Check mobile number', 'Please enter a valid 10-digit mobile number.', 'warning'); byId('mobileField').focus(); return false;
        }
        return true;
    }
    if (String(step) === '2') {
        if (projectAssets.uploadPending) { markUploadError('Your files are still uploading. Wait until the upload finishes.'); return false; }
        if (!assetCount()) { markUploadError('Add at least one uploaded file or HTTPS link to continue.'); return false; }
        if (assetCount() > 20 || projectAssets.files.length > 15 || projectAssets.links.length > 15) { markUploadError('Attachment limit exceeded.'); return false; }
        markUploadError(''); return true;
    }
    return true;
}
function showProjectStep(step) {
    document.querySelectorAll('.form-step').forEach(panel => { panel.classList.toggle('active', panel.dataset.step === String(step)); });
    updateProgressSteps(String(step));
    if (step === 3) updateReviewSection();
    byId('project-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function initFormSteps() {
    if (!byId('projectForm')) return;
    byId('projectForm').addEventListener('submit', event => event.preventDefault());
    ['nameField', 'emailField', 'mobileField', 'messageField', 'asset-link-name'].forEach(id => {
        const element = byId(id);
        if (element) element.maxLength = ({ nameField: 120, emailField: 254, mobileField: 20, messageField: 5000 })[id] || 120;
    });
    document.querySelectorAll('.next-step').forEach(button => button.addEventListener('click', () => {
        if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
        if (formLocked || projectPaymentBusy) return;
        const current = document.querySelector('.form-step.active');
        if (current && validateStep(current.dataset.step)) showProjectStep(Number(button.dataset.next));
    }));
    document.querySelectorAll('.prev-step').forEach(button => button.addEventListener('click', () => {
        if (!projectPaymentBusy && !formLocked) showProjectStep(Number(button.dataset.prev));
    }));
    const cancel = () => Swal.fire({
        title: 'Clear this project?', text: 'All selected attachments and your project details will be cleared.',
        icon: 'question', showCancelButton: true, confirmButtonText: 'Clear project', cancelButtonText: 'Keep editing',
        customClass: { popup: 'sn-dialog', confirmButton: 'sn-confirm', cancelButton: 'sn-cancel' }, buttonsStyling: false
    }).then(result => { if (result.isConfirmed) resetForm(); });
    byId('cancel-form-btn')?.addEventListener('click', cancel);
    if (!byId('cancel-step3-btn')) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'cancel-step3-btn'; btn.className = 'btn btn-outline';
        btn.textContent = 'Clear project'; btn.addEventListener('click', cancel);
        document.querySelector('.form-step[data-step="3"] .form-navigation')?.append(btn);
    }
    byId('serviceField')?.addEventListener('change', () => { byId('service_hidden').value = byId('serviceField').value; });
    byId('editingPreferences')?.addEventListener('change', () => {
        const level = byId('editingPreferences').value;
        byId('editing_preferences_hidden').value = level;
        currentAmount = PROJECT_PRICES[level] || 0; updateAmountDisplay();
    });
}
function updateReviewSection() {
    if (!currentSubmissionId) {
        currentSubmissionId = 'SN-' + Date.now().toString(36).toUpperCase() + '-' + (globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)).toUpperCase();
    }
    const fields = { 'review-name': 'nameField', 'review-email': 'emailField', 'review-mobile': 'mobileField',
        'review-message': 'messageField', 'review-service': 'serviceField', 'review-editing': 'editingPreferences' };
    for (const [label, field] of Object.entries(fields)) if (byId(label)) byId(label).textContent = byId(field)?.value || 'Not selected';
    if (byId('review-project-id')) byId('review-project-id').textContent = currentSubmissionId;
    if (byId('review-files')) byId('review-files').textContent = `${projectAssets.files.length} file(s) · ${projectAssets.links.length} link(s)`;
    const list = byId('review-attachments'); if (list) {
        list.replaceChildren();
        [...projectAssets.files.map(file => file.name), ...projectAssets.links.map(link => link.label)].forEach(name => list.append(addTextNode('span', '• ' + name, 'review-asset')));
    }
    currentAmount = PROJECT_PRICES[byId('editingPreferences')?.value] || 0;
    if (byId('review-total')) byId('review-total').textContent = `₹${currentAmount / 100}`;
    updateAmountDisplay();
    syncRecoveryButton();
}
function resetForm() {
    const form = byId('projectForm'); if (!form) return;
    form.reset(); projectAssets.files = []; projectAssets.links = []; projectAssets.uploadPending = false;
    uploadSequence++; clearingUploadWidget = true;
    uploadcareWidget?.value(null);
    setTimeout(() => { clearingUploadWidget = false; }, 0);
    currentAmount = 0; currentSubmissionId = null; formLocked = false; projectPaymentBusy = false;
    ['service_hidden', 'editing_preferences_hidden', 'file_hidden'].forEach(id => { if (byId(id)) byId(id).value = ''; });
    markUploadError(''); uploadStatus(''); renderAssets(); updateAmountDisplay(); showProjectStep(1);
}
function orderDraftFromForm() {
    return {
        projectId: currentSubmissionId,
        name: byId('nameField').value.trim(), email: byId('emailField').value.trim(),
        mobile: byId('mobileField').value.trim(), service: byId('serviceField').value,
        editingPreferences: byId('editingPreferences').value, message: byId('messageField').value.trim(),
        files: projectAssets.files.map(({ url, name, size }) => ({ url, name, size })),
        links: projectAssets.links.map(({ url, label }) => ({ url, label })),
        nda: byId('nda').checked, termsAccepted: byId('terms-agreement').checked
    };
}
function setPaymentBusy(busy) {
    projectPaymentBusy = busy; formLocked = busy;
    const button = byId('pay-submit-btn'); if (button) { button.disabled = busy; button.classList.toggle('is-busy', busy); }
    const recover = byId('recover-payment-btn'); if (recover) recover.disabled = busy;
    document.querySelectorAll('#projectForm .prev-step, #projectForm .next-step, #projectForm .asset-item-remove, #projectForm #add-url-btn, #projectForm #cancel-step3-btn').forEach(node => { node.disabled = busy; });
    if (uploadcareWidget?.input) uploadcareWidget.input.disabled = busy;
    ['nameField', 'emailField', 'mobileField', 'messageField', 'asset-url-input', 'asset-link-name', 'serviceField', 'editingPreferences', 'terms-agreement', 'nda'].forEach(id => {
        const node = byId(id); if (node) node.disabled = busy;
    });
}
async function paymentCompleted(result) {
    clearPendingOrder(); syncRecoveryButton();
    await Swal.fire({ title: 'Project confirmed!',
        text: `Project ${result.projectId || currentSubmissionId} has been received. ${result.emailSent === false ? 'Your email could not be sent, but your submission is saved.' : 'Check your inbox for an update.'}`,
        icon: 'success', confirmButtonText: 'View my projects',
        customClass: { popup: 'sn-dialog', confirmButton: 'sn-confirm' }, buttonsStyling: false
    });
    window.location.assign('submissions.html');
}
async function recoverExistingPayment() {
    const pending = getPendingOrder();
    if (!pending || pending.uid !== auth?.currentUser?.uid) return showAlert('No pending payment', 'No previous payment is available for this account.', 'info');
    if (projectPaymentBusy) return;
    setPaymentBusy(true);
    try {
        const result = await apiRequest('/payments/recover', { method: 'POST', body: { orderId: pending.orderId } });
        await paymentCompleted(result);
    } catch (error) { showAlert('Payment recovery', error.message || 'Unable to check this payment. Try again later.', 'warning'); }
    finally { setPaymentBusy(false); }
}
function initPaymentMethods() {
    if (!byId('projectForm')) return;
    byId('pay-submit-btn')?.addEventListener('click', startRazorpayPayment);
    byId('recover-payment-btn')?.addEventListener('click', recoverExistingPayment);
    auth?.onAuthStateChanged(() => syncRecoveryButton());
    syncRecoveryButton();
}
window.startRazorpayPayment = async function startRazorpayPayment() {
    if (projectPaymentBusy) return;
    if (!auth?.currentUser) return showLoginRequiredPopup();
    if (!validateStep('1') || !validateStep('2')) { showAlert('Review the form', 'Please complete your details and finish adding attachments.', 'warning'); return; }
    if (!byId('terms-agreement').checked) { showAlert('Terms required', 'Please accept the Terms & Conditions before paying.', 'warning'); return; }
    if (typeof Razorpay !== 'function') { showAlert('Checkout unavailable', 'Razorpay checkout did not load. Refresh the page and retry.', 'error'); return; }
    const previousOrder = getPendingOrder();
    if (previousOrder?.orderId && previousOrder.uid === auth.currentUser.uid) {
        const choice = await Swal.fire({ title: 'Check your previous payment?',
            text: 'An earlier checkout is still pending. To avoid duplicate charges, check its status before paying again.',
            icon: 'question', showDenyButton: true, showCancelButton: true,
            confirmButtonText: 'Recover payment', denyButtonText: 'Make a new payment', cancelButtonText: 'Go back',
            customClass: { popup: 'sn-dialog', confirmButton: 'sn-confirm', denyButton: 'sn-cancel', cancelButton: 'sn-cancel' }, buttonsStyling: false });
        if (choice.isConfirmed) { await recoverExistingPayment(); return; }
        if (!choice.isDenied) return;
    }
    if (!currentSubmissionId) updateReviewSection();
    const draft = orderDraftFromForm();
    setPaymentBusy(true);
    try {
        const order = await apiRequest('/payments/create-order', { method: 'POST', body: draft });
        const userId = auth.currentUser.uid;
        savePendingOrder({ orderId: order.orderId, uid: userId, projectId: draft.projectId });
        syncRecoveryButton();
        const checkout = new Razorpay({
            key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
            name: 'SimpleNails', description: `${draft.editingPreferences} · ${draft.projectId}`,
            prefill: { name: draft.name, email: draft.email, contact: draft.mobile },
            theme: { color: '#26a48a' },
            handler: async payment => {
                try {
                    Swal.fire({ title: 'Verifying your payment', text: 'Please keep this page open while we save your project.', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading(), customClass: { popup: 'sn-dialog' } });
                    const result = await apiRequest('/submissions', { method: 'POST', body: { payment } });
                    Swal.close(); await paymentCompleted(result);
                } catch (error) {
                    Swal.close();
                    showAlert('Payment received? Recover it safely', `${error.message} Use Recover previous payment before starting another payment.`, 'warning');
                } finally { setPaymentBusy(false); syncRecoveryButton(); }
            },
            modal: { ondismiss: () => { if (projectPaymentBusy) { setPaymentBusy(false); syncRecoveryButton(); } } }
        });
        checkout.on('payment.failed', response => {
            setPaymentBusy(false);
            showAlert('Payment not completed', response.error?.description || 'The payment was not completed. If you were charged, use recovery.', 'warning');
        });
        checkout.open();
    } catch (error) {
        setPaymentBusy(false);
        showAlert('Checkout error', error.message || 'Could not start checkout. Please retry.', 'error');
    }
};
function showAlert(title, message, icon = 'info') {
    if (typeof Swal === 'undefined') { window.alert(`${title}\n${message}`); return; }
    return Swal.fire({ title, text: String(message || ''), icon, confirmButtonText: 'Got it',
        customClass: { popup: 'sn-dialog', confirmButton: 'sn-confirm' }, buttonsStyling: false });
}
function renderFirebaseGoogleButton() {
    for (const id of ['desktop-login-container','mobile-login-container','login-overlay-container']) {
        const container = byId(id); if (!container || auth?.currentUser) continue;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'firebase-google-btn sn-google-btn';
        button.append(addTextNode('span', 'G', 'google-mark'), addTextNode('span', 'Continue with Google'));
        button.addEventListener('click', handleFirebaseGoogleSignIn);
        container.replaceChildren(button);
    }
}
function updateUserProfile(currentUser) {
    for (const id of ['desktop-login-container', 'mobile-login-container']) {
        const container = byId(id); if (!container) continue;
        const profile = document.createElement('div'); profile.className = 'user-profile sn-profile';
        const avatar = document.createElement('span'); avatar.className = 'sn-avatar';
        avatar.textContent = (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
        const name = addTextNode('span', currentUser.displayName || 'Your account', 'user-name');
        const logout = document.createElement('button'); logout.className = 'logout-btn'; logout.type = 'button';
        logout.textContent = 'Sign out'; logout.addEventListener('click', handleFirebaseLogout);
        profile.append(avatar, name, logout); container.replaceChildren(profile);
    }
    const overlay = byId('login-overlay-container'); if (overlay) overlay.replaceChildren();
}
async function initContactForm() {
    const form = byId('contactForm'); if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const button = form.querySelector('button[type="submit"]');
        if (button?.disabled) return;
        button.disabled = true;
        const data = Object.fromEntries(new FormData(form).entries());
        try {
            const response = await apiRequest('/contact', { method: 'POST', body: data });
            form.reset();
            showAlert('Your message is saved', response.emailSent ? 'We sent a confirmation to your inbox.' : 'We received your message. Email confirmation is currently unavailable.', 'success');
        } catch (error) { showAlert('Could not send message', error.message || 'Please try again.', 'error'); }
        finally { button.disabled = false; }
    });
}
function safeExternalAnchor(url, title) {
    const value = safeLink(url);
    if (!value) return addTextNode('span', 'Link unavailable');
    const node = document.createElement('a'); node.href = value; node.textContent = title || 'Open file';
    node.target = '_blank'; node.rel = 'noopener noreferrer'; node.className = 'file-link';
    return node;
}
function createListItem(submission) {
    const item = document.createElement('div'); item.className = 'list-item';
    const status = getStatusInfo(submission.status), editing = getEditingStatusInfo(submission.editing_status);
    const fields = [
        ['project-id', 'Project ID', submission.project_id || 'N/A'], ['service', 'Service', submission.service || 'N/A'],
        ['status ' + status.class, 'Status', status.text], ['editing-status ' + editing.class, 'Editing Status', editing.text],
        ['date', 'Date', formatDate(submission.timestamp)]
    ];
    for (const [klass, label, value] of fields) {
        const cell = addTextNode('div', value, klass); cell.dataset.label = label; item.appendChild(cell);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    const view = addTextNode('button', 'View', 'action-btn view-details'); view.type = 'button';
    view.addEventListener('click', () => showSubmissionDetails(submission.id)); actions.append(view);
    if (submission.edited_files?.length) {
        const download = addTextNode('button', 'Download', 'file-link'); download.type = 'button';
        download.addEventListener('click', () => downloadEditedFiles(submission.id)); actions.append(download);
    }
    item.append(actions); return item;
}
function createGridCard(submission) {
    const card = document.createElement('div'); card.className = 'grid-card';
    const header = document.createElement('div'); header.className = 'grid-card-header';
    header.append(addTextNode('div', submission.project_id || 'N/A', 'grid-card-id'), addTextNode('div', formatDate(submission.timestamp), 'grid-card-date'));
    const content = document.createElement('div'); content.className = 'grid-card-content';
    const values = [ ['Service', submission.service || 'N/A'], ['Editing level', submission.editing_preferences || 'N/A'],
        ['Upload status', getStatusInfo(submission.status).text], ['Editing status', getEditingStatusInfo(submission.editing_status).text],
        ['Attachments', String((submission.files?.length || 0) + (submission.links?.length || 0) || (submission.file ? 1 : 0))] ];
    values.forEach(([label, value]) => {
        const wrap = document.createElement('div'); wrap.className = 'grid-detail';
        wrap.append(addTextNode('div', `${label}:`, 'grid-detail-label'), addTextNode('div', value, 'grid-detail-value'));
        content.append(wrap);
    });
    const actions = document.createElement('div'); actions.className = 'grid-card-actions';
    const view = addTextNode('button', 'View project', 'action-btn view-details'); view.type = 'button';
    view.addEventListener('click', () => showSubmissionDetails(submission.id)); actions.append(view);
    if (submission.edited_files?.length) {
        const down = addTextNode('button', `Download (${submission.edited_files.length})`, 'file-link'); down.type = 'button';
        down.addEventListener('click', () => downloadEditedFiles(submission.id)); actions.append(down);
    }
    card.append(header, content, actions); return card;
}
async function showSubmissionDetails(id) {
    try {
        const { submission } = await apiRequest(`/submissions/${encodeURIComponent(id)}`);
        if (!submission) throw new Error('Project not found.');
        closeDetailsModal();
        const overlay = document.createElement('div'); overlay.className = 'details-modal sn-details-modal active';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Project details');
        const box = document.createElement('div'); box.className = 'modal-content sn-details-content';
        const header = document.createElement('div'); header.className = 'modal-header';
        header.append(addTextNode('h3', 'Project details'));
        const close = addTextNode('button', '×', 'close-modal'); close.type = 'button'; close.setAttribute('aria-label', 'Close project details');
        close.addEventListener('click', closeDetailsModal); header.append(close); box.append(header);
        const details = document.createElement('div'); details.className = 'modal-details';
        const addDetail = (label, value) => {
            const wrap = document.createElement('div'); wrap.className = 'modal-detail';
            wrap.append(addTextNode('div', label, 'modal-detail-label'));
            const field = document.createElement('div'); field.className = 'modal-detail-value';
            if (typeof value === 'string') field.textContent = value; else field.append(value);
            wrap.append(field); details.append(wrap);
        };
        addDetail('Project ID', submission.project_id || '—');
        addDetail('Service', submission.service || '—');
        addDetail('Editing level', submission.editing_preferences || '—');
        addDetail('Payment', submission.payment_status === 'completed' ? `Verified · ₹${((submission.amount_paid || 0) / 100).toFixed(2)}` : (submission.payment_status || '—'));
        addDetail('Created', submission.created_at ? formatDate(submission.created_at) : '—');
        addDetail('Editing status', getEditingStatusInfo(submission.editing_status).text);
        addDetail('Instructions', submission.message || '—');
        addDetail('NDA', submission.nda || 'Not requested');
        const files = Array.isArray(submission.files) ? submission.files : (submission.file ? [{ name: 'Original file', url: submission.file }] : []);
        const links = Array.isArray(submission.links) ? submission.links : [];
        const attachments = document.createElement('div'); attachments.className = 'sn-modal-links';
        files.forEach(file => attachments.append(safeExternalAnchor(file.url, file.name || 'Original file')));
        links.forEach(link => attachments.append(safeExternalAnchor(link.url, link.label || 'Shared link')));
        if (!files.length && !links.length) attachments.textContent = 'No attachments available';
        addDetail('Original attachments', attachments);
        const edited = document.createElement('div'); edited.className = 'sn-modal-links';
        (submission.edited_files || []).forEach(file => edited.append(safeExternalAnchor(file.url, file.name || 'Edited file')));
        if (!submission.edited_files?.length) edited.textContent = 'Not ready yet';
        addDetail('Edited files', edited);
        box.append(details); overlay.append(box); document.body.append(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeDetailsModal(); });
        overlay._onEscape = e => { if (e.key === 'Escape') closeDetailsModal(); };
        document.addEventListener('keydown', overlay._onEscape);
        close.focus();
    } catch (error) { showAlert('Could not load project', error.message || 'Please retry.', 'error'); }
}
function closeDetailsModal() {
    const modal = document.querySelector('.details-modal');
    if (!modal) return;
    if (modal._onEscape) document.removeEventListener('keydown', modal._onEscape);
    modal.remove();
}
async function downloadEditedFiles(id) {
    try {
        const { submission } = await apiRequest(`/submissions/${encodeURIComponent(id)}`);
        if (!submission?.edited_files?.length) return showAlert('No edited files yet', 'Your edits will appear here when they are ready.', 'info');
        const links = submission.edited_files.map(file => safeLink(file.url)).filter(Boolean);
        if (!links.length) return showAlert('Download unavailable', 'No valid download URL was found.', 'warning');
        if (links.length === 1) window.open(links[0], '_blank', 'noopener,noreferrer');
        else {
            await Swal.fire({ title: 'Files ready', text: `This project has ${links.length} edited files. Open the project details to download each file.`, icon: 'success', confirmButtonText: 'View files',
                customClass: { popup: 'sn-dialog', confirmButton: 'sn-confirm' }, buttonsStyling: false });
            showSubmissionDetails(id);
        }
    } catch (error) { showAlert('Download error', error.message || 'Unable to fetch files.', 'error'); }
}

// Centralized policy link handling: no inline JavaScript attributes or javascript: URLs.
document.addEventListener('click', event => {
    const policyTrigger = event.target.closest('[data-policy]');
    if (!policyTrigger) return;
    event.preventDefault();
    showPolicy(policyTrigger.dataset.policy);
});
function showPolicy(type) {
    const policies = {
        privacy: ['Privacy Policy', getPrivacyPolicyContent],
        terms: ['Terms & Conditions', getTermsContent],
        cancellation: ['Cancellation & Refund Policy', getCancellationContent],
        shipping: ['Shipping & Delivery Policy', getShippingContent]
    };
    const selected = policies[type]; if (!selected) return;
    const overlay = document.createElement('div'); overlay.className = 'policy-modal'; overlay.style.display = 'block';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', selected[0]);
    const dialog = document.createElement('div'); dialog.className = 'policy-content';
    const heading = addTextNode('h2', selected[0]);
    const close = addTextNode('button', '×', 'close-policy'); close.type = 'button'; close.setAttribute('aria-label', 'Close policy');
    const content = document.createElement('div'); content.innerHTML = selected[1](); // trusted, static site policy HTML
    function dismiss() { document.removeEventListener('keydown', onKeyDown); overlay.remove(); }
    function onKeyDown(e) { if (e.key === 'Escape') dismiss(); }
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
    document.addEventListener('keydown', onKeyDown);
    dialog.append(close, heading, content); overlay.append(dialog); document.body.append(overlay);
    close.focus();
}
