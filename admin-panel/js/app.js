/* ============================================================
   Helpmeet Admin Panel — app.js
   Panel de administracion de licencias.
   Backend: FastAPI (helpmeet-licenses)
   ============================================================ */
'use strict';

const API = window.APP_CONFIG?.API_URL || '';

const PLAN_PRICES = { personal: 49, pro: 99, team: 199 };
const PLAN_LABELS = { personal: 'Personal', pro: 'Pro', team: 'Team' };
const PLAN_KEYS   = ['personal', 'pro', 'team'];

let adminKey = window.APP_CONFIG?.ADMIN_API_KEY || '';
let confirmCallback = null;
const emailStatus = JSON.parse(localStorage.getItem('hm_email_status') || '{}');
let revokedVisible = false;

// Cache + filters for the active licenses table
let allLicenses = [];
const filters = { q: '', plan: '' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function el(id) { return document.getElementById(id); }
function saveEmailStatus() { localStorage.setItem('hm_email_status', JSON.stringify(emailStatus)); }
function headers(extra = {}) { return { 'X-Admin-Key': adminKey, ...extra }; }
async function apiFetch(path, options = {}) {
  return fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...options.headers } });
}

// ─── TOAST ───
let toastTimer;
function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── LOG ───
function addLog(type, msg) {
  el('logSection').style.display = 'block';
  const t = new Date().toLocaleTimeString('es');
  const cls = type === 'ok' ? 'log-ok' : 'log-err';
  const icon = type === 'ok' ? '\u2713' : '\u2717';
  const entry = document.createElement('div');
  entry.innerHTML = `<span class="log-ts">[${esc(t)}]</span><span class="${cls}">${icon} ${esc(msg)}</span>`;
  el('logBox').prepend(entry);
}
function clearLogs() {
  el('logBox').innerHTML = '';
  el('logSection').style.display = 'none';
}

// ─── LOGIN ───
async function doLogin() {
  const k = el('keyInput').value.trim();
  if (!k) return;
  try {
    const r = await fetch(`${API}/api/admin/licenses`, { headers: { 'X-Admin-Key': k } });
    if (r.ok) {
      adminKey = k;
      localStorage.setItem('hm_admin_key', k);
      el('login').style.display = 'none';
      el('app').style.display = 'block';
      loadData();
    } else {
      el('loginErr').style.display = 'block';
    }
  } catch {
    el('loginErr').style.display = 'block';
  }
}
function doLogout() { localStorage.removeItem('hm_admin_key'); location.reload(); }

// ─── DATA ───
async function loadData() {
  try {
    const [lics, custs] = await Promise.all([
      apiFetch('/api/admin/licenses').then(r => r.json()),
      apiFetch('/api/admin/customers').then(r => r.json()),
    ]);
    allLicenses = lics;
    const active  = lics.filter(l => l.status === 'active');
    const revoked = lics.filter(l => l.status !== 'active');

    el('sTotal').textContent     = lics.length;
    el('sActive').textContent    = active.length;
    el('sRevoked').textContent   = revoked.length;
    el('sCustomers').textContent = custs.length;
    el('lastUpdated').textContent = new Date().toLocaleTimeString('es');
    el('activeCount').textContent  = active.length;
    el('revokedCount').textContent = revoked.length;

    // Analytics
    const analytics = computeAnalytics(lics);
    renderRevenue(analytics);
    renderPlanDistribution(analytics);

    // Populate year dropdown
    populateYearFilter(lics);
    // Store analytics for report tab
    window._analytics = analytics;
    window._allLicenses = lics;
    renderReportsWithFilters();

    renderActiveTable(applyFilters(active));
    renderRevokedTable(revoked);
  } catch {
    el('tableLoading').textContent = 'Error al cargar datos.';
  }
}

// ─── ANALYTICS ───
function priceOf(l) { return PLAN_PRICES[l.plan] || 0; }
function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('es'); }
function fmtPct(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; }

