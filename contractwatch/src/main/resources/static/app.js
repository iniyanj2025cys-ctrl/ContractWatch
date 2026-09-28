(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plusDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const money = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
  const niceDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const daysLeft = date => Math.ceil((new Date(`${date}T00:00:00`) - today) / 86400000);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const demoContracts = [
    { id: 1, contractName: 'AWS Cloud Services', vendor: 'Amazon Web Services', amount: 360000, currency: 'INR', startDate: plusDays(-360), endDate: plusDays(2), renewalNoticeDays: 30, status: 'ACTIVE', notes: 'Cloud hosting and infrastructure services.', discountPercent: 10, discountAmount: 36000, discountDeadline: plusDays(5) },
    { id: 2, contractName: 'Microsoft 365 Enterprise', vendor: 'Microsoft India', amount: 228000, currency: 'INR', startDate: plusDays(-358), endDate: plusDays(7), renewalNoticeDays: 45, status: 'PENDING', notes: 'Enterprise productivity subscriptions.', discountPercent: 15, discountAmount: 34200, discountDeadline: plusDays(5) },
    { id: 3, contractName: 'ABC Maintenance Plan', vendor: 'ABC Facilities', amount: 96000, currency: 'INR', startDate: plusDays(-344), endDate: plusDays(21), renewalNoticeDays: 30, status: 'ACTIVE', notes: 'Annual facilities and equipment maintenance.', discountPercent: 8, discountAmount: 7680, discountDeadline: plusDays(18) },
    { id: 4, contractName: 'GitHub Enterprise', vendor: 'GitHub, Inc.', amount: 144000, currency: 'INR', startDate: plusDays(-305), endDate: plusDays(60), renewalNoticeDays: 30, status: 'ACTIVE', notes: 'Developer tools and repository hosting.' },
    { id: 5, contractName: 'Northstar Design Studio', vendor: 'Northstar Creative', amount: 84000, currency: 'INR', startDate: plusDays(-710), endDate: plusDays(-12), renewalNoticeDays: 30, status: 'EXPIRED', notes: 'Design services agreement.' },
    { id: 6, contractName: 'Office Internet Services', vendor: 'Tata Communications', amount: 54000, currency: 'INR', startDate: plusDays(-500), endDate: plusDays(-32), renewalNoticeDays: 30, status: 'TERMINATED', notes: 'Prior connectivity agreement.' }
  ];
  const stored = (() => { try { return JSON.parse(localStorage.getItem('cw-contracts') || 'null'); } catch { return null; } })();
  let contracts = stored || demoContracts;
  let apiOnline = false;
  let documents = JSON.parse(localStorage.getItem('cw-documents') || '[]');
  let documentFiles = new Map();
  let currentPage = 'dashboard';
  let activeTab = 'all';
  let tableQuery = '';
  let notificationsOpen = false;
  let currentDrawerContract = null;

  const persist = () => localStorage.setItem('cw-contracts', JSON.stringify(contracts));
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try { const body = await response.json(); message = body.detail || body.message || message; } catch { /* use status */ }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  }
  async function loadContracts() {
    try { contracts = await api('/api/contracts'); apiOnline = true; persist(); }
    catch { apiOnline = false; contracts = stored || demoContracts; }
  }
  function saveContractLocal(contract) {
    const index = contracts.findIndex(c => Number(c.id) === Number(contract.id));
    if (index < 0) contracts.unshift(contract); else contracts[index] = contract;
    persist();
  }
  function statusBadge(status) {
    const label = String(status || 'ACTIVE').replace('_', ' ');
    const tone = ({ ACTIVE: 'active', PENDING: 'pending', RENEWED: 'renewed', EXPIRED: 'expired', TERMINATED: 'terminated', CANCELLED: 'expired' })[status] || 'info';
    return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
  }
  function priority(contract) {
    if (contract.status === 'PENDING') return ['PENDING', 'pending'];
    const left = daysLeft(contract.endDate);
    if (left < 0) return ['OVERDUE', 'critical'];
    if (left <= 3) return ['CRITICAL', 'critical'];
    if (left <= 10) return ['HIGH', 'high'];
    if (left <= 30) return ['MEDIUM', 'medium'];
    return ['NORMAL', 'normal'];
  }
  function contractIsOpen(c) { return ['ACTIVE', 'PENDING'].includes(c.status); }
  function needsAttention(c) { return contractIsOpen(c) && daysLeft(c.endDate) <= 30; }
  function setPage(page) {
    currentPage = page;
    $$('.nav-item[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $('#breadcrumb-current').textContent = ({ dashboard: 'Dashboard', add: 'Add contract', documents: 'Documents', renewals: 'Renewal decisions', closed: 'Closed contracts', reports: 'Reports', discounts: 'Discounts' })[page] || 'Dashboard';
    $('#sidebar').classList.remove('mobile-open');
    if (!$('#app').classList.contains('hidden')) renderPage();
  }
  function heading(title, subtitle, button = '') {
    return `<div class="page-heading"><div><p class="eyebrow">CONTRACTWATCH WORKSPACE</p><h1>${title}</h1><p>${subtitle}</p></div>${button}</div>`;
  }
  function contractRow(c) {
    const left = daysLeft(c.endDate), [priorityName, priorityTone] = priority(c);
    const action = contractIsOpen(c) ? `<button class="row-action" data-action="renew" data-id="${c.id}">Renew</button>` : `<span class="renewal-col">Archived</span>`;
    const daysClass = left <= 3 ? 'days-critical' : left <= 10 ? 'days-high' : 'days-normal';
    return `<tr data-open-contract="${c.id}"><td><div class="contract-name-cell"><span class="contract-glyph">▤</span>${escapeHtml(c.contractName)}</div></td><td class="vendor-cell">${escapeHtml(c.vendor)}</td><td>${niceDate(c.endDate)}</td><td class="${daysClass}">${left < 0 ? `${Math.abs(left)} days overdue` : `${left} days`}</td><td class="amount-cell">${money(c.amount, c.currency)}</td><td><span class="badge badge-${priorityTone}">${priorityName}</span></td><td class="renewal-col">${left < 0 ? 'Review renewal' : c.status === 'PENDING' ? 'Decision pending' : left <= 30 ? 'Renew or close' : 'Monitor'}</td><td>${statusBadge(c.status)}</td><td>${action}</td></tr>`;
  }
  function alertsTable(data) {
    if (!data.length) return `<div class="empty-state"><div class="empty-icon">✓</div><b>You're all caught up.</b><p>No contracts require immediate attention.</p></div>`;
    return `<div class="table-wrap"><table><thead><tr><th>CONTRACT</th><th>VENDOR</th><th>EXPIRY DATE</th><th>REMAINING</th><th>AMOUNT</th><th>PRIORITY</th><th>ACTION REQUIRED</th><th>STATUS</th><th></th></tr></thead><tbody>${data.map(contractRow).join('')}</tbody></table></div>`;
  }
  function alertItems() {
    const urgent = contracts.filter(needsAttention).sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate)).slice(0, 4);
    if (!urgent.length) return `<div class="empty-state"><div class="empty-icon">✓</div><b>You're all caught up.</b><p>No contracts need immediate attention.</p></div>`;
    return urgent.map(c => { const left = daysLeft(c.endDate), tone = left <= 3 ? 'red' : left <= 10 ? 'amber' : 'green'; return `<div class="attention-item" data-open-contract="${c.id}"><span class="attention-icon ${tone}">${left <= 3 ? '!' : left <= 10 ? '◷' : '✓'}</span><div><b>${escapeHtml(c.contractName)}</b><p>${escapeHtml(c.vendor)} · ${left < 0 ? `${Math.abs(left)} days overdue` : `Ends in ${left} days`}</p><small>${statusBadge(c.status)}</small></div></div>`; }).join('');
  }
  function renderDashboard() {
    const active = contracts.filter(c => c.status === 'ACTIVE').length;
    const due = contracts.filter(c => contractIsOpen(c) && daysLeft(c.endDate) >= 0 && daysLeft(c.endDate) <= 30).length;
    const overdue = contracts.filter(c => contractIsOpen(c) && daysLeft(c.endDate) < 0).length;
    const month = today.getMonth(), year = today.getFullYear();
    const expiring = contracts.filter(c => contractIsOpen(c) && new Date(`${c.endDate}T00:00:00`).getMonth() === month && new Date(`${c.endDate}T00:00:00`).getFullYear() === year).length;
    const totalValue = contracts.filter(c => c.status === 'ACTIVE').reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const rows = contracts.filter(needsAttention).sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));
    return `${heading('Contract Overview', 'Here is what needs your attention today.', '<button class="button button-primary" data-page-go="add"><span>＋</span> Add contract</button>')}
      <section class="hero-strip"><div class="hero-greeting"><span class="hero-emoji">☀</span><div><b>Good morning, Admin</b><p><strong>${due + overdue} contracts</strong> require your attention today.</p></div></div><div class="date-chip"><span>▦</span><b>${today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b></div></section>
      <section class="stats-grid">
        <article class="stat-card"><div class="stat-top">Contracts expiring this month <span class="stat-icon amber">▦</span></div><div class="stat-value">${expiring}</div><div class="stat-foot"><span class="up">Review window</span> · ${expiring} contracts need review</div></article>
        <article class="stat-card"><div class="stat-top">Renewals due soon <span class="stat-icon blue">◷</span></div><div class="stat-value">${due}</div><div class="stat-foot">Renewal window is open</div></article>
        <article class="stat-card"><div class="stat-top">Overdue renewals <span class="stat-icon red">!</span></div><div class="stat-value">${overdue}</div><div class="stat-foot"><span class="urgent">Immediate action required</span></div></article>
        <article class="stat-card"><div class="stat-top">Active contracts <span class="stat-icon green">✓</span></div><div class="stat-value">${active}</div><div class="stat-foot">${money(totalValue)} total active value</div></article>
      </section>
      <div class="content-grid"><section class="panel alert-panel"><div class="panel-header"><div><h2>Renewal Action Center</h2><p>Prioritized contracts requiring attention.</p></div><button class="text-link" data-page-go="renewals">View all →</button></div>
        <div class="alert-toolbar"><div class="tabs">${['all', 'critical', 'due-soon', 'pending', 'completed'].map(t => `<button class="tab-button ${activeTab === t ? 'active' : ''}" data-tab="${t}">${({ all: 'All', critical: 'Critical', 'due-soon': 'Due soon', pending: 'Pending', completed: 'Completed' })[t]}</button>`).join('')}</div><div class="table-tools"><input class="table-search" id="table-search" placeholder="⌕  Search contracts..." value="${escapeHtml(tableQuery)}"><button class="filter-button" data-page-go="renewals">☷ Filter</button></div></div>
        <div id="dashboard-alert-table">${alertsTable(filterAlerts(rows))}</div></section>
        <aside class="panel attention-side"><div class="panel-header"><div><h2>Attention needed</h2><p>Your next best actions.</p></div><span class="badge badge-high">${due + overdue} open</span></div><div class="attention-list">${alertItems()}</div></aside></div>`;
  }
  function filterAlerts(rows) {
    let result = rows;
    if (activeTab === 'critical') result = result.filter(c => daysLeft(c.endDate) <= 3);
    if (activeTab === 'due-soon') result = result.filter(c => daysLeft(c.endDate) > 3 && daysLeft(c.endDate) <= 30);
    if (activeTab === 'pending') result = result.filter(c => c.status === 'PENDING');
    if (activeTab === 'completed') result = contracts.filter(c => c.status === 'RENEWED');
    if (tableQuery) result = result.filter(c => `${c.contractName} ${c.vendor}`.toLowerCase().includes(tableQuery.toLowerCase()));
    return result;
  }
  function renderAdd() {
    return `${heading('Add a contract', 'Capture the details that keep every agreement on track.')}
      <form id="contract-form" class="form-layout"><div class="contract-form">
        <section class="form-section"><div class="form-section-title"><span>▤</span><div><h3>Contract information</h3><small>Give this agreement a clear name and owner.</small></div></div><div class="form-fields"><div class="field"><label for="contractName">Contract name *</label><input name="contractName" id="contractName" placeholder="e.g. Cloud hosting agreement" required></div><div class="field"><label for="contractType">Contract type</label><select name="contractType" id="contractType"><option>Software & technology</option><option>Professional services</option><option>Facilities</option><option>Other</option></select></div><div class="field full"><label for="notes">Description / notes</label><textarea name="notes" id="notes" placeholder="A short description for your team..."></textarea></div></div></section>
        <section class="form-section"><div class="form-section-title"><span>♙</span><div><h3>Vendor information</h3><small>Who provides this service?</small></div></div><div class="form-fields"><div class="field"><label for="vendor">Vendor name *</label><input name="vendor" id="vendor" placeholder="Company or supplier" required></div><div class="field"><label for="vendorEmail">Vendor email</label><input name="vendorEmail" id="vendorEmail" type="email" placeholder="renewals@vendor.com"></div></div></section>
        <section class="form-section"><div class="form-section-title"><span>◷</span><div><h3>Contract period</h3><small>Set the term and renewal reminder window.</small></div></div><div class="form-fields"><div class="field"><label for="startDate">Start date *</label><input name="startDate" id="startDate" type="date" required></div><div class="field"><label for="endDate">End date *</label><input name="endDate" id="endDate" type="date" required></div><div class="field"><label for="renewalNoticeDays">Renewal notice period</label><select name="renewalNoticeDays" id="renewalNoticeDays"><option value="15">15 days</option><option value="30" selected>30 days</option><option value="45">45 days</option><option value="60">60 days</option><option value="90">90 days</option></select></div><div class="field"><label for="status">Renewal status</label><select name="status" id="status"><option value="ACTIVE">Active</option><option value="PENDING">Decision pending</option></select></div></div></section>
        <section class="form-section"><div class="form-section-title"><span>₹</span><div><h3>Financial information</h3><small>Record the value and currency of this agreement.</small></div></div><div class="form-fields"><div class="field"><label for="amount">Contract amount *</label><input name="amount" id="amount" type="number" min="0" step="0.01" placeholder="0.00" required></div><div class="field"><label for="currency">Currency</label><select name="currency" id="currency"><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound Sterling</option></select></div></div></section>
        <section class="form-section"><div class="form-section-title"><span>％</span><div><h3>Discount information</h3><small>Optional early renewal offer and savings.</small></div></div><div class="form-fields"><div class="field"><label for="discountPercent">Discount (%)</label><input name="discountPercent" id="discountPercent" type="number" min="0" max="100" step="0.01" placeholder="e.g. 15"></div><div class="field"><label for="discountAmount">Potential savings</label><input name="discountAmount" id="discountAmount" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="field"><label for="discountDeadline">Offer deadline</label><input name="discountDeadline" id="discountDeadline" type="date"></div></div></section>
        <div class="form-actions"><button type="button" class="button" data-page-go="dashboard">Cancel</button><button class="button button-primary" type="submit">Save contract <span>→</span></button></div>
      </div><aside class="summary-sticky"><div class="summary-card"><h3>Contract summary</h3><p>Live preview of your agreement.</p><div class="summary-preview"><small>CONTRACT</small><b id="preview-name">Your contract name</b></div><div class="summary-line"><span>Vendor</span><b id="preview-vendor">—</b></div><div class="summary-line"><span>Duration</span><b id="preview-period">Select dates</b></div><div class="summary-line"><span>Amount</span><b id="preview-amount">—</b></div><div class="summary-line"><span>Renewal notice</span><b id="preview-notice">30 days</b></div><div class="summary-line"><span>Renewal window</span><b id="preview-window">—</b></div><div class="summary-line"><span>Discount</span><b id="preview-discount">—</b></div></div></aside></form>`;
  }
  function renderRenewals() {
    const rows = contracts.filter(needsAttention).sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));
    return `${heading('Renewal decisions', 'A clear timeline for every decision ahead.')}
      <section class="panel page-panel"><h2 class="section-title">Renewal timeline</h2><p class="section-subtitle">From original agreement to the next renewal decision.</p><div class="timeline"><div class="timeline-step complete"><div class="timeline-dot"></div><b>Original contract</b><small>Agreement signed</small></div><div class="timeline-step ${rows.some(c => daysLeft(c.endDate) <= Number(c.renewalNoticeDays || 30)) ? 'current' : ''}"><div class="timeline-dot"></div><b>Renewal window</b><small>Notice period open</small></div><div class="timeline-step"><div class="timeline-dot"></div><b>Decision</b><small>Renew or terminate</small></div><div class="timeline-step"><div class="timeline-dot"></div><b>Renewed contract</b><small>New term begins</small></div></div></section>
      <section class="table-card"><div class="table-card-head"><div><h2>Contracts requiring a decision</h2><p>Open a contract to review its terms and history.</p></div><div class="filters-line"><input id="renewal-search" placeholder="Search contracts..."><select id="renewal-filter"><option value="all">All open</option><option value="critical">Critical</option><option value="pending">Pending</option></select></div></div><div id="renewals-table">${alertsTable(rows)}</div></section>
      <section class="page-panel panel"><h2 class="section-title">Recent renewal history</h2><p class="section-subtitle">The latest renewal decisions saved in this workspace.</p><div id="renewal-history-feed">${renderHistoryCards()}</div></section>`;
  }
  function renderHistoryCards() {
    const histories = JSON.parse(localStorage.getItem('cw-history') || '[]');
    if (!histories.length) return `<div class="empty-state"><div class="empty-icon">◷</div><b>No renewal history yet</b><p>Renew a contract to add its decision and new terms here.</p></div>`;
    return histories.slice(0, 6).map(h => `<article class="history-card"><div class="history-card-head"><div><b>${escapeHtml(h.contractName)}</b><small style="display:block;margin-top:4px">Renewed on ${niceDate(h.renewedAt.slice(0, 10))}</small></div>${statusBadge('RENEWED')}</div><div class="history-metrics"><div><small>PREVIOUS AMOUNT</small><b>${money(h.previousAmount)}</b></div><div><small>NEW AMOUNT</small><b>${money(h.newAmount)}</b></div><div><small>DISCOUNT</small><b>${h.discountPercent ? `${h.discountPercent}%` : '—'}</b></div><div><small>NEW END DATE</small><b>${niceDate(h.newEndDate)}</b></div></div></article>`).join('');
  }
  function renderClosed() {
    const closed = contracts.filter(c => ['TERMINATED', 'EXPIRED', 'CANCELLED'].includes(c.status));
    const count = status => closed.filter(c => c.status === status).length;
    return `${heading('Closed contracts', 'Your archive of agreements that have ended.', '<button class="button" id="export-closed">⇩ Export archive</button>')}
      <div class="discount-metrics"><div class="mini-metric"><small>Terminated</small><b style="color:var(--red)">${count('TERMINATED')}</b></div><div class="mini-metric"><small>Expired</small><b style="color:var(--amber)">${count('EXPIRED')}</b></div><div class="mini-metric"><small>Cancelled</small><b>${count('CANCELLED')}</b></div><div class="mini-metric"><small>Archived total</small><b>${closed.length}</b></div></div>
      <div class="closed-banner"><div><b>Archive view</b><p>Closed contracts are read-only. Open a row to review its details.</p></div><span class="badge badge-info">READ ONLY</span></div>
      <section class="table-card"><div class="table-card-head"><div><h2>Archived agreements</h2><p>Search past agreements and review their contract details.</p></div><div class="filters-line"><input id="closed-search" placeholder="Search archive..."></div></div><div id="closed-table">${renderClosedTable(closed)}</div></section>`;
  }
  function renderClosedTable(rows) {
    if (!rows.length) return `<div class="empty-state"><div class="empty-icon">▣</div><b>No closed contracts</b><p>Contracts marked expired, terminated, or cancelled will be saved here.</p></div>`;
    return `<div class="table-wrap"><table><thead><tr><th>CONTRACT</th><th>VENDOR</th><th>END DATE</th><th>AMOUNT</th><th>STATUS</th><th>NOTES</th></tr></thead><tbody>${rows.map(c => `<tr data-open-contract="${c.id}"><td><div class="contract-name-cell"><span class="contract-glyph">▤</span>${escapeHtml(c.contractName)}</div></td><td>${escapeHtml(c.vendor)}</td><td>${niceDate(c.endDate)}</td><td class="amount-cell">${money(c.amount, c.currency)}</td><td>${statusBadge(c.status)}</td><td>${escapeHtml(c.notes || '—')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderDiscounts() {
    const items = contracts.filter(c => c.discountPercent || c.discountAmount);
    const active = items.filter(c => c.discountDeadline && daysLeft(c.discountDeadline) >= 0);
    const expiring = active.filter(c => daysLeft(c.discountDeadline) <= 7);
    const expired = items.filter(c => c.discountDeadline && daysLeft(c.discountDeadline) < 0);
    const savings = active.reduce((sum, c) => sum + Number(c.discountAmount || 0), 0);
    return `${heading('Discount management', 'Spot an offer in time and understand its savings.')}
      <div class="discount-metrics"><div class="mini-metric"><small>Active discounts</small><b>${active.length}</b></div><div class="mini-metric"><small>Expiring soon</small><b style="color:var(--amber)">${expiring.length}</b></div><div class="mini-metric"><small>Expired</small><b style="color:var(--red)">${expired.length}</b></div><div class="mini-metric"><small>Potential savings</small><b style="color:var(--green);font-size:17px">${money(savings)}</b></div></div>
      <div class="panel-header" style="padding:15px 2px"><div><h2 style="font:700 14px Manrope;margin:0 0 4px">Early renewal offers</h2><p style="font-size:10px;color:#87928b;margin:0">Compare the offer value with its remaining time.</p></div></div>
      ${items.length ? `<div class="discount-grid">${items.map(c => discountCard(c)).join('')}</div>` : `<section class="panel"><div class="empty-state"><div class="empty-icon">％</div><b>No discount offers yet</b><p>Add discount details to a contract to track early renewal savings.</p><button class="button button-primary" data-page-go="add">＋ Add contract</button></div></section>`}`;
  }
  function discountCard(c) {
    const left = c.discountDeadline ? daysLeft(c.discountDeadline) : null;
    const expired = left !== null && left < 0;
    const width = left === null ? 30 : Math.max(4, Math.min(100, (left / 30) * 100));
    return `<article class="discount-card"><div class="discount-label">${expired ? 'OFFER EXPIRED' : 'EARLY RENEWAL OFFER'}</div><h3>${escapeHtml(c.contractName)}</h3><p class="vendor">${escapeHtml(c.vendor)}</p><div class="discount-percent">${Number(c.discountPercent || 0)}% <small style="font-size:10px;font-weight:600">OFF</small></div><div class="discount-savings">${money(c.discountAmount || 0, c.currency)} potential savings</div><div class="discount-deadline"><span>${expired ? 'Offer ended' : 'Offer ends'}</span><b>${c.discountDeadline ? niceDate(c.discountDeadline) : 'No deadline'}</b></div><div class="progress-track"><span style="width:${width}%;background:${expired ? 'var(--red)' : left <= 7 ? '#d96b51' : '#d99a43'}"></span></div><button class="button ${expired ? '' : 'button-primary'}" data-action="renew" data-id="${c.id}" ${expired ? 'disabled' : ''}>${expired ? 'Expired' : 'Renew now'} <span>→</span></button></article>`;
  }
  function renderDocuments() {
    const query = window.docQuery || '';
    const list = documents.filter(d => `${d.name} ${d.type} ${d.contract}`.toLowerCase().includes(query.toLowerCase()))
      .filter(d => !window.docType || window.docType === 'all' || d.type === window.docType);
    return `${heading('Documents', 'One tidy library for the paperwork behind every agreement.', '<button class="button button-primary" id="upload-trigger"><span>↑</span> Upload document</button>')}
      <section class="panel page-panel"><div class="docs-toolbar"><input id="docs-search" placeholder="⌕  Search documents..." value="${escapeHtml(query)}"><select id="doc-type-filter" class="filter-button"><option value="all" ${!window.docType || window.docType === 'all' ? 'selected' : ''}>All document types</option><option value="Contract" ${window.docType === 'Contract' ? 'selected' : ''}>Contract</option><option value="Renewal" ${window.docType === 'Renewal' ? 'selected' : ''}>Renewal</option><option value="Invoice" ${window.docType === 'Invoice' ? 'selected' : ''}>Invoice</option><option value="Other" ${window.docType === 'Other' ? 'selected' : ''}>Other</option></select></div>
      <label id="drop-zone" class="drop-zone"><span style="font-size:20px;color:var(--green)">↑</span><b>Drop files to upload</b><span>or click to choose files · PDF, DOCX, XLSX, PNG</span><input id="file-input" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></label>
      <h2 class="section-title" style="margin:21px 0 4px">All documents <span id="document-list-count" style="color:#94a098;font-weight:500">(${list.length})</span></h2><p class="section-subtitle" style="margin-bottom:10px">Files are kept in this browser in demo mode.</p><div class="document-list">${list.length ? list.map(d => documentRow(d, documents.indexOf(d))).join('') : `<div class="empty-state"><div class="empty-icon">▤</div><b>No documents uploaded</b><p>Drop a contract or renewal file here to add it to the library.</p></div>`}</div></section>`;
  }
  function documentRow(d, i) {
    return `<div class="document-row"><span class="file-icon">▤</span><div><b>${escapeHtml(d.name)}</b><small>${escapeHtml(d.type)} · ${escapeHtml(d.contract || 'Unassigned contract')} · v${d.version || 1} · ${niceDate(d.uploadedAt || plusDays(0))}</small></div><small style="color:#929d96">${escapeHtml(d.uploadedBy || 'Alexandra Davis')}</small><div class="doc-actions"><button class="button icon-button-small" data-doc-action="preview" data-index="${i}" title="Preview">◉</button><button class="button icon-button-small" data-doc-action="download" data-index="${i}" title="Download">↓</button><button class="button icon-button-small" data-doc-action="delete" data-index="${i}" title="Delete">×</button></div></div>`;
  }
  function renderReports() {
    const total = contracts.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + Number(c.amount || 0), 0);
    const renewed = contracts.filter(c => c.status === 'RENEWED').length;
    const closed = contracts.filter(c => ['EXPIRED', 'TERMINATED', 'CANCELLED'].includes(c.status)).length;
    const byStatus = { active: contracts.filter(c => c.status === 'ACTIVE').length, pending: contracts.filter(c => c.status === 'PENDING').length, closed, renewed };
    const statusTotal = Math.max(1, Object.values(byStatus).reduce((a, b) => a + b, 0));
    const statusPct = Object.fromEntries(Object.entries(byStatus).map(([key, value]) => [key, value / statusTotal * 100]));
    const donutStops = `#19885e 0 ${statusPct.active}%,#edb04e ${statusPct.active}% ${statusPct.active + statusPct.pending}%,#d56b61 ${statusPct.active + statusPct.pending}% ${statusPct.active + statusPct.pending + statusPct.closed}%,#7e65ab ${statusPct.active + statusPct.pending + statusPct.closed}% 100%`;
    const saved = JSON.parse(localStorage.getItem('cw-history') || '[]').reduce((s, h) => s + Math.max(0, Number(h.previousAmount || 0) - Number(h.newAmount || 0)), 0);
    const months = Array.from({ length: 8 }, (_, i) => { const d = new Date(today.getFullYear(), today.getMonth() + i, 1); return { label: d.toLocaleDateString('en', { month: 'short' }), month: d.getMonth(), year: d.getFullYear() }; });
    const monthStats = months.map(m => ({ ...m, active: contracts.filter(c => c.status === 'ACTIVE' && new Date(`${c.endDate}T00:00:00`).getMonth() === m.month && new Date(`${c.endDate}T00:00:00`).getFullYear() === m.year).length, pending: contracts.filter(c => c.status === 'PENDING' && new Date(`${c.endDate}T00:00:00`).getMonth() === m.month && new Date(`${c.endDate}T00:00:00`).getFullYear() === m.year).length }));
    const monthMax = Math.max(1, ...monthStats.map(m => m.active + m.pending));
    const spend = months.map(m => contracts.filter(c => ['ACTIVE', 'PENDING'].includes(c.status) && new Date(`${c.endDate}T00:00:00`).getMonth() === m.month && new Date(`${c.endDate}T00:00:00`).getFullYear() === m.year).reduce((sum, c) => sum + Number(c.amount || 0), 0));
    const spendMax = Math.max(1, ...spend);
    const spendPoints = spend.map((value, i) => `${(i * 500 / Math.max(1, spend.length - 1)).toFixed(1)},${(125 - value / spendMax * 100).toFixed(1)}`);
    const spendPath = spendPoints.map((point, i) => `${i ? 'L' : 'M'}${point}`).join(' ');
    const spendArea = `${spendPath} L500 150 L0 150 Z`;
    return `${heading('Reports & analytics', 'Understand your obligations and renewal outcomes.', '<button class="button button-primary" id="generate-report">▥ Generate report</button>')}
      <div class="discount-metrics"><div class="mini-metric"><small>Total contract value</small><b style="font-size:16px">${money(total)}</b></div><div class="mini-metric"><small>Renewals this year</small><b>${renewed}</b></div><div class="mini-metric"><small>Total savings</small><b style="color:var(--green);font-size:16px">${money(saved)}</b></div><div class="mini-metric"><small>Contracts closed</small><b>${closed}</b></div></div>
      <div class="chart-grid"><section class="chart-card"><h3>Contracts by status</h3><p>A current snapshot of your portfolio.</p><div class="donut-wrap"><div class="donut" style="background:conic-gradient(${donutStops})"><div class="donut-center"><b>${contracts.length}</b><small>contracts</small></div></div><div class="legend"><span><i></i>Active · ${byStatus.active}</span><span><i></i>Pending · ${byStatus.pending}</span><span><i></i>Closed · ${closed}</span><span><i></i>Renewed · ${renewed}</span></div></div></section>
      <section class="chart-card"><h3>Upcoming renewals</h3><p>Active and pending agreements by end date.</p><div class="bar-chart-wrap"><div class="bar-chart">${monthStats.map(m => `<div class="bar-group"><span class="bar" title="${m.active} active" style="height:${m.active ? Math.max(5, m.active / monthMax * 90) : 0}%"></span><span class="bar" title="${m.pending} pending" style="height:${m.pending ? Math.max(5, m.pending / monthMax * 90) : 0}%"></span><small class="bar-label">${m.label}</small></div>`).join('')}</div></div></section>
      <section class="chart-card"><h3>Monthly renewal spending</h3><p>Contract value by end date · next eight months.</p><svg class="line-chart" viewBox="0 0 500 150" preserveAspectRatio="none" aria-label="Monthly renewal spending chart"><path d="${spendPath}" fill="none" stroke="#18865d" stroke-width="3"/><path d="${spendArea}" fill="#18865d" opacity=".08"/><g fill="#18865d">${spendPoints.map(point => { const [x, y] = point.split(','); return `<circle cx="${x}" cy="${y}" r="4"/>`; }).join('')}</g></svg><div style="display:flex;justify-content:space-between;color:#99a39c;font-size:8px">${months.map(m => `<span>${m.label}</span>`).join('')}</div></section>
      <section class="chart-card"><h3>Renewed vs terminated</h3><p>Renewal decisions recorded this year.</p><div class="donut-wrap"><div class="donut" style="background:conic-gradient(#18865d 0 72%,#dc7569 72%)"><div class="donut-center"><b>${renewed + closed}</b><small>decisions</small></div></div><div class="legend"><span><i></i>Renewed · ${renewed}</span><span><i style="background:#dc7569"></i>Terminated · ${closed}</span><span><i style="background:#e1e8e3"></i>Renewal rate · 72%</span></div></div></section>
      <div class="chart-card"><h3>Discount savings</h3><p>Available early renewal offers vs. recorded savings.</p><div class="stat-value" style="color:var(--green)">${money(contracts.reduce((s, c) => s + Number(c.discountAmount || 0), 0))}</div><div class="progress-track"><span style="width:62%;background:var(--purple)"></span></div><small style="color:#8e9992;font-size:9px">Potential savings across current offers</small><div style="display:flex;gap:7px;margin-top:17px"><button class="button button-small" data-export="csv">Export CSV</button><button class="button button-small" data-export="excel">Export Excel</button><button class="button button-small" data-export="pdf">Export PDF</button></div></div></div>`;
  }
  function renderPage() {
    const content = $('#page-content');
    content.innerHTML = ({ dashboard: renderDashboard, add: renderAdd, renewals: renderRenewals, closed: renderClosed, discounts: renderDiscounts, documents: renderDocuments, reports: renderReports })[currentPage]();
    bindPageEvents();
    updateDocumentCount();
  }
  function openDrawer(id) {
    const c = contracts.find(x => Number(x.id) === Number(id)); if (!c) return;
    currentDrawerContract = c;
    const left = daysLeft(c.endDate), history = JSON.parse(localStorage.getItem('cw-history') || '[]').filter(h => Number(h.contractId) === Number(c.id));
    $('#contract-drawer').innerHTML = `<div class="drawer-top"><p class="eyebrow">CONTRACT OVERVIEW</p><button class="button icon-button-small" data-close-drawer aria-label="Close details">×</button></div><div class="drawer-contract-title"><span class="contract-glyph">▤</span><div><h2>${escapeHtml(c.contractName)}</h2><p>${escapeHtml(c.vendor)} · CW-${String(c.id).padStart(4, '0')}</p></div></div>
      <section class="drawer-section"><h3>Contract details</h3><div class="detail-grid"><div><small>Start date</small><b>${niceDate(c.startDate)}</b></div><div><small>End date</small><b>${niceDate(c.endDate)}</b></div><div><small>Contract amount</small><b>${money(c.amount, c.currency)}</b></div><div><small>Renewal notice</small><b>${c.renewalNoticeDays || 30} days</b></div><div><small>Renewal status</small><b>${statusBadge(c.status)}</b></div><div><small>Time remaining</small><b>${left < 0 ? `${Math.abs(left)} days overdue` : `${left} days`}</b></div><div><small>Vendor contact</small><b>${escapeHtml(c.vendorEmail || 'Not provided')}</b></div><div><small>Discount offer</small><b>${c.discountPercent ? `${c.discountPercent}% · ${money(c.discountAmount, c.currency)}` : 'None'}</b></div></div></section>
      <section class="drawer-section"><h3>Renewal timeline</h3><div class="timeline"><div class="timeline-step complete"><div class="timeline-dot"></div><b>Created</b><small>${niceDate(c.startDate)}</small></div><div class="timeline-step ${left <= Number(c.renewalNoticeDays || 30) ? 'current' : ''}"><div class="timeline-dot"></div><b>Window open</b><small>${niceDate(new Date(new Date(`${c.endDate}T00:00:00`).getTime() - Number(c.renewalNoticeDays || 30) * 86400000).toISOString().slice(0, 10))}</small></div><div class="timeline-step"><div class="timeline-dot"></div><b>Decision</b><small>${c.status === 'PENDING' ? 'Pending' : 'Upcoming'}</small></div><div class="timeline-step"><div class="timeline-dot"></div><b>Renewed</b><small>Next term</small></div></div></section>
      <section class="drawer-section"><h3>Documents</h3><p style="font-size:10px;color:#8b968e">${documents.some(d => d.contractId === c.id) ? 'Documents are available in the library.' : 'No documents linked to this contract yet.'}</p><button class="button button-small" data-open-documents>▤ View documents</button></section>
      <section class="drawer-section"><h3>Renewal history</h3>${history.length ? history.map(h => `<div class="history-card"><div class="history-card-head"><b>Renewed ${niceDate(h.renewedAt.slice(0, 10))}</b>${statusBadge('RENEWED')}</div><div class="history-metrics"><div><small>Previous</small><b>${money(h.previousAmount)}</b></div><div><small>New</small><b>${money(h.newAmount)}</b></div><div><small>Discount</small><b>${h.discountPercent || 0}%</b></div></div></div>`).join('') : '<p style="font-size:10px;color:#8b968e">No renewal decisions have been recorded yet.</p>'}</section>
      <section class="drawer-section"><h3>Actions</h3><div class="drawer-actions">${contractIsOpen(c) ? `<button class="button button-primary" data-action="renew" data-id="${c.id}">↻ Renew</button><button class="button" data-action="pending" data-id="${c.id}">Mark pending</button><button class="button button-danger" data-action="terminate" data-id="${c.id}">Terminate</button>` : '<span class="badge badge-info">READ ONLY · ARCHIVED</span>'}<button class="button" data-open-documents>▤ View documents</button></div></section>`;
    $('#contract-drawer').classList.add('open'); $('#drawer-backdrop').classList.add('open');
  }
  function closeDrawer() { $('#contract-drawer').classList.remove('open'); $('#drawer-backdrop').classList.remove('open'); }
  function showModal(title, body, actions = '') { $('#modal').innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="button icon-button-small" data-close-modal aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div><div class="modal-actions">${actions || '<button class="button" data-close-modal>Close</button>'}</div>`; $('#modal-backdrop').classList.add('open'); }
  function closeModal() { $('#modal-backdrop').classList.remove('open'); }
  function toast(message, error = false) { const el = document.createElement('div'); el.className = `toast${error ? ' error' : ''}`; el.textContent = message; $('#toast-region').append(el); setTimeout(() => el.remove(), 3300); }
  function confirmAction(title, message, confirmLabel, callback, danger = false) {
    showModal(title, `<p>${message}</p>`, `<button class="button" data-close-modal>Cancel</button><button class="button ${danger ? 'button-danger' : 'button-primary'}" id="confirm-modal-action">${confirmLabel}</button>`);
    $('#confirm-modal-action').addEventListener('click', async () => { closeModal(); await callback(); });
  }
  async function renewContract(id) {
    const c = contracts.find(x => Number(x.id) === Number(id)); if (!c) return;
    const next = new Date(`${c.endDate}T00:00:00`); next.setFullYear(next.getFullYear() + 1);
    const newEndDate = next.toISOString().slice(0, 10);
    const newAmount = Math.max(0, Number(c.amount || 0) * (c.discountPercent ? 1 - Number(c.discountPercent) / 100 : 1));
    const oldAmount = Number(c.amount || 0), oldEndDate = c.endDate;
    try {
      let updated;
      if (apiOnline) updated = await api(`/api/contracts/${id}/renew`, { method: 'POST', body: JSON.stringify({ newEndDate, newAmount, discountPercent: Number(c.discountPercent || 0) }) });
      else updated = { ...c, endDate: newEndDate, amount: newAmount, status: 'ACTIVE' };
      saveContractLocal(updated);
      const history = JSON.parse(localStorage.getItem('cw-history') || '[]');
      history.unshift({ contractId: c.id, contractName: c.contractName, renewedAt: new Date().toISOString(), previousEndDate: oldEndDate, newEndDate, previousAmount: oldAmount, newAmount, discountPercent: Number(c.discountPercent || 0) });
      localStorage.setItem('cw-history', JSON.stringify(history));
      closeDrawer(); renderPage(); toast(`${c.contractName} renewed successfully.`);
    } catch (err) { toast(err.message, true); }
  }
  async function changeStatus(id, status) {
    const c = contracts.find(x => Number(x.id) === Number(id)); if (!c) return;
    try { const updated = apiOnline ? await api(`/api/contracts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }) : { ...c, status }; saveContractLocal(updated); closeDrawer(); renderPage(); toast(`Contract marked ${status.toLowerCase()}.`); }
    catch (err) { toast(err.message, true); }
  }
  function bindPageEvents() {
    $$('#page-content [data-page-go]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.pageGo)));
    $$('#page-content [data-tab]').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderPage(); }));
    $$('#page-content [data-open-contract]').forEach(el => el.addEventListener('click', e => { if (e.target.closest('[data-action]')) return; openDrawer(el.dataset.openContract); }));
    $$('#page-content [data-action="renew"]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = b.dataset.id; const c = contracts.find(x => Number(x.id) === Number(id)); confirmAction('Renew this contract?', `Renew <b>${escapeHtml(c.contractName)}</b> for another 12 months${c.discountPercent ? ` and apply the ${c.discountPercent}% offer` : ''}?`, 'Confirm renewal', () => renewContract(id)); }));
    $$('#page-content [data-action="pending"]').forEach(b => b.addEventListener('click', () => changeStatus(b.dataset.id, 'PENDING')));
    $$('#page-content [data-action="terminate"]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.id; confirmAction('Terminate contract?', 'This marks the contract as terminated and moves it to the read-only archive.', 'Terminate contract', () => changeStatus(id, 'TERMINATED'), true); }));
    const search = $('#table-search'); if (search) search.addEventListener('input', () => { tableQuery = search.value; const table = $('#dashboard-alert-table'); if (table) table.innerHTML = alertsTable(filterAlerts(contracts.filter(needsAttention).sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate)))); bindRowsOnly(); });
    const renewalSearch = $('#renewal-search'), renewalFilter = $('#renewal-filter');
    const updateRenewalTable = () => { let rows = contracts.filter(needsAttention); if (renewalSearch?.value) rows = rows.filter(c => `${c.contractName} ${c.vendor}`.toLowerCase().includes(renewalSearch.value.toLowerCase())); if (renewalFilter?.value === 'critical') rows = rows.filter(c => daysLeft(c.endDate) <= 3); if (renewalFilter?.value === 'pending') rows = rows.filter(c => c.status === 'PENDING'); $('#renewals-table').innerHTML = alertsTable(rows); bindRowsOnly(); };
    renewalSearch?.addEventListener('input', updateRenewalTable); renewalFilter?.addEventListener('change', updateRenewalTable);
    const closedSearch = $('#closed-search'); closedSearch?.addEventListener('input', () => { const rows = contracts.filter(c => ['TERMINATED', 'EXPIRED', 'CANCELLED'].includes(c.status)).filter(c => `${c.contractName} ${c.vendor}`.toLowerCase().includes(closedSearch.value.toLowerCase())); $('#closed-table').innerHTML = renderClosedTable(rows); bindRowsOnly(); });
    $('#export-closed')?.addEventListener('click', () => exportCsv(contracts.filter(c => ['TERMINATED', 'EXPIRED', 'CANCELLED'].includes(c.status)), 'contractwatch-closed-contracts.csv'));
    $('#generate-report')?.addEventListener('click', () => { toast('Your report is ready to export.'); $('.chart-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $$('[data-export]').forEach(b => b.addEventListener('click', () => b.dataset.export === 'pdf' ? toast('Use your browser’s Print → Save as PDF to export this report.') : exportCsv(contracts, `contractwatch-report.${b.dataset.export === 'excel' ? 'csv' : 'csv'}`)));
    $('#upload-trigger')?.addEventListener('click', () => $('#file-input')?.click());
    $('#file-input')?.addEventListener('change', e => addFiles(e.target.files));
    $('#drop-zone')?.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
    $('#drop-zone')?.addEventListener('dragleave', e => e.currentTarget.classList.remove('dragover'));
    $('#drop-zone')?.addEventListener('drop', e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
    $('#docs-search')?.addEventListener('input', e => { window.docQuery = e.target.value; const cursor = e.target.selectionStart; renderPage(); $('#docs-search').focus(); $('#docs-search').setSelectionRange(cursor, cursor); });
    $('#doc-type-filter')?.addEventListener('change', e => { window.docType = e.target.value; renderPage(); });
    $$('#page-content [data-doc-action]').forEach(b => b.addEventListener('click', () => documentAction(b.dataset.docAction, Number(b.dataset.index))));
    if ($('#contract-form')) bindLiveSummary();
  }
  function bindRowsOnly() {
    $$('#page-content [data-open-contract]').forEach(el => el.addEventListener('click', e => { if (!e.target.closest('[data-action]')) openDrawer(el.dataset.openContract); }));
    $$('#page-content [data-action="renew"]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const c = contracts.find(x => Number(x.id) === Number(b.dataset.id)); confirmAction('Renew this contract?', `Renew <b>${escapeHtml(c.contractName)}</b> for another 12 months?`, 'Confirm renewal', () => renewContract(c.id)); }));
  }
  function bindLiveSummary() {
    const form = $('#contract-form');
    const update = () => {
      const data = new FormData(form), name = data.get('contractName') || 'Your contract name', vendor = data.get('vendor') || '—';
      $('#preview-name').textContent = name; $('#preview-vendor').textContent = vendor;
      const start = data.get('startDate'), end = data.get('endDate'); $('#preview-period').textContent = start && end ? `${niceDate(start)} → ${niceDate(end)}` : 'Select dates';
      const amount = Number(data.get('amount') || 0); $('#preview-amount').textContent = amount ? money(amount, data.get('currency')) : '—';
      $('#preview-notice').textContent = `${data.get('renewalNoticeDays')} days`;
      if (end) { const date = new Date(`${end}T00:00:00`); date.setDate(date.getDate() - Number(data.get('renewalNoticeDays') || 30)); $('#preview-window').textContent = niceDate(date.toISOString().slice(0, 10)); } else $('#preview-window').textContent = '—';
      $('#preview-discount').textContent = data.get('discountPercent') ? `${data.get('discountPercent')}% · ${money(data.get('discountAmount') || 0, data.get('currency'))}` : '—';
    };
    form.addEventListener('input', update); form.addEventListener('change', update); update();
  }
  async function saveNewContract(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    for (const key of ['amount', 'renewalNoticeDays', 'discountPercent', 'discountAmount']) data[key] = data[key] === '' ? null : Number(data[key]);
    if (!data.discountPercent) delete data.discountPercent; if (!data.discountAmount) delete data.discountAmount; if (!data.discountDeadline) delete data.discountDeadline;
    try {
      let saved;
      if (apiOnline) saved = await api('/api/contracts', { method: 'POST', body: JSON.stringify(data) });
      else saved = { ...data, id: Math.max(0, ...contracts.map(c => Number(c.id) || 0)) + 1, status: data.status || 'ACTIVE' };
      saveContractLocal(saved); toast('Contract saved successfully.'); setPage('dashboard');
    } catch (err) { toast(err.message, true); }
  }
  function addFiles(fileList) {
    const files = [...fileList]; if (!files.length) return;
    files.forEach(file => {
      const id = `${Date.now()}-${Math.random()}`;
      documentFiles.set(id, file);
      documents.unshift({ id, name: file.name, type: /renew/i.test(file.name) ? 'Renewal' : /invoice/i.test(file.name) ? 'Invoice' : /contract|agreement/i.test(file.name) ? 'Contract' : 'Other', contract: 'Unassigned contract', version: 1, uploadedAt: plusDays(0), uploadedBy: 'Alexandra Davis', mimeType: file.type });
    });
    localStorage.setItem('cw-documents', JSON.stringify(documents)); renderPage(); toast(`${files.length} document${files.length > 1 ? 's' : ''} added to your library.`);
  }
  function documentAction(action, index) {
    const doc = documents[index]; if (!doc) return;
    if (action === 'delete') { confirmAction('Delete this document?', `<b>${escapeHtml(doc.name)}</b> will be removed from this browser’s document library.`, 'Delete document', () => { documentFiles.delete(doc.id); documents.splice(index, 1); localStorage.setItem('cw-documents', JSON.stringify(documents)); renderPage(); toast('Document deleted.'); }, true); return; }
    const file = documentFiles.get(doc.id); if (!file) { toast('This demo file is not available after a page reload.', true); return; }
    const url = URL.createObjectURL(file);
    if (action === 'download') { const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
    else { showModal(escapeHtml(file.name), file.type.startsWith('image/') ? `<img alt="${escapeHtml(file.name)}" src="${url}" style="max-width:100%;max-height:60vh;display:block;margin:auto">` : file.type === 'application/pdf' ? `<iframe title="${escapeHtml(file.name)}" src="${url}" style="width:100%;height:55vh;border:0"></iframe>` : `<p>Preview is not available for this file type. You can download the file instead.</p>`, `<a class="button button-primary" href="${url}" download="${escapeHtml(file.name)}">Download file</a>`); }
  }
  function updateDocumentCount() { $('#document-count').textContent = documents.length; }
  function exportCsv(rows, filename) {
    const headers = ['Contract name', 'Vendor', 'Amount', 'Currency', 'Start date', 'End date', 'Status', 'Renewal notice days'];
    const csv = [headers, ...rows.map(c => [c.contractName, c.vendor, c.amount, c.currency, c.startDate, c.endDate, c.status, c.renewalNoticeDays])].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function bindGlobalEvents() {
    $('#login-form').addEventListener('submit', e => { e.preventDefault(); $('#login-screen').classList.add('hidden'); $('#app').classList.remove('hidden'); setPage('dashboard'); });
    $('#page-content').addEventListener('submit', e => { if (e.target.id === 'contract-form') { e.preventDefault(); saveNewContract(e.target); } });
    $('#toggle-password').addEventListener('click', e => { const input = $('#login-password'); input.type = input.type === 'password' ? 'text' : 'password'; e.currentTarget.textContent = input.type === 'password' ? 'Show' : 'Hide'; });
    $('#forgot-link').addEventListener('click', e => { e.preventDefault(); showModal('Reset your password', '<p>Password recovery needs a configured account service. For this UI preview, use the sign-in form to enter the workspace.</p>'); });
    $$('.nav-item[data-page]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));
    $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('mobile-open'));
    $('#drawer-backdrop').addEventListener('click', closeDrawer);
    $('#modal-backdrop').addEventListener('click', e => { if (e.target === $('#modal-backdrop')) closeModal(); });
    document.addEventListener('click', e => {
      if (e.target.closest('[data-close-drawer]')) closeDrawer();
      if (e.target.closest('[data-close-modal]')) closeModal();
      if (e.target.closest('[data-open-documents]')) { closeDrawer(); setPage('documents'); }
      const action = e.target.closest('[data-action]');
      if (action && action.closest('#contract-drawer')) {
        const id = action.dataset.id;
        if (action.dataset.action === 'renew') { const c = contracts.find(x => Number(x.id) === Number(id)); confirmAction('Renew this contract?', `Renew <b>${escapeHtml(c.contractName)}</b> for another 12 months${c.discountPercent ? ` and apply the ${c.discountPercent}% offer` : ''}?`, 'Confirm renewal', () => renewContract(id)); }
        if (action.dataset.action === 'pending') changeStatus(id, 'PENDING');
        if (action.dataset.action === 'terminate') confirmAction('Terminate contract?', 'This marks the contract as terminated and moves it to the read-only archive.', 'Terminate contract', () => changeStatus(id, 'TERMINATED'), true);
      }
    });
    $('#notification-button').addEventListener('click', () => {
      const urgent = contracts.filter(needsAttention).sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate)).slice(0, 3);
      showModal('Notifications', urgent.length ? urgent.map(c => `<div class="attention-item" data-notification-contract="${c.id}"><span class="attention-icon ${daysLeft(c.endDate) <= 3 ? 'red' : 'amber'}">!</span><div><b>${escapeHtml(c.contractName)}</b><p>${daysLeft(c.endDate) < 0 ? 'is overdue' : `expires in ${daysLeft(c.endDate)} days`}</p></div></div>`).join('') : '<p>You’re all caught up — there are no urgent renewal alerts. ✓</p>');
      $$('#modal [data-notification-contract]').forEach(el => el.addEventListener('click', () => { const id = el.dataset.notificationContract; closeModal(); openDrawer(id); }));
    });
    $('#global-search').addEventListener('input', e => { const q = e.target.value.toLowerCase(); if (!$('#app').classList.contains('hidden') && q.length > 1) { tableQuery = q; activeTab = 'all'; if (currentPage !== 'dashboard') setPage('dashboard'); else renderPage(); } });
    $('#global-search').addEventListener('keydown', e => { if (e.key === 'Enter') { setPage('dashboard'); } });
    document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#global-search').focus(); } if (e.key === 'Escape') { closeDrawer(); closeModal(); } });
    $('#help-button').addEventListener('click', () => showModal('ContractWatch help center', '<p>Stay ahead of deadlines: add contract dates, set a notice period, and review the Renewal Action Center regularly.</p>'));
    $('#settings-button').addEventListener('click', () => showModal('Workspace settings', '<p>Workspace preferences and access controls will appear here when account management is configured.</p>'));
    $('.dots-button').addEventListener('click', () => showModal('Profile', '<p>Signed in as Alexandra Davis · Workspace admin</p>'));
    $('.top-user').addEventListener('click', () => showModal('Profile', '<p>Signed in as Alexandra Davis · Workspace admin</p>'));
  }
  bindGlobalEvents();
  loadContracts().then(() => { if (!$('#app').classList.contains('hidden')) renderPage(); });
})();
