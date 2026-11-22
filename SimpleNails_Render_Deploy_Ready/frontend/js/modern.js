/* Small progressive enhancements; keeps the original Firebase/Uploadcare/Razorpay integration. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dateValue = (record) => record?.created_at || record?.timestamp || null;
  const safeUrl = (value) => { try { const parsed = new URL(value); return parsed.protocol === 'https:' ? parsed.href : null; } catch { return null; } };
  const dashboard = { items: [], page: 1, view: 'list', pageSize: 8 };

  // The default modal library is an optional CDN asset, so public pages should
  // remain functional even if the user's network blocks that asset.
  window.showAlert = (title, text, icon = 'info') => {
    if (window.Swal?.fire) return window.Swal.fire({title, text, icon, confirmButtonColor:'#765cf0'});
    window.alert(`${title}\n\n${text}`);
    return Promise.resolve();
  };

  // Create user-menu elements with DOM APIs, never interpolate profile text or URL into HTML.
  window.updateUserProfile = async (signedInUser) => {
    const name = (signedInUser.displayName || signedInUser.email || 'Your account').slice(0, 90);
    ['desktop-login-container', 'mobile-login-container'].forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      container.replaceChildren();
      const profile = document.createElement('div'); profile.className = 'user-profile';
      const initial = document.createElement('span'); initial.className = 'modern-avatar'; initial.textContent = name.charAt(0).toUpperCase();
      const text = document.createElement('span'); text.className = 'user-name'; text.textContent = name;
      const logout = document.createElement('button'); logout.className = 'logout-btn'; logout.type = 'button'; logout.textContent = 'Sign out';
      logout.addEventListener('click', () => window.handleFirebaseLogout?.());
      profile.append(initial,text,logout); container.append(profile);
    });
    const overlay = $('#login-overlay-container'); if (overlay) overlay.replaceChildren();
  };

  window.renderFirebaseGoogleButton = () => {
    ['desktop-login-container','mobile-login-container','login-overlay-container'].forEach(id => {
      const node = document.getElementById(id);
      if (!node || window.firebase?.auth?.().currentUser) return;
      node.replaceChildren();
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'firebase-google-btn modern-google-btn';
      btn.innerHTML = '<i class="fab fa-google" aria-hidden="true"></i> Continue with Google';
      btn.addEventListener('click', () => window.handleFirebaseGoogleSignIn?.());
      node.append(btn);
    });
  };

  window.formatDate = (value) => {
    if (!value) return 'Date unavailable';
    const d = value instanceof Date ? value : new Date(value?.seconds ? value.seconds * 1000 : value);
    if (Number.isNaN(d.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-IN', { day:'numeric',month:'short',year:'numeric' }).format(d);
  };

  function statusMeta(item) {
    const raw = String(item.editing_status || 'pending').toLowerCase();
    if (raw === 'completed') return {label:'Completed', cls:'completed', type:'completed'};
    if (raw === 'editing' || raw === 'processing' || raw === 'in progress' || raw === 'progress') return {label:'In progress', cls:'in-progress', type:'active'};
    if (raw === 'failed' || raw === 'error') return {label:'Needs attention', cls:'failed', type:'active'};
    return {label:'Pending', cls:'pending', type:'active'};
  }

  function openDashboardView(view) {
    dashboard.view = view === 'grid' ? 'grid' : 'list';
    const list = $('#submissions-list'), grid = $('#submissions-grid');
    if (list) list.style.display = dashboard.view === 'list' ? 'block' : 'none';
    if (grid) grid.style.display = dashboard.view === 'grid' ? 'grid' : 'none';
    $$('.view-toggle .view-btn').forEach(btn => {
      const active = btn.dataset.view === dashboard.view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }
  window.showView = openDashboardView;

  function dashboardItemHTML(item, view) {
    const id = esc(item.id), ref = esc(item.project_id || 'Project'), service = esc(item.service || 'Editing service');
    const date = esc(window.formatDate(dateValue(item))), status = statusMeta(item);
    const progress = `<span class="status-badge ${status.cls}">${status.label}</span>`;
    const downloads = (Array.isArray(item.edited_files) ? item.edited_files : []).length;
    const buttons = `<button class="action-btn view-details" data-submission-id="${id}" type="button" aria-label="View project ${ref}"><i class="fas fa-eye"></i> <span>Details</span></button>${downloads ? `<button class="file-link" type="button" data-download-id="${id}"><i class="fas fa-download"></i> Files (${downloads})</button>` : ''}`;
    if (view === 'list') return `<div class="list-item"><div class="project-id" data-label="Project ID">${ref}</div><div class="service" data-label="Service">${service}</div><div class="status submitted" data-label="Status">Submitted</div><div class="editing-status ${status.cls}" data-label="Editing status">${status.label}</div><div class="date" data-label="Date">${date}</div><div class="actions" data-label="Actions">${buttons}</div></div>`;
    return `<article class="grid-card"><div class="grid-card-header"><strong class="grid-card-id">${ref}</strong><span class="grid-card-date">${date}</span></div><div class="grid-card-content"><div class="grid-detail"><span class="grid-detail-label">Service</span><strong class="grid-detail-value">${service}</strong></div><div class="grid-detail"><span class="grid-detail-label">Editing status</span><span class="grid-detail-value">${progress}</span></div><div class="grid-detail"><span class="grid-detail-label">Editing level</span><span class="grid-detail-value">${esc(item.editing_preferences || 'Not specified')}</span></div></div><div class="grid-card-actions">${buttons}</div></article>`;
  }

  function renderDashboardPage() {
    const query = ($('#submission-search')?.value || '').trim().toLowerCase();
    const filter = $('#submission-filter')?.value || 'all';
    const sort = $('#submission-sort')?.value || 'newest';
    const items = dashboard.items.filter(item => {
      if (filter !== 'all' && statusMeta(item).type !== filter) return false;
      return !query || [item.project_id,item.service,item.editing_preferences,item.editing_status].some(value => String(value ?? '').toLowerCase().includes(query));
    }).sort((a,b) => (sort === 'oldest' ? 1 : -1) * (new Date(dateValue(a) || 0) - new Date(dateValue(b) || 0)));
    const pages = Math.max(1,Math.ceil(items.length / dashboard.pageSize));
    dashboard.page = Math.min(dashboard.page, pages);
    const subset = items.slice((dashboard.page-1)*dashboard.pageSize, dashboard.page*dashboard.pageSize);
    const list = $('#submissions-list'),grid = $('#submissions-grid');
    if (!list || !grid) return;
    list.innerHTML = `<div class="list-header"><div class="header-item">PROJECT ID</div><div class="header-item">SERVICE</div><div class="header-item">STATUS</div><div class="header-item">EDITING STATUS</div><div class="header-item">DATE</div><div class="header-item">ACTIONS</div></div><div id="list-items">${subset.map(s=>dashboardItemHTML(s,'list')).join('')}</div>`;
    grid.innerHTML = subset.map(s=>dashboardItemHTML(s,'grid')).join('');
    if (!items.length) {
      const empty = '<div class="empty-filter"><i class="fas fa-magnifying-glass"></i><h3>No matching projects</h3><p>Try another search term or status filter.</p></div>';
      list.innerHTML = empty; grid.innerHTML = empty;
    }
    const pagination = $('.pagination');
    if (pagination) {
      pagination.hidden = pages < 2;
      pagination.style.display = pages > 1 ? 'flex' : 'none';
      const current = $('#current-page'),total = $('#total-pages'), prev = $('#prev-page'),next = $('#next-page');
      if (current) current.textContent = String(dashboard.page);
      if (total) total.textContent = String(pages);
      if (prev) prev.disabled = dashboard.page <= 1;
      if (next) next.disabled = dashboard.page >= pages;
    }
    openDashboardView(dashboard.view);
  }

  window.renderSubmissions = (submissions) => {
    dashboard.items = Array.isArray(submissions) ? submissions : [];
    dashboard.page = 1;
    const history = $('.submission-history'); if (!history) return;
    history.innerHTML = '<div class="submissions-list-view" id="submissions-list"></div><div class="submissions-grid-view" id="submissions-grid"></div><div class="pagination" hidden><button class="pagination-btn" type="button" id="prev-page" aria-label="Previous page"><i class="fas fa-chevron-left"></i></button><span class="page-info"><span id="current-page">1</span> / <span id="total-pages">1</span></span><button class="pagination-btn" type="button" id="next-page" aria-label="Next page"><i class="fas fa-chevron-right"></i></button></div>';
    const toolbar = $('#submission-toolbar'); if (toolbar) toolbar.hidden = false;
    renderDashboardPage();
  };

  window.showSubmissionDetails = async (submissionId) => {
    try {
      const data = await window.apiRequest(`/submissions/${encodeURIComponent(submissionId)}`);
      const item = data.submission;
      if (!item) throw new Error('Project not found.');
      const files = Array.isArray(item.edited_files) ? item.edited_files : [];
      const downloadHTML = files.length ? files.map((file,i) => {
        const url = safeUrl(typeof file === 'string' ? file : file.url);
        return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-download"></i> Edited file ${i+1}</a>` : '';
      }).join('') : '<span>Not ready yet — check back for updates.</span>';
      const originalUrl = safeUrl(item.file);
      const fields = [
        ['Project ID',item.project_id],['Name',item.name],['Email',item.email],
        ['Service',item.service],['Editing level',item.editing_preferences],
        ['Submitted',window.formatDate(dateValue(item))],
        ['Editing status',statusMeta(item).label],['Instructions',item.message]
      ];
      const modal = document.createElement('div');
      modal.className = 'details-modal active';
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-label','Project details');
      modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-folder-open"></i> Project details</h3><button class="modal-close" type="button" aria-label="Close project details"><i class="fas fa-times"></i></button></div><div class="modal-details">${fields.map(([label,value])=>`<div class="modal-detail"><div class="modal-detail-label">${label}</div><div class="modal-detail-value">${esc(value || '—')}</div></div>`).join('')}<div class="modal-detail"><div class="modal-detail-label">Original upload</div><div class="modal-detail-value">${originalUrl ? `<a href="${esc(originalUrl)}" target="_blank" rel="noopener noreferrer">View original file <i class="fas fa-external-link-alt"></i></a>` : 'No file link available'}</div></div><div class="modal-detail"><div class="modal-detail-label">Edited files</div><div class="modal-detail-value download-links">${downloadHTML}</div></div></div></div>`;
      const close = () => { modal.remove(); document.removeEventListener('keydown', escapeHandler); };
      const escapeHandler = e => { if (e.key === 'Escape') close(); };
      modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.modal-close')) close(); });
      document.addEventListener('keydown',escapeHandler);
      $('.details-modal')?.remove(); document.body.append(modal); $('.modal-close',modal)?.focus();
    } catch(error) { window.showAlert('Could not open project', error.message || 'Please try again.', 'error'); }
  };

  window.downloadEditedFiles = async (submissionId) => {
    try {
      const data = await window.apiRequest(`/submissions/${encodeURIComponent(submissionId)}`);
      const files = (Array.isArray(data.submission?.edited_files) ? data.submission.edited_files : []).map(f => safeUrl(typeof f==='string' ? f : f.url)).filter(Boolean);
      if (!files.length) return window.showAlert('Files not ready','Edited files will appear here when available.','info');
      // Avoid multiple popup blockers: give the user direct safe download links.
      const wrapper = document.createElement('div'); wrapper.className='file-download-panel';
      const message = document.createElement('p'); message.textContent='Your edited file links are ready:'; wrapper.append(message);
      files.forEach((url,i)=> { const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=`Open edited file ${i+1}`; wrapper.append(a); });
      if (window.Swal?.fire) window.Swal.fire({title:'Your edited files',html:wrapper,confirmButtonColor:'#765cf0'});
      else { const choice=window.confirm('Edited files are ready. Open the first file?'); if(choice) window.open(files[0],'_blank','noopener,noreferrer'); }
    } catch(error){ window.showAlert('Unable to load files',error.message || 'Please try again.','error'); }
  };

  // File names and third-party URLs are untrusted; build the preview without innerHTML.
  window.updateFilePreviews = (files) => {
    const preview = $('#file-previews'); if (!preview) return;
    preview.replaceChildren();
    if (!Array.isArray(files) || !files.length) {
      const empty=document.createElement('p');empty.textContent='No files selected yet';preview.append(empty);return;
    }
    files.forEach(file=>{
      const item=document.createElement('div');item.className='file-preview';
      const url=safeUrl(file.cdnUrl);
      const name=String(file.name || 'Uploaded file').slice(0,150);
      if(url && /\.(png|jpe?g|gif|webp)$/i.test(name)) {
        const img=document.createElement('img');img.src=url;img.alt=name;img.loading='lazy';item.append(img);
      } else {const icon=document.createElement('i');icon.className='fas fa-file-alt';icon.style.fontSize='2rem';item.append(icon);}
      const label=document.createElement('div');label.className='file-name';label.textContent=name;item.append(label);
      const size=document.createElement('div');size.className='file-size';size.textContent=Number.isFinite(Number(file.size))?`${Math.round(Number(file.size)/1024)} KB`:'File ready';item.append(size);
      const remove=document.createElement('button');remove.className='btn btn-outline';remove.type='button';remove.textContent='Remove';
      remove.addEventListener('click',()=>{const uploader=$('[role=uploadcare-uploader]');if(uploader && typeof uploadcareWidget !== 'undefined' && uploadcareWidget?.value)uploadcareWidget.value(null);const hidden=$('#file_hidden');if(hidden)hidden.value='';item.remove();});
      item.append(remove);preview.append(item);
    });
  };

  // Contact: separate a saved message from an actually delivered email notification.
  window.initContactForm = () => {
    const form = $('#contactForm'); if (!form) return;
    const status = $('#contact-feedback'), btn = $('button[type=submit]',form);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      Object.keys(values).forEach(key=> values[key]=String(values[key]).trim());
      if (!form.checkValidity() || !values.name || !values.subject || !values.message) {
        status.textContent='Please fill in all the fields with valid details.';status.className='form-feedback error';form.reportValidity();return;
      }
      btn.disabled=true;btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Sending...';status.className='form-feedback';status.textContent='Sending your message securely...';
      try {
        const response=await window.apiRequest('/contact',{method:'POST',body:values});
        if (!response.success) throw new Error('Server did not confirm your message.');
        const result=response.emailSent ? 'Message received, and the team was notified by email.' : 'Message saved successfully. Email notification is not currently available, but you can also reach us by WhatsApp.';
        status.textContent=result;status.className='form-feedback success';form.reset();
        window.showAlert('Message received',result,'success');
      } catch(err){status.className='form-feedback error';status.textContent=err.message || 'Unable to send your message. Try WhatsApp or email us directly.';}
      finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Message';}
    });
  };

  function initCompare(){const input=$('#compare-range'),after=$('#compare-after'),line=$('#compare-line');if(!input||!after||!line)return;const update=()=>{const val=Math.max(0,Math.min(100,Number(input.value)));after.style.clipPath=`inset(0 0 0 ${val}%)`;line.style.left=`${val}%`;};input.addEventListener('input',update);update();}
  function initEstimator(){const select=$('#estimate-plan'),total=$('#estimate-total'),link=$('#estimate-link');if(!select)return;const amounts={basic:1,full:10,custom:20};const sync=()=>{const plan=select.value;total.textContent=`₹${amounts[plan]}`;link.href=`project.html?plan=${encodeURIComponent(plan)}`;};select.addEventListener('change',sync);sync();}
  function initTheme(){let saved='';try{saved=localStorage.getItem('sn-theme')||'';}catch{};document.body.classList.toggle('theme-light',saved==='light');const sync=()=>$$('.theme-switch').forEach(btn=>{const light=document.body.classList.contains('theme-light');btn.innerHTML=light?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';btn.title=light?'Switch to dark mode':'Switch to light mode';btn.setAttribute('aria-label',btn.title);});$$('.theme-switch').forEach(btn=>btn.addEventListener('click',()=>{document.body.classList.toggle('theme-light');try{localStorage.setItem('sn-theme',document.body.classList.contains('theme-light')?'light':'dark');}catch{}sync();}));sync();}
  function initProjectDefaults(){const service=$('#serviceField'),level=$('#editingPreferences');if(!service||!level)return;const params=new URLSearchParams(location.search);let saved={};try{saved=JSON.parse(sessionStorage.getItem('sn-project-prefs')||'{}');}catch{};
    const plan=params.get('plan')||saved.plan;const svc=params.get('service')||saved.service;
    const chosen=[...level.options].find(opt=>opt.value.toLowerCase().startsWith(String(plan||'').toLowerCase()) && plan);
    if(chosen){level.value=chosen.value;level.dispatchEvent(new Event('change',{bubbles:true}));}
    if(svc&&[...service.options].some(opt=>opt.value===svc)){service.value=svc;service.dispatchEvent(new Event('change',{bubbles:true}));}
    const track=()=>{try{sessionStorage.setItem('sn-project-prefs',JSON.stringify({plan:level.value.split(' ')[0].toLowerCase(),service:service.value}));}catch{};const status=$('#draft-status');if(status)status.innerHTML='<i class="fas fa-check-circle"></i> Your package and service selection are saved for this browser session.';};
    service.addEventListener('change',track);level.addEventListener('change',track);
    // Remove saved selection when the user intentionally clears the project.
    $('#projectForm')?.addEventListener('reset',()=>{try{sessionStorage.removeItem('sn-project-prefs');}catch{};});
  }
  function initDashboard(){if(!$('#submission-toolbar'))return;
    ['submission-search','submission-filter','submission-sort'].forEach(id=>document.getElementById(id)?.addEventListener(id==='submission-search'?'input':'change',()=>{dashboard.page=1;renderDashboardPage();}));
    $('.view-toggle')?.addEventListener('click',e=>{const btn=e.target.closest('.view-btn');if(btn)openDashboardView(btn.dataset.view);});
    $('.submission-history')?.addEventListener('click',e=>{const details=e.target.closest('[data-submission-id]');const download=e.target.closest('[data-download-id]');if(details)window.showSubmissionDetails(details.dataset.submissionId);else if(download)window.downloadEditedFiles(download.dataset.downloadId);else if(e.target.closest('#prev-page')){dashboard.page--;renderDashboardPage();}else if(e.target.closest('#next-page')){dashboard.page++;renderDashboardPage();}});
    $('#refresh-submissions')?.addEventListener('click',()=>window.loadUserSubmissions?.());
  }
  function initAccessibility(){const btn=$('#mobile-menu');btn?.addEventListener('click',()=>btn.setAttribute('aria-expanded',String(btn.classList.contains('active'))));$$('.faq-question').forEach((node,i)=>{node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',`Toggle question ${i+1}`);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();node.click();}});});}
  function initOfflineNotice(){const notice=document.createElement('div');notice.className='offline-notice';notice.setAttribute('role','status');notice.textContent='You are offline. Some services, including uploads and payments, need an internet connection.';notice.hidden=true;notice.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2100;padding:9px 18px;text-align:center;background:#bc7934;color:#fff;font-size:12px;font-weight:700';document.body.append(notice);const update=()=>notice.hidden=navigator.onLine;window.addEventListener('online',update);window.addEventListener('offline',update);update();}
  document.addEventListener('DOMContentLoaded',()=>{initTheme();initCompare();initEstimator();initProjectDefaults();initDashboard();initAccessibility();initOfflineNotice();});
})();