function computeAnalytics(licenses) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const active  = licenses.filter(l => l.status === 'active');
  const revoked = licenses.filter(l => l.status !== 'active');

  const revenueTotal  = licenses.reduce((s, l) => s + priceOf(l), 0);
  const revenueActive = active.reduce((s, l) => s + priceOf(l), 0);
  const thisMonth = licenses.filter(l => new Date(l.created_at) >= monthStart);
  const prevMonth = licenses.filter(l => {
    const d = new Date(l.created_at);
    return d >= prevMonthStart && d < monthStart;
  });
  const revenueMonth = thisMonth.reduce((s, l) => s + priceOf(l), 0);
  const revenuePrevMonth = prevMonth.reduce((s, l) => s + priceOf(l), 0);
  const arpu = licenses.length ? revenueTotal / licenses.length : 0;

  const byPlan = {};
  for (const key of PLAN_KEYS) {
    const items = licenses.filter(l => l.plan === key);
    const itemsActive = items.filter(l => l.status === 'active');
    byPlan[key] = {
      total: items.length,
      active: itemsActive.length,
      revenue: items.reduce((s, l) => s + priceOf(l), 0),
      pct: licenses.length ? (items.length / licenses.length) * 100 : 0,
    };
  }

  // 6 months trend
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: d.toLocaleDateString('es', { month: 'short' }),
      count: 0,
      revenue: 0,
    });
  }
  for (const l of licenses) {
    if (!l.created_at) continue;
    const d = new Date(l.created_at);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const m = months.find(x => x.key === k);
    if (m) { m.count += 1; m.revenue += priceOf(l); }
  }

  // Business health
  const licensesWithDevices = active.filter(l => (l.activations || []).some(a => a.status === 'active')).length;
  const activationRate = active.length ? (licensesWithDevices / active.length) * 100 : 0;
  const churnRate = licenses.length ? (revoked.length / licenses.length) * 100 : 0;
  const maxDevices  = active.reduce((s, l) => s + (l.max_devices || 1), 0);
  const usedDevices = active.reduce((s, l) => s + (l.activations || []).filter(a => a.status === 'active').length, 0);
  const deviceUtilization = maxDevices ? (usedDevices / maxDevices) * 100 : 0;
  const notActivated = active.length - licensesWithDevices;

  // Top customers by revenue
  const byCust = new Map();
  for (const l of licenses) {
    const c = l.customer;
    if (!c || !c.id) continue;
    if (!byCust.has(c.id)) {
      byCust.set(c.id, {
        id: c.id,
        name: c.name || c.email || '—',
        email: c.email || '—',
        count: 0,
        active: 0,
        revenue: 0,
      });
    }
    const row = byCust.get(c.id);
    row.count += 1;
    row.revenue += priceOf(l);
    if (l.status === 'active') row.active += 1;
  }
  const topCustomers = [...byCust.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return {
    counts: { total: licenses.length, active: active.length, revoked: revoked.length },
    revenue: { total: revenueTotal, active: revenueActive, month: revenueMonth, prevMonth: revenuePrevMonth, arpu },
    monthCounts: { current: thisMonth.length, prev: prevMonth.length },
    byPlan, months,
    health: { activationRate, churnRate, deviceUtilization, notActivated, licensesWithDevices, usedDevices, maxDevices },
    topCustomers,
  };
}

// ─── RENDER ANALYTICS ───
function renderRevenue(a) {
  el('rTotal').textContent  = fmtMoney(a.revenue.total);
  el('rActive').textContent = fmtMoney(a.revenue.active);
  el('rArpu').textContent   = fmtMoney(a.revenue.arpu);
  el('rMonth').textContent  = fmtMoney(a.revenue.month);

  el('rTotalSub').textContent  = a.counts.total + ' licencias emitidas';
  el('rActiveSub').textContent = a.counts.active + ' licencias en uso';
  const diff = a.revenue.month - a.revenue.prevMonth;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  const abs = Math.abs(diff);
  el('rMonthSub').textContent =
    a.monthCounts.current + ' este mes · ' + arrow + ' ' + sign + fmtMoney(abs) + ' vs mes anterior';
}

function renderPlanDistribution(a) {
  const grid = el('planGrid');
  grid.innerHTML = '';
  for (const key of PLAN_KEYS) {
    const p = a.byPlan[key];
    const empty = p.total === 0 ? ' plan-card--empty' : '';
    grid.insertAdjacentHTML('beforeend',
      '<div class="plan-card' + empty + '">' +
        '<div class="plan-hd">' +
          '<div class="plan-name">' + esc(PLAN_LABELS[key]) + '</div>' +
          '<div class="plan-price">' + fmtMoney(PLAN_PRICES[key]) + ' / licencia</div>' +
        '</div>' +
        '<div class="plan-count-row">' +
          '<div class="plan-count">' + p.total + '</div>' +
          '<div class="plan-count-lbl">licencias · ' + p.active + ' activas</div>' +
        '</div>' +
        '<div class="plan-bar"><div class="plan-bar-fill" style="width:' + p.pct.toFixed(1) + '%"></div></div>' +
        '<div class="plan-foot">' +
          '<span>' + fmtPct(p.pct) + ' del total</span>' +
          '<span class="plan-foot-rev">' + fmtMoney(p.revenue) + '</span>' +
        '</div>' +
      '</div>'
    );
  }
}

