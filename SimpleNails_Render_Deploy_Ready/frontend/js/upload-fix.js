/* Upload fix for the ORIGINAL SimpleNails interface.
 * Uses Uploadcare's supported HTTPS Upload API rather than the older jQuery
 * widget. File bytes go directly from the visitor's browser to Uploadcare.
 * The original project page layout, navigation, form, and styles are retained.
 */
'use strict';

const snFiles = [];
const snLinks = [];
const SN_MAX_FILE_SIZE = 10 * 1024 * 1024;
const SN_MAX_FILES = 15;
const SN_MAX_LINKS = 15;
const SN_MAX_ITEMS = 20;
const SN_UPLOAD_URL = 'https://upload.uploadcare.com/base/';
const SN_INFO_URL = 'https://upload.uploadcare.com/info/';
// For accounts set up before Sep 2025 this is typically ucarecdn.com.
// If Uploadcare Delivery shows a *.ucarecd.net project domain, set it here.
const SN_CDN_BASE = window.SIMPLENAILS_UPLOADCARE_CDN_BASE || 'https://ucarecdn.com/';
const SN_PENDING_PAYMENT_KEY = 'simplenails_pending_payment_order';
const SN_UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
let snUploadPending = false;
let snUploadRun = 0;
let snUploadAbort = null;
let snPaymentPending = false;

function snEl(id) { return document.getElementById(id); }
function snStatus(message, isError = false) {
    const element = snEl('upload-status');
    if (element) {
        element.textContent = message;
        element.classList.toggle('sn-upload-error', isError);
    }
}
function snSafeHttps(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
            url.href.length > 2000 || /^localhost$|\.(?:local|internal|localhost)$|^(?:127|10|192\.168|169\.254|0)\./i.test(url.hostname) ||
            /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null;
        return url.href;
    } catch { return null; }
}
function snIsUploadUrl(value, uuid) {
    const parsed = snSafeHttps(value);
    if (!parsed) return false;
    const url = new URL(parsed);
    return (url.hostname === 'ucarecdn.com' || /^[a-z0-9-]+\.ucarecd\.net$/.test(url.hostname)) &&
        url.pathname.split('/')[1]?.toLowerCase() === uuid.toLowerCase();
}
function snAllAttachments() { return snFiles.length + snLinks.length; }
function snSyncHiddenFile() {
    const first = snFiles[0]?.url || snLinks[0]?.url || '';
    if (snEl('file_hidden')) snEl('file_hidden').value = first;
}
function snRenderFiles() {
    const target = snEl('file-previews');
    if (!target) return;
    target.replaceChildren();
    const entries = [
        ...snFiles.map((value, index) => ({ type: 'file', index, ...value })),
        ...snLinks.map((value, index) => ({ type: 'link', index, ...value }))
    ];
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        const icon = document.createElement('i'); icon.className = 'fas fa-file-upload';
        const text = document.createElement('p'); text.textContent = 'No files selected yet';
        empty.append(icon, text); target.append(empty);
    }
    for (const entry of entries) {
        const item = document.createElement('div'); item.className = 'file-preview';
        if (entry.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(entry.name)) {
            const image = document.createElement('img'); image.src = entry.url; image.alt = entry.name;
            image.loading = 'lazy'; item.append(image);
        } else {
            const icon = document.createElement('i'); icon.className = entry.type === 'file' ? 'fas fa-file-alt' : 'fas fa-link';
            icon.style.cssText = 'font-size:3rem;color:rgba(255,255,255,0.5);margin:10px 0;display:block;';
            item.append(icon);
        }
        const label = document.createElement('div'); label.className = 'file-name';
        label.textContent = entry.type === 'file' ? entry.name : entry.label;
        label.title = label.textContent;
        const size = document.createElement('div'); size.className = 'file-size';
        size.textContent = entry.type === 'file' ? `${(entry.size / 1024).toFixed(1)} KB • Uploaded` : 'Cloud link';
        const open = document.createElement('a'); open.href = entry.url; open.target = '_blank';
        open.rel = 'noopener noreferrer'; open.textContent = 'View';
        open.style.cssText = 'color:var(--accent,#4895ef);font-size:.78rem;text-decoration:underline;';
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-file';
        remove.innerHTML = '<i class="fas fa-times"></i>';
        remove.title = 'Remove this attachment'; remove.setAttribute('aria-label', `Remove ${label.textContent}`);
        remove.addEventListener('click', () => {
            if (snUploadPending || snPaymentPending) return;
            (entry.type === 'file' ? snFiles : snLinks).splice(entry.index, 1);
            snRenderFiles(); snStatus('Attachment removed. You can add more.');
        });
        item.append(label, size, open, remove);
        target.append(item);
    }
    snSyncHiddenFile();
}
function snUpdateUploadButtonState() {
    const file = snEl('uploadcare-file');
    if (file) file.disabled = snUploadPending || snPaymentPending || !auth?.currentUser;
    if (snEl('sn-add-link')) snEl('sn-add-link').disabled = snUploadPending || snPaymentPending || !auth?.currentUser;
}
async function snUploadOneFile(file, signal) {
    const form = new FormData();
    const publicKey = snEl('uploadcare-file')?.dataset.publicKey;
    if (!publicKey) throw new Error('Uploadcare public key is missing.');
    form.append('UPLOADCARE_PUB_KEY', publicKey);
    form.append('UPLOADCARE_STORE', '1');
    form.append('file', file, file.name);
    let response;
    try { response = await fetch(SN_UPLOAD_URL, { method: 'POST', body: form, signal }); }
    catch (error) {
        if (signal.aborted) throw error;
        throw new Error('Could not reach Uploadcare. Check your network, Uploadcare settings and site Content Security Policy.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const details = payload.detail || payload.error || payload.message || `HTTP ${response.status}`;
        throw new Error(`Uploadcare rejected ${file.name}: ${typeof details === 'string' ? details : JSON.stringify(details)}`);
    }
    const uuid = payload.file;
    if (typeof uuid !== 'string' || !SN_UUID.test(uuid)) throw new Error(`Uploadcare did not return a valid file ID for ${file.name}.`);
    // A project may have its own CDN hostname; use an API-provided URL where available.
    let url;
    try {
        const infoForm = new FormData(); infoForm.append('pub_key', publicKey); infoForm.append('file_id', uuid);
        const infoResponse = await fetch(SN_INFO_URL, { method: 'POST', body: infoForm, signal });
        if (infoResponse.ok) {
            const info = await infoResponse.json();
            const candidate = info.original_file_url || info.cdn_url;
            if (candidate && snIsUploadUrl(candidate, uuid)) url = candidate;
        }
    } catch (error) { if (signal.aborted) throw error; }
    if (!url) url = `${SN_CDN_BASE.replace(/\/+$/, '')}/${uuid}/`;
    if (!snIsUploadUrl(url, uuid)) throw new Error('Your Uploadcare CDN host needs to be configured in upload-fix.js.');
    return { url, name: file.name.slice(0, 200), size: file.size };
}
async function snUploadFiles(fileList) {
    const files = [...fileList];
    if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
    if (!files.length || snUploadPending || snPaymentPending) return;
    if (snFiles.length + files.length > SN_MAX_FILES || snAllAttachments() + files.length > SN_MAX_ITEMS) {
        snStatus(`You can attach up to ${SN_MAX_FILES} uploaded files, ${SN_MAX_ITEMS} attachments in total.`, true); return;
    }
    const invalid = files.find(file => !file.size || file.size > SN_MAX_FILE_SIZE);
    if (invalid) { snStatus(`${invalid.name} must be larger than 0 bytes and no more than 10 MB.`, true); return; }
    const run = ++snUploadRun;
    snUploadAbort = new AbortController();
    snUploadPending = true;
    snUpdateUploadButtonState();
    const errors = [];
    let added = 0;
    try {
        for (let i = 0; i < files.length; i++) {
            if (run !== snUploadRun) return;
            snStatus(`Uploading ${i + 1} of ${files.length}: ${files[i].name} ...`);
            try {
                const uploaded = await snUploadOneFile(files[i], snUploadAbort.signal);
                if (run !== snUploadRun) return;
                snFiles.push(uploaded);
                added++; snRenderFiles();
            } catch (error) {
                if (snUploadAbort.signal.aborted) return;
                console.error('Upload failed:', error);
                errors.push(error.message || `Could not upload ${files[i].name}`);
            }
        }
        if (run === snUploadRun) snStatus(errors.length
            ? `${added} file(s) uploaded. ${errors.length} failed: ${errors.slice(0, 2).join(' — ')}`
            : `${added} file(s) uploaded successfully. You can add more files.`, !!errors.length);
    } finally {
        if (run === snUploadRun) {
            snUploadPending = false; snUploadAbort = null;
            snUpdateUploadButtonState();
        }
    }
}
function snAddManualLink(value) {
    const url = snSafeHttps(value?.trim());
    if (!url) { snStatus('Enter a valid public HTTPS file link (for example, Google Drive).', true); return false; }
    if (snLinks.length >= SN_MAX_LINKS || snAllAttachments() >= SN_MAX_ITEMS) {
        snStatus('You have reached the attachment limit.', true); return false;
    }
    if (snFiles.some(f => f.url === url) || snLinks.some(f => f.url === url)) {
        snStatus('This link is already attached.', true); return false;
    }
    snLinks.push({ url, label: new URL(url).hostname });
    if (snEl('sn-file-url')) snEl('sn-file-url').value = '';
    snRenderFiles(); snStatus('Link added.');
    return true;
}

/* Override only the original uploader and the form functions that consume files. */
function initFileUpload() {
    if (!snEl('projectForm')) return;
    // Prevent pressing Enter in the wizard from submitting a traditional HTML form.
    snEl('projectForm').addEventListener('submit', e => e.preventDefault());
    const input = snEl('uploadcare-file');
    input?.addEventListener('change', event => {
        const selected = [...(event.target.files || [])];
        event.target.value = ''; // Allows retrying the same file after an error.
        void snUploadFiles(selected);
    });
    snEl('sn-add-link')?.addEventListener('click', () => {
        if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
        if (!snUploadPending && !snPaymentPending) snAddManualLink(snEl('sn-file-url').value);
    });
    snEl('sn-file-url')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); snEl('sn-add-link').click(); }
    });
    snEl('paste-url-btn')?.addEventListener('click', async () => {
        if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
        if (snUploadPending || snPaymentPending) return;
        try {
            if (!navigator.clipboard?.readText) throw new Error('Clipboard unavailable');
            const link = await navigator.clipboard.readText();
            if (!snAddManualLink(link)) snEl('sn-file-url').value = link;
        } catch {
            snEl('sn-file-url')?.focus();
            snStatus('Paste your link into the box and click Add link.', false);
        }
    });
    snRenderFiles(); snStatus('Select one or more files (10MB max each).');
    snUpdateUploadButtonState();
}
function validateStep(stepId) {
    if (String(stepId) === '1') {
        for (const id of ['nameField','emailField','mobileField','serviceField','editingPreferences','messageField']) {
            const field = snEl(id);
            if (!field || !field.value.trim() || !field.checkValidity()) {
                showAlert('Missing Information', 'Please complete all required project details.', 'warning'); field?.focus(); return false;
            }
        }
        if (!/^\d{10}$/.test(snEl('mobileField').value.trim())) {
            showAlert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.', 'warning'); return false;
        }
        return true;
    }
    if (String(stepId) === '2') {
        if (snUploadPending) { snStatus('Your files are still uploading. Wait for the successful upload message.', true); return false; }
        if (!snAllAttachments()) { snStatus('Upload at least one file or add a cloud link to continue.', true); return false; }
        return true;
    }
    return true;
}
function resetForm() {
    snUploadRun++;
    snUploadAbort?.abort();
    snUploadPending = false;
    snPaymentPending = false;
    snFiles.length = 0; snLinks.length = 0;
    snEl('projectForm')?.reset();
    for (const id of ['file_hidden','service_hidden','editing_preferences_hidden']) if (snEl(id)) snEl(id).value = '';
    currentSubmissionId = null; currentAmount = 0;
    updateAmountDisplay(); snRenderFiles(); snStatus('Select one or more files (10MB max each).');
    snUpdateUploadButtonState();
    document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
    snEl('projectForm')?.querySelector('.form-step[data-step="1"]')?.classList.add('active');
    updateProgressSteps('1');
}
function updateReviewSection() {
    if (!currentSubmissionId) currentSubmissionId = generateProjectId();
    for (const [labelId, inputId] of Object.entries({
        'review-name': 'nameField','review-email': 'emailField', 'review-mobile': 'mobileField',
        'review-message': 'messageField', 'review-service': 'serviceField', 'review-editing': 'editingPreferences'
    })) if (snEl(labelId)) snEl(labelId).textContent = snEl(inputId)?.value || 'Not selected';
    if (snEl('review-files')) snEl('review-files').textContent = `${snFiles.length} file(s), ${snLinks.length} link(s)`;
    const preferences = snEl('editingPreferences')?.value;
    const prices = { 'Basic - Light edits':100, 'Full - Advanced edits':1000, 'Custom - specified what customer need':2000 };
    currentAmount = prices[preferences] || 0;
    if (snEl('review-total')) snEl('review-total').textContent = `₹${currentAmount/100}`;
    updateAmountDisplay();
    const summaryCard = document.querySelector('.summary-card');
    let idLabel = snEl('review-project-id');
    if (!idLabel && summaryCard) {
        const row = document.createElement('div'); row.className = 'summary-row';
        const label = document.createElement('span'); label.textContent = 'Project ID:';
        idLabel = document.createElement('span'); idLabel.id = 'review-project-id';
        row.append(label,idLabel); summaryCard.prepend(row);
    }
    if (idLabel) idLabel.textContent = currentSubmissionId;
    snShowRecovery();
}
function snReadPending() { try { return JSON.parse(sessionStorage.getItem(SN_PENDING_PAYMENT_KEY) || 'null'); } catch { return null; } }
function snWritePending(order) { try { sessionStorage.setItem(SN_PENDING_PAYMENT_KEY, JSON.stringify(order)); } catch { /* storage blocked */ } }
function snClearPending() { try { sessionStorage.removeItem(SN_PENDING_PAYMENT_KEY); } catch { /* storage blocked */ } }
function snShowRecovery() {
    const pending = snReadPending();
    const button = snEl('sn-recover-payment');
    if (button) button.hidden = !(pending?.orderId && pending.uid === auth?.currentUser?.uid);
}
function snSetPaymentBusy(busy) {
    snPaymentPending = busy;
    const button = snEl('pay-submit-btn'); if (button) button.disabled = busy;
    if (snEl('sn-recover-payment')) snEl('sn-recover-payment').disabled = busy;
    snUpdateUploadButtonState();
}
async function snPaymentFinished(result) {
    snClearPending(); snShowRecovery();
    await Swal.fire({ title:'Project Submitted Successfully!',
        text:`Project ${result.projectId || currentSubmissionId} is saved. ${result.emailSent === false ? 'Email confirmation is currently unavailable.' : 'Check your inbox for your confirmation.'}`,
        icon:'success', confirmButtonText:'View Submissions' });
    window.location.assign('submissions.html');
}
async function snRecoverPayment() {
    const pending = snReadPending();
    if (!pending?.orderId || pending.uid !== auth?.currentUser?.uid || snPaymentPending) return;
    snSetPaymentBusy(true);
    try {
        const result = await apiRequest('/payments/recover', { method: 'POST', body: { orderId: pending.orderId } });
        if (result.success) await snPaymentFinished(result);
    } catch (error) {
        showAlert('Payment recovery', `${error.message} If money was deducted, do not pay again.`, 'warning');
    } finally { snSetPaymentBusy(false); }
}
function initPaymentMethods() {
    if (!snEl('pay-submit-btn')) return;
    snEl('pay-submit-btn').addEventListener('click', () => {
        if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
        void window.startRazorpayPayment();
    });
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn-outline';
    button.id = 'sn-recover-payment'; button.hidden = true;
    button.style.cssText = 'margin-top:10px;'; button.textContent = 'Recover previous payment';
    button.addEventListener('click', snRecoverPayment);
    snEl('razorpay-button-container')?.append(button);
    snShowRecovery();
}
window.startRazorpayPayment = async function () {
    if (snPaymentPending) return;
    if (!auth?.currentUser) { showLoginRequiredPopup(); return; }
    if (snUploadPending || !snAllAttachments()) { showAlert('Files Required','Wait for your upload and attach at least one file or link.','warning'); return; }
    if (!snEl('terms-agreement')?.checked) { showAlert('Terms Required','Please accept the Terms & Conditions before payment.','warning'); return; }
    if (!validateStep('1')) return;
    if (typeof Razorpay !== 'function') { showAlert('Payment Unavailable','Payment gateway could not load. Refresh and try again.','error'); return; }
    const pending = snReadPending();
    if (pending?.orderId && pending.uid === auth.currentUser.uid) {
        const choice = await Swal.fire({ title:'Previous payment found',
            text:'Check your previous payment before paying again to avoid duplicate charges.',
            icon:'question', showCancelButton:true, showDenyButton:true, confirmButtonText:'Recover payment',
            denyButtonText:'Pay again', cancelButtonText:'Cancel' });
        if (choice.isConfirmed) { await snRecoverPayment(); return; }
        if (!choice.isDenied) return;
    }
    if (!currentSubmissionId) updateReviewSection();
    const draft = {
        projectId: currentSubmissionId,
        name:snEl('nameField').value.trim(), email:snEl('emailField').value.trim(),
        mobile:snEl('mobileField').value.trim(), service:snEl('serviceField').value,
        editingPreferences:snEl('editingPreferences').value, message:snEl('messageField').value.trim(),
        files:snFiles.map(({ url,name,size }) => ({ url,name,size })),
        links:snLinks.map(({ url,label }) => ({ url,label })),
        nda:!!snEl('nda')?.checked, termsAccepted:true
    };
    snSetPaymentBusy(true);
    try {
        const order = await apiRequest('/payments/create-order', { method:'POST', body:draft });
        snWritePending({ orderId:order.orderId, uid:auth.currentUser.uid, projectId:currentSubmissionId });
        snShowRecovery();
        const razorpay = new Razorpay({ key:order.keyId, amount:order.amount,
            currency:order.currency, order_id:order.orderId,
            name:'SimpleNails', description:`Project ${currentSubmissionId}`,
            prefill:{ name:draft.name,email:draft.email,contact:draft.mobile },
            theme:{ color:'#00bbff' },
            handler:async payment => {
                try {
                    Swal.fire({ title:'Processing payment', text:'Verifying payment and saving your project...',
                        allowOutsideClick:false, showConfirmButton:false, didOpen:()=>Swal.showLoading() });
                    const result = await apiRequest('/submissions', { method:'POST', body:{ payment } });
                    Swal.close(); await snPaymentFinished(result);
                } catch (error) {
                    Swal.close(); showAlert('Payment recovery available',
                        `${error.message} Do not pay twice. Use Recover previous payment.`, 'warning');
                } finally { snSetPaymentBusy(false); }
            },
            modal:{ ondismiss:() => { snSetPaymentBusy(false); snShowRecovery(); } }
        });
        razorpay.on('payment.failed', response => {
            snSetPaymentBusy(false);
            showAlert('Payment not completed',response.error?.description || 'Please try again. If charged, recover your payment.','warning');
        });
        razorpay.open();
    } catch (error) {
        snSetPaymentBusy(false);
        showAlert('Payment Error',error.message || 'Unable to begin payment.','error');
    }
};