function renderGrowthChart(months) {
  const wrap = el('growthChart');
  const maxCount = Math.max(1, ...months.map(m => m.count));
  let html = '<div class="gc-bars">';
  for (const m of months) {
    const h = (m.count / maxCount) * 100;
    html +=
      '<div class="gc-bar-col">' +
        '<div class="gc-bar-wrap">' +
          (m.count > 0 ? '<div class="gc-bar-count">' + m.count + '</div>' : '') +
          '<div class="gc-bar" style="height:' + h + '%"></div>' +
        '</div>' +
        '<div class="gc-bar-label">' + esc(m.label) + '</div>' +
        '<div class="gc-bar-rev">' + (m.revenue > 0 ? fmtMoney(m.revenue) : '—') + '</div>' +
      '</div>';
  }
  html += '</div>';
  wrap.innerHTML = html;
  const totalCount = months.reduce((s, m) => s + m.count, 0);
  const totalRev = months.reduce((s, m) => s + m.revenue, 0);
  el('growthTotal').textContent = totalCount + ' licencias · ' + fmtMoney(totalRev);
}

function renderHealth(a) {
  const list = el('healthList');
  const items = [
    {
      lbl: 'Tasa de activación',
      val: fmtPct(a.health.activationRate),
      sub: a.health.licensesWithDevices + ' de ' + a.counts.active + ' activas tienen dispositivos',
      tone: a.counts.active === 0 ? 'neutral' : a.health.activationRate >= 60 ? 'good' : 'warn',
    },
    {
      lbl: 'Utilización dispositivos',
      val: fmtPct(a.health.deviceUtilization),
      sub: a.health.usedDevices + ' / ' + a.health.maxDevices + ' slots ocupados',
      tone: 'neutral',
    },
    {
      lbl: 'Tasa de revocación',
      val: fmtPct(a.health.churnRate),
      sub: a.counts.revoked + ' revocadas de ' + a.counts.total + ' totales',
      tone: a.counts.total === 0 ? 'neutral' : a.health.churnRate <= 5 ? 'good' : a.health.churnRate <= 15 ? 'warn' : 'bad',
    },
    {
      lbl: 'Sin activar',
      val: String(a.health.notActivated),
      sub: 'Licencias activas sin dispositivo asignado',
      tone: a.health.notActivated === 0 ? 'good' : 'warn',
    },
  ];
  list.innerHTML = items.map(i =>
    '<div class="health-row">' +
      '<div class="health-lbl">' + esc(i.lbl) + '</div>' +
      '<div class="health-val health-val--' + i.tone + '">' + esc(i.val) + '</div>' +
      '<div class="health-sub">' + esc(i.sub) + '</div>' +
    '</div>'
  ).join('');
}

function renderTopCustomers(top) {
  const wrap = el('topCustomers');
  if (!top.length) {
    wrap.innerHTML = '<div class="table-empty">Sin datos aún</div>';
    return;
  }
  wrap.innerHTML =
    '<table class="tc-table">' +
      '<thead><tr><th>#</th><th>Cliente</th><th>Licencias</th><th>Activas</th><th>Ingreso</th></tr></thead>' +
      '<tbody>' +
      top.map((c, i) =>
        '<tr>' +
          '<td class="td-id">' + (i + 1) + '</td>' +
          '<td><div style="font-weight:600">' + esc(c.name) + '</div><div class="email-cell">' + esc(c.email) + '</div></td>' +
          '<td>' + c.count + '</td>' +
          '<td><span class="tc-active">' + c.active + '</span></td>' +
          '<td class="tc-rev">' + fmtMoney(c.revenue) + '</td>' +
        '</tr>'
      ).join('') +
      '</tbody>' +
    '</table>';
}

// ─── REPORT FILTERS ───
function populateYearFilter(licenses) {
  const sel = el('reportYear');
  const years = new Set();
  for (const l of licenses) {
    if (l.created_at) {
      const y = new Date(l.created_at).getFullYear();
      if (!isNaN(y)) years.add(y);
    }
  }
  const sorted = [...years].sort((a, b) => b - a);
  // Keep "Todos los anos" + add years
  sel.innerHTML = '<option value="">Todos los anos</option>' +
    sorted.map(y => '<option value="' + y + '">' + y + '</option>').join('');
}

function renderReportsWithFilters() {
  const year = el('reportYear').value;
  const months = parseInt(el('reportMonths').value) || 0;
  const all = window._allLicenses || [];

  // Filter by year
  let filtered = all;
  if (year) {
    const y = parseInt(year);
    filtered = all.filter(l => {
      if (!l.created_at) return false;
      return new Date(l.created_at).getFullYear() === y;
    });
  }

  // Recompute analytics on filtered set
  const a = computeAnalytics(filtered);

  // Filter months array by selected period
  let displayMonths = a.months;
  if (months > 0) {
    displayMonths = a.months.slice(-months);
  }

  renderGrowthChart(displayMonths);
  renderHealth(a);
  renderTopCustomers(a.topCustomers);

  // Update growth total hint
  const totalInPeriod = displayMonths.reduce((s, m) => s + m.count, 0);
  el('growthTotal').textContent = totalInPeriod + ' licencias';
}

// ─── FILTERS + EXPORT ───
function applyFilters(list) {
  const q = filters.q.trim().toLowerCase();
  const plan = filters.plan;
  return list.filter(l => {
    if (plan && l.plan !== plan) return false;
    if (q) {
      const hay = [l.customer?.name, l.customer?.email, l.key_last4, '#' + l.id, String(l.id)]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function refilterActive() {
  const active = allLicenses.filter(l => l.status === 'active');
  const filtered = applyFilters(active);
  renderActiveTable(filtered);
  el('activeCount').textContent = filtered.length + (active.length !== filtered.length ? ' / ' + active.length : '');
}

function exportCSV() {
  if (!allLicenses.length) { showToast('No hay datos para exportar'); return; }
  const headers = ['ID', 'Cliente', 'Email', 'Plan', 'Precio USD', 'Estado', 'Dispositivos activos', 'Max dispositivos', 'Creada', 'Revocada'];
  const rows = allLicenses.map(l => {
    const acts = (l.activations || []).filter(a => a.status === 'active').length;
    return [
      l.id,
      l.customer?.name || '',
      l.customer?.email || '',
      l.plan,
      PLAN_PRICES[l.plan] || 0,
      l.status,
      acts,
      l.max_devices,
      l.created_at || '',
      l.revoked_at || '',
    ];
  });
  const csv = [headers, ...rows]
    .map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'helpmeet-licencias-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('CSV descargado');
}

function fmtDate(dt) {
  if (!dt) return '\u2014';
  return new Date(dt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
}
function fmtDatetime(dt) {
  if (!dt) return '\u2014';
  const d = new Date(dt);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function renderActivationDetail(acts, colspan) {
  if (!acts || !acts.length) return '<span class="no-acts">Sin activaciones registradas</span>';
  let h = '<table class="act-table"><thead><tr><th>Dispositivo</th><th>SO</th><th>Version</th><th>Estado</th><th>Activado</th><th>Último</th></tr></thead><tbody>';
  for (const a of acts) {
    h += `<tr>
      <td>${esc(a.device_name || '\u2014')}</td>
      <td>${esc(a.os || '\u2014')}</td>
      <td class="act-ver">${esc(a.app_version || '\u2014')}</td>
      <td class="${a.status === 'active' ? 'act-status-on' : 'act-status-off'}">${esc(a.status)}</td>
      <td>${fmtDate(a.first_activated_at)}</td>
      <td>${fmtDatetime(a.last_seen_at)}</td>
    </tr>`;
  }
  h += '</tbody></table>';
  return h;
}

function renderActiveTable(licenses) {
  el('tableLoading').hidden = true;
  // Clear previous empty-state banners so they don't stack across refreshes
  el('activeWrap').querySelectorAll('.table-empty').forEach(n => n.remove());
  el('licTable').hidden = !licenses.length;
  if (!licenses.length) {
    const hasFilter = filters.q || filters.plan;
    const msg = hasFilter ? 'Ninguna licencia coincide con los filtros' : 'No hay licencias activas';
    el('activeWrap').insertAdjacentHTML('beforeend', '<div class="table-empty">' + esc(msg) + '</div>');
    return;
  }
  const rows = el('licBody');
  rows.innerHTML = '';
  for (const l of licenses) {
    const acts = l.activations || [];
    const activeActs = acts.filter(a => a.status === 'active');
    const devHtml = activeActs.length
      ? `<span class="dev-badge"><span class="dev-dot dev-dot--on"></span><span class="dev-count">${activeActs.length}/${l.max_devices}</span></span>`
      : `<span class="dev-badge"><span class="dev-dot"></span><span class="dev-count">0/${l.max_devices}</span></span>`;
    const showExpand = acts.length > 0;
    const expandBtn = showExpand ? `<button class="dev-expand" data-lic="${l.id}">+</button>` : '';

    const customerEmail = l.customer?.email || '\u2014';
    const customerName = l.customer?.name || '\u2014';
    const emailSentKey = `lic_${l.id}`;
    const mailHtml = emailStatus[emailSentKey]
      ? '<span class="mail-ok">\u2713 Enviado</span>'
      : '<span class="mail-no">\u2014</span>';

    const STATUS_LABELS = { active: 'activa', revoked: 'revocada' };
    const statusLabel = STATUS_LABELS[l.status] || l.status;
    const statusBadgeClass = l.status === 'active' ? 'badge-active' : 'badge-revoked';
    const hasActivation = activeActs.length > 0;
    const pendingBadge = l.status === 'active' && !hasActivation
      ? ' <span class="badge badge-pending">pendiente</span>'
      : '';

    // Video hours for Personal plan
    const isPersonal = l.plan === 'personal';
    const videoUsed = l.video_seconds_used || 0;
    const videoHours = (videoUsed / 3600).toFixed(1);
    const videoLimit = 10;
    const videoPct = Math.min(100, (videoUsed / (videoLimit * 3600)) * 100);
    const videoHtml = isPersonal
      ? `<span class="usage-cell" title="${videoHours}h de ${videoLimit}h usadas">
          <span class="usage-bar"><span class="usage-fill" style="width:${videoPct}%"></span></span>
          <span class="usage-num">${videoHours}h</span>
        </span>`
      : '<span class="td-faint">—</span>';

    rows.insertAdjacentHTML('beforeend', `<tr>
      <td class="td-id">#${l.id}</td>
      <td><div style="font-weight:600">${esc(customerName)}</div><div class="email-cell">${esc(customerEmail)}</div></td>
      <td class="mono" title="Últimos 4: ${esc(l.key_last4)}">\u2022\u2022\u2022\u2022-${esc(l.key_last4)}</td>
      <td><span class="td-plan">${esc(l.plan)}</span></td>
      <td><span class="badge ${statusBadgeClass}">${statusLabel}</span>${pendingBadge}</td>
      <td>${videoHtml}</td>
      <td>${devHtml}${expandBtn}</td>
      <td>${mailHtml}</td>
      <td class="td-date">${fmtDate(l.created_at)}</td>
      <td><div class="actions">
        <button class="abtn abtn-send" data-lic="${l.id}" data-email="${esc(customerEmail)}">Enviar key</button>
        <button class="abtn abtn-reset" data-lic="${l.id}">Reset disp.</button>
        <button class="abtn abtn-rev" data-lic="${l.id}">Revocar</button>
        <button class="abtn abtn-hist" data-lic="${l.id}">Historial</button>
      </div></td>
    </tr>`);

    if (showExpand) {
      rows.insertAdjacentHTML('beforeend', `<tr class="detail-row" id="detail-${l.id}" hidden><td colspan="10"><div class="detail-inner">${renderActivationDetail(acts, 10)}</div></td></tr>`);
    }
    // Event history row
    rows.insertAdjacentHTML('beforeend', `<tr class="event-row" id="events-${l.id}" hidden><td colspan="10"><div class="detail-inner" id="eventsInner-${l.id}">Cargando historial...</div></td></tr>`);
  }

  // Event delegation — attach only once to avoid duplicate handlers on refresh
  if (rows.dataset.wired === '1') return;
  rows.dataset.wired = '1';
  rows.addEventListener('click', async (e) => {
    const btn = e.target.closest('.abtn, .dev-expand');
    if (!btn) return;
    const licId = parseInt(btn.dataset.lic);

    if (btn.classList.contains('dev-expand')) {
      const row = el('detail-' + licId);
      row.hidden = !row.hidden;
      btn.textContent = row.hidden ? '+' : '\u2212';
      return;
    }

    if (btn.classList.contains('abtn-send')) {
      const email = btn.dataset.email;
      confirmAction(
        `Enviar key a ${esc(email)}`,
        `Se generara una nueva Product Key y se enviara por email a ${esc(email)}.`,
        async () => {
          try {
            const r = await apiFetch(`/api/admin/licenses/${licId}/generate-key`, { method: 'POST' });
            const d = await r.json();
            if (d.ok) {
              emailStatus[`lic_${licId}`] = true;
              saveEmailStatus();
              addLog('ok', `Key enviada a ${email}`);
              showToast('Key generada y enviada');
              loadData();
            } else {
              showToast(d.error || 'Error al generar key');
            }
          } catch (ex) {
            showToast('Error de conexion');
          }
        }
      );
      return;
    }

    if (btn.classList.contains('abtn-reset')) {
      confirmAction('Resetear dispositivos', 'Esto desactivará todos los dispositivos de esta licencia.', async () => {
        try {
          await apiFetch(`/api/admin/licenses/${licId}/reset-devices`, { method: 'POST' });
          addLog('ok', `Dispositivos reseteados para licencia #${licId}`);
          showToast('Dispositivos reseteados');
          loadData();
        } catch {
          showToast('Error al resetear dispositivos');
        }
      });
      return;
    }

    if (btn.classList.contains('abtn-rev')) {
      confirmAction('Revocar licencia', 'La licencia quedará inutilizable. Esta acción no se puede deshacer.', async () => {
        try {
          await apiFetch(`/api/admin/licenses/${licId}/revoke`, { method: 'POST' });
          addLog('err', `Licencia #${licId} revocada`);
          showToast('Licencia revocada');
          loadData();
        } catch {
          showToast('Error al revocar');
        }
      });
    }

    if (btn.classList.contains('abtn-reactivate')) {
      const plan = btn.dataset.plan;
      const email = btn.dataset.email;
      el('reactivateDesc').textContent = `Reactivar licencia #${licId} — ${email}`;
      el('reactivatePlan').value = plan;
      el('reactivateErr').style.display = 'none';
      window._reactivateLicId = licId;
      el('reactivateDialog').showModal();
      return;
    }

    if (btn.classList.contains('abtn-hist')) {
      const row = el('events-' + licId);
      if (row.hidden) {
        row.hidden = false;
        loadLicenseEvents(licId);
      } else {
        row.hidden = true;
      }
      return;
    }
  });
}

function renderRevokedTable(licenses) {
  el('revokedBody').innerHTML = '';
  if (!licenses.length) {
    el('revokedBody').insertAdjacentHTML('beforeend', '<tr><td colspan="7" class="table-empty">No hay licencias revocadas</td></tr>');
    return;
  }
  for (const l of licenses) {
    const acts = l.activations || [];
    const activeActs = acts.filter(a => a.status === 'active');
    const devHtml = activeActs.length
      ? `<span class="dev-badge"><span class="dev-dot"></span><span class="dev-count">${activeActs.length}</span></span>`
      : `<span class="dev-badge"><span class="dev-dot"></span><span class="dev-count">0</span></span>`;
    el('revokedBody').insertAdjacentHTML('beforeend', `<tr>
      <td class="td-id">#${l.id}</td>
      <td>${esc(l.customer?.name || l.customer?.email || '\u2014')}</td>
      <td class="mono">\u2022\u2022\u2022\u2022-${esc(l.key_last4)}</td>
      <td><span class="td-plan">${esc(l.plan)}</span></td>
      <td><span class="badge badge-revoked">revocada</span></td>
      <td>${devHtml}</td>
      <td class="td-date">${fmtDate(l.revoked_at)}</td>
      <td><div class="actions">
        <button class="abtn abtn-reactivate" data-lic="${l.id}" data-plan="${esc(l.plan)}" data-email="${esc(l.customer?.email || l.customer?.name || '\u2014')}">Reactivar</button>
        <button class="abtn abtn-hist" data-lic="${l.id}">Historial</button>
      </div></td>
    </tr>
    <tr class="event-row" id="events-${l.id}" hidden><td colspan="8"><div class="detail-inner" id="eventsInner-${l.id}">Cargando historial...</div></td></tr>`);
  }
  // Wire revoked table delegation once
  if (el('revokedBody').dataset.wired !== '1') {
    el('revokedBody').dataset.wired = '1';
    el('revokedBody').addEventListener('click', (e) => {
      const btn = e.target.closest('.abtn');
      if (!btn) return;
      const licId = parseInt(btn.dataset.lic);
      if (btn.classList.contains('abtn-reactivate')) {
        const plan = btn.dataset.plan;
        const email = btn.dataset.email;
        el('reactivateDesc').textContent = `Reactivar licencia #${licId} — ${email}`;
        el('reactivatePlan').value = plan;
        el('reactivateErr').style.display = 'none';
        window._reactivateLicId = licId;
        el('reactivateDialog').showModal();
      }
      if (btn.classList.contains('abtn-hist')) {
        const row = el('events-' + licId);
        if (row.hidden) { row.hidden = false; loadLicenseEvents(licId); }
        else { row.hidden = true; }
      }
    });
  }
}

// ─── LICENSE EVENT HISTORY ───
const LABELS = {
  created: 'Creada',
  revoked: 'Revocada',
  reactivated: 'Reactivada',
  key_generated: 'Key regenerada',
  devices_reset: 'Dispositivos reseteados',
  gumroad_purchase: 'Compra Gumroad',
  validated: 'Validada',
  activated: 'Activada',
};

async function loadLicenseEvents(licId) {
  const inner = el('eventsInner-' + licId);
  if (!inner) return;
  try {
    const r = await apiFetch(`/api/admin/licenses/${licId}/events`);
    const events = await r.json();
    if (!events || !events.length) {
      inner.innerHTML = '<span class="no-events">Sin eventos registrados</span>';
      return;
    }
    let h = '<table class="act-table"><thead><tr><th>Evento</th><th>Detalle</th><th>Fecha</th></tr></thead><tbody>';
    for (const e of events) {
      const label = LABELS[e.event_type] || e.event_type;
      let detail = '';
      if (e.metadata && e.metadata.old_plan && e.metadata.new_plan) {
        detail = `${e.metadata.old_plan} → ${e.metadata.new_plan}`;
      }
      h += `<tr>
        <td><span class="event-badge event-${e.event_type}">${label}</span></td>
        <td>${esc(detail || '\u2014')}</td>
        <td class="td-date">${fmtDate(e.created_at)}</td>
      </tr>`;
    }
    h += '</tbody></table>';
    inner.innerHTML = h;
  } catch {
    inner.innerHTML = '<span class="no-events">Error al cargar historial</span>';
  }
}

// ─── REACTIVATE MODAL ───
async function doReactivate() {
  const licId = window._reactivateLicId;
  const plan = el('reactivatePlan').value;
  el('reactivateErr').style.display = 'none';
  el('reactivateBtn').disabled = true;
  try {
    const r = await apiFetch(`/api/admin/licenses/${licId}/reactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const d = await r.json();
    if (d.ok) {
      el('reactivateDialog').close();
      addLog('ok', `Licencia #${licId} reactivada como ${plan}`);
      showToast('Licencia reactivada');
      loadData();
    } else {
      el('reactivateErr').textContent = d.detail || 'Error al reactivar';
      el('reactivateErr').style.display = 'block';
    }
  } catch {
    el('reactivateErr').textContent = 'Error de conexion';
    el('reactivateErr').style.display = 'block';
  } finally {
    el('reactivateBtn').disabled = false;
  }
}

// ─── CUSTOMERS VIEW ───
async function renderCustomers() {
  const body = el('customersBody');
  if (!body || body.dataset.loaded === '1') return;
  body.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando...</td></tr>';
  try {
    const r = await apiFetch('/api/admin/customers');
    const customers = await r.json();
    el('customersCount').textContent = customers.length;
    if (!customers.length) {
      body.innerHTML = '<tr><td colspan="7" class="table-empty">No hay clientes</td></tr>';
      return;
    }
    body.innerHTML = '';
    for (const c of customers) {
      const licencias = c.licenses || [];
      const licCount = licencias.length;
      const activeLic = licencias.find(l => l.status === 'active');
      const plan = activeLic ? activeLic.plan : (licencias.length ? licencias[0].plan : '\u2014');
      const status = activeLic ? 'activa' : (licencias.length ? 'revocada' : '\u2014');
      const statusCls = activeLic ? 'badge-active' : 'badge-revoked';

      let licTxt = licCount === 0 ? '\u2014' : `${licCount} licencia${licCount !== 1 ? 's' : ''}`;
      if (licCount > 0) {
        licTxt += ` <span class="badge-count" style="font-size:10px;cursor:pointer" onclick="event.stopPropagation();toggleCustomerLicenses(${c.id})">ver</span>`;
      }

      body.insertAdjacentHTML('beforeend', `<tr>
        <td class="td-id">#${c.id}</td>
        <td style="font-weight:600">${esc(c.name || '\u2014')}</td>
        <td class="mono" style="font-size:12px">${esc(c.email)}</td>
        <td>${licTxt}</td>
        <td><span class="td-plan">${esc(plan)}</span></td>
        <td><span class="badge ${statusCls}">${status}</span></td>
        <td class="td-date">${fmtDate(c.created_at)}</td>
      </tr>
      <tr id="cust-lic-${c.id}" hidden><td colspan="7"><div class="detail-inner">${
        licencias.map(l => `
          <div style="display:flex;gap:16px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span class="badge ${l.status === 'active' ? 'badge-active' : 'badge-revoked'}">${l.status === 'active' ? 'activa' : 'revocada'}</span>
            <span class="td-plan">${esc(l.plan)}</span>
            <code class="mono" style="font-size:11px">${esc(l.key_last4 ? '••••-' + l.key_last4 : '\u2014')}</code>
            <span class="td-date">${fmtDate(l.created_at)}</span>
          </div>
        `).join('')
      }</div></td></tr>`);
    }
    body.dataset.loaded = '1';
  } catch {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">Error al cargar clientes</td></tr>';
  }
}

function toggleCustomerLicenses(id) {
  const row = el('cust-lic-' + id);
  if (row) row.hidden = !row.hidden;
}

// ─── CONFIRM MODAL ───
function confirmAction(title, desc, cb) {
  el('confirmTitle').textContent = title;
  el('confirmDesc').textContent = desc;
  confirmCallback = cb;
  el('confirmDialog').showModal();
}

// ─── CREATE LICENSE MODAL ───
async function doCreateLicense() {
  const email = el('createEmail').value.trim();
  const name = el('createName').value.trim();
  const plan = el('createPlan').value;
  if (!email) { showToast('El email es obligatorio'); return; }

  el('createErr').style.display = 'none';
  el('keyResult').style.display = 'none';
  el('createBtn').disabled = true;

  try {
    const custRes = await apiFetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const customer = await custRes.json();

    const licRes = await apiFetch('/api/admin/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, plan }),
    });
    const lic = await licRes.json();
    if (lic.license_key) {
      el('keyValue').textContent = lic.license_key;
      el('keyResult').style.display = 'block';
      emailStatus[`lic_${lic.id}`] = lic.email_sent;
      saveEmailStatus();
      addLog('ok', `Licencia creada para ${email} (${plan}) — ${lic.email_sent ? 'correo enviado' : 'correo pendiente'}`);
      loadData();
      // Cerrar modal automaticamente tras 6 segundos
      setTimeout(() => {
        if (el('createDialog').open) el('createDialog').close();
      }, 6000);
    } else {
      el('createErr').textContent = lic.detail || 'Error al crear';
      el('createErr').style.display = 'block';
    }
  } catch {
    el('createErr').textContent = 'Error de conexion';
    el('createErr').style.display = 'block';
  } finally {
    el('createBtn').disabled = false;
  }
}

function resetCreateForm() {
  el('createEmail').value = '';
  el('createName').value = '';
  el('createPlan').value = 'personal';
  el('keyResult').style.display = 'none';
  el('createErr').style.display = 'none';
}

async function copyKey() {
  const key = el('keyValue').textContent;
  try {
    await navigator.clipboard.writeText(key);
    showToast('Key copiada al portapapeles');
  } catch {
    showToast('No se pudo copiar');
  }
}

// ─── INIT ───
function init() {
  // Login
  el('loginBtn').addEventListener('click', doLogin);
  el('keyInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  // Topbar
  el('refreshBtn').addEventListener('click', loadData);
  el('logoutBtn').addEventListener('click', doLogout);
  el('clearLogBtn').addEventListener('click', clearLogs);

  // Create modal
  el('newLicBtn').addEventListener('click', () => {
    resetCreateForm();
    el('createDialog').showModal();
  });
  el('createBtn').addEventListener('click', doCreateLicense);
  el('closeCreateBtn').addEventListener('click', () => el('createDialog').close());
  el('copyKeyBtn').addEventListener('click', copyKey);

  // Confirm modal
  el('confirmBtn').addEventListener('click', async () => {
    el('confirmDialog').close();
    if (confirmCallback) await confirmCallback();
  });
  el('cancelConfirmBtn').addEventListener('click', () => el('confirmDialog').close());

  // Reactivate modal
  el('reactivateBtn').addEventListener('click', doReactivate);
  el('closeReactivateBtn').addEventListener('click', () => el('reactivateDialog').close());

  // Revoked toggle
  el('toggleRevokedBtn').addEventListener('click', () => {
    revokedVisible = !revokedVisible;
    el('revokedSection').hidden = !revokedVisible;
    el('toggleRevokedBtn').textContent = revokedVisible ? 'Ocultar \u25B4' : 'Mostrar \u25BE';
  });

  // Filters + export
  let searchTimer;
  el('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filters.q = e.target.value; refilterActive(); }, 120);
  });
  el('planFilter').addEventListener('change', e => {
    filters.plan = e.target.value;
    refilterActive();
  });
  el('exportBtn').addEventListener('click', exportCSV);

  // Auto-login
  const savedKey = localStorage.getItem('hm_admin_key');
  if (savedKey) {
    el('keyInput').value = savedKey;
    doLogin();
  }

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = 'tab-' + btn.dataset.tab;
      const panel = document.getElementById(target);
      if (panel) {
        panel.classList.add('active');
        if (btn.dataset.tab === 'customers') renderCustomers();
      }
    });
  });

  // Report filters
  el('reportYear').addEventListener('change', () => renderReportsWithFilters());
  el('reportMonths').addEventListener('change', () => renderReportsWithFilters());

  // ── THEME TOGGLE ──
  const themeToggle = el('themeToggle');
  const themeIcon = el('themeIcon');
  if (themeToggle) {
    const updateThemeUI = () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      if (themeIcon) {
        themeIcon.innerHTML = isDark
          ? '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
          : '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
      }
    };
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.body.removeAttribute('data-theme');
        try { localStorage.setItem('hm_admin_theme', 'light'); } catch(e) {}
      } else {
        document.body.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('hm_admin_theme', 'dark'); } catch(e) {}
      }
      updateThemeUI();
    });
    updateThemeUI();
  }

  // ── PASSWORD EYE TOGGLE ──
  const pwdInput = el('keyInput');
  const pwdToggle = el('pwdToggle');
  const pwdEye = el('pwdEye');
  if (pwdToggle && pwdInput) {
    pwdToggle.addEventListener('click', () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      if (pwdEye) {
        pwdEye.innerHTML = isPassword
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
