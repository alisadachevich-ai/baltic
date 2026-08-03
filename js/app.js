/* Состояние приложения и связка UI: загрузка файлов, фильтры,
   KPI, графики, таблица, правила категорий, localStorage. */

const LS_TX = 'baltic-audit-transactions-v1';
const LS_RULES = 'baltic-audit-rules-v1';
const LS_THEME = 'baltic-audit-theme';

const state = {
  transactions: [],          // {date, month, desc, amount, currency, cat, merchant, source}
  userRules: {},             // ключ мерчанта → catId (переопределения пользователя)
  filters: { month: 'all', cat: 'all', q: '' },
  colorMap: {},              // catId → css-цвет; назначается один раз на датасет
  seriesOrder: [],           // топ-категории в фиксированном порядке для графиков
  rowsShown: 100,
};

/* ── Утилиты ── */
const $ = id => document.getElementById(id);
const merchantKey = m => String(m || '').toUpperCase().trim();

function fmtDate(d) {
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
}

/* ── Тема ── */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(LS_THEME, theme);
  if (state.transactions.length) render();
}
function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  const preferred = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = preferred;
}

/* ── Категоризация с учётом правил пользователя ── */
function applyCategories(txs) {
  for (const t of txs) {
    const auto = categorize(t.desc, t.amount);
    t.merchant = auto.merchant;
    const override = state.userRules[merchantKey(t.merchant)];
    t.cat = override || auto.cat;
  }
}

/* ── Сохранение ── */
function persist() {
  try {
    localStorage.setItem(LS_TX, JSON.stringify(state.transactions.map(t => ({
      d: t.date.getTime(), s: t.desc, a: t.amount, c: t.currency, f: t.source,
    }))));
  } catch (e) { console.warn('localStorage переполнен, данные не сохранены', e); }
  localStorage.setItem(LS_RULES, JSON.stringify(state.userRules));
}

function restore() {
  try {
    state.userRules = JSON.parse(localStorage.getItem(LS_RULES) || '{}');
    const raw = JSON.parse(localStorage.getItem(LS_TX) || '[]');
    state.transactions = raw.map(r => {
      const date = new Date(r.d);
      return {
        date,
        month: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
        desc: r.s, amount: r.a, currency: r.c, source: r.f,
      };
    });
    applyCategories(state.transactions);
  } catch (e) { state.transactions = []; state.userRules = {}; }
}

/* ── Приём файлов ── */
let filesProcessing = false;

function setUploadStatus(msg, busy) {
  for (const id of ['upload-status', 'upload-status-2']) {
    const el = $(id);
    if (!el) continue;
    el.textContent = msg;
    el.classList.toggle('status-busy', !!busy);
  }
}

function setUploadInputsDisabled(disabled) {
  for (const id of ['file-input', 'file-input-more', 'btn-demo']) {
    const el = $(id);
    if (el) el.disabled = disabled;
  }
}

function withTimeout(promise, ms, fileName) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(
      `${fileName}: не ответило за ${Math.round(ms / 1000)} сек — файл слишком большой, повреждён, или браузер завис на обработке. Попробуй другой файл или перезагрузи страницу.`
    )), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function handleFiles(fileList) {
  if (filesProcessing) { alert('Уже обрабатываю предыдущий файл — подожди, пожалуйста.'); return; }
  const files = [...fileList];
  if (!files.length) return;

  filesProcessing = true;
  setUploadInputsDisabled(true);

  const errors = [];
  let added = 0, duplicates = 0;
  const seen = new Set(state.transactions.map(t => t.date.getTime() + '|' + t.amount + '|' + t.desc));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = files.length > 1 ? `(${i + 1}/${files.length}) ` : '';
    try {
      const buf = await file.arrayBuffer();
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      let txs;
      if (isPdf) {
        setUploadStatus(`${progress}⏳ Читаю ${file.name}…`, true);
        try {
          txs = await withTimeout(parseStatementPdfLocally(buf, file.name), 30000, file.name);
        } catch (localErr) {
          if (!localStorage.getItem(LS_API_KEY)) throw localErr;
          setUploadStatus(`${progress}⏳ Не разобралось локально, пробую через Claude…`, true);
          txs = await withTimeout(parseStatementPdfWithClaude(buf, file.name), 60000, file.name);
        }
      } else {
        setUploadStatus(`${progress}⏳ Читаю ${file.name}…`, true);
        txs = parseStatement(buf, file.name);
      }
      for (const t of txs) {
        const key = t.date.getTime() + '|' + t.amount + '|' + t.desc;
        if (seen.has(key)) { duplicates++; continue; }   // дедупликация при повторной загрузке
        seen.add(key);
        state.transactions.push(t);
        added++;
      }
    } catch (e) {
      errors.push(`${file.name}: ${e.message}`);
    }
  }

  filesProcessing = false;
  setUploadInputsDisabled(false);

  const parts = [];
  if (added) parts.push(`добавлено новых: ${added}`);
  if (duplicates) parts.push(`пропущено дублей: ${duplicates}`);
  setUploadStatus(parts.length ? '✅ ' + parts.join(', ') : (errors.length ? '' : 'Ничего нового не найдено — похоже, всё уже было загружено'), false);

  if (errors.length) alert('Проблемы при чтении:\n' + errors.join('\n'));
  if (added) {
    applyCategories(state.transactions);
    state.transactions.sort((a, b) => b.date - a.date);
    assignColors();
    persist();
    showDashboard();
  }
}

/* ── Цвета: назначаются по всему датасету один раз,
   фильтры их не меняют («цвет следует за сущностью») ── */
function assignColors() {
  const spend = {};
  for (const t of state.transactions) {
    if (isExpense(t)) {
      spend[t.cat] = (spend[t.cat] || 0) + Math.abs(t.amount);
    }
  }
  const ranked = Object.entries(spend).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const top = ranked.slice(0, 7);
  state.seriesOrder = top;
  state.colorMap = {};
  top.forEach((catId, i) => { state.colorMap[catId] = `var(--series-${i + 1})`; });
}

function catColor(catId) {
  return state.colorMap[catId] || 'var(--other)';
}

/* ── Фильтрация ── */
function filteredTx() {
  const { month, cat, q } = state.filters;
  const qUp = q.trim().toUpperCase();
  return state.transactions.filter(t => {
    if (month !== 'all' && t.month !== month) return false;
    if (cat !== 'all' && t.cat !== cat) return false;
    if (qUp && !(t.desc.toUpperCase().includes(qUp) || t.merchant.toUpperCase().includes(qUp))) return false;
    return true;
  });
}

/* «Реальное потребление»: расходы без движения между своими счетами,
   накоплений, переводов и обслуживания долга — те считаются отдельно
   (см. renderKPIs), иначе одни и те же деньги учитывались бы дважды. */
const isExpense = t => t.amount < 0 && !NON_SPENDING.has(t.cat) && !DEBT_SERVICE.has(t.cat);

/* ── Рендер всего дашборда ── */
function render() {
  const txs = filteredTx();
  renderKPIs(txs);
  renderInsightsPanel(txs);
  renderMonthly(txs);
  renderTrends();
  renderCats(txs);
  renderMerchants(txs);
  renderTable(txs);
  renderReceipts();
}

function renderInsightsPanel(txs) {
  const insights = [
    ...computeInsights(txs, state.transactions),
    ...computeProductInsights(filteredReceipts()),
  ];
  const card = $('insights-card');
  if (!insights.length) { card.hidden = true; return; }
  card.hidden = false;
  $('insights-list').innerHTML = insights.map(i => `
    <div class="insight-row">
      <span class="insight-icon">${i.icon}</span>
      <div class="insight-body">
        <div class="insight-title">${escapeHtml(i.title)}</div>
        <div class="insight-text">${escapeHtml(i.text)}</div>
      </div>
    </div>`).join('');
}

function renderKPIs(txs) {
  const expenses = txs.filter(isExpense);
  const spent = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = txs.filter(t => t.amount > 0 && t.cat === 'income').reduce((s, t) => s + t.amount, 0);

  // обслуживание долга, накопления и семья считаются отдельно от бытовых трат
  const debtService = txs.filter(t => t.amount < 0 && DEBT_SERVICE.has(t.cat)).reduce((s, t) => s + Math.abs(t.amount), 0);
  const savings = txs.filter(t => t.amount < 0 && t.cat === 'savings').reduce((s, t) => s + Math.abs(t.amount), 0);
  const familyReceived = txs.filter(t => t.amount > 0 && t.cat === 'family').reduce((s, t) => s + t.amount, 0);
  const familySent = txs.filter(t => t.amount < 0 && t.cat === 'family').reduce((s, t) => s + Math.abs(t.amount), 0);

  let perDay = 0;
  if (expenses.length) {
    const times = expenses.map(t => t.date.getTime());
    const days = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86400000) + 1);
    perDay = spent / days;
  }

  const byCat = {};
  for (const t of expenses) byCat[t.cat] = (byCat[t.cat] || 0) + Math.abs(t.amount);
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const kpis = [
    { label: 'Расходы', value: fmtEur(spent, 2), cls: '', sub: `${expenses.length} транзакций, реальное потребление` },
    { label: 'Обслуживание долга', value: debtService ? fmtEur(debtService, 2) : '—', cls: '', sub: 'ипотека + кредиты' },
    { label: 'Отложено', value: savings ? fmtEur(savings, 2) : '—', cls: savings ? 'good' : '', sub: 'накопления' },
    { label: 'Семья', value: (familyReceived || familySent) ? fmtEur(familyReceived - familySent, 2) : '—', cls: '', sub: `получено ${fmtEur(familyReceived, 2)} · отправлено ${fmtEur(familySent, 2)}`, small: true },
    { label: 'Доходы', value: income ? fmtEur(income, 2) : '—', cls: income ? 'good' : '', sub: income ? 'зарплата и поступления' : 'не найдено в выписке' },
    { label: 'В среднем в день', value: fmtEur(perDay, 2), cls: '', sub: 'по дням с тратами в периоде' },
    topCat
      ? { label: 'Топ категория', value: CATEGORY_BY_ID[topCat[0]].icon + ' ' + CATEGORY_BY_ID[topCat[0]].name, cls: '', sub: fmtEur(topCat[1], 2) + ' · ' + Math.round(topCat[1] / spent * 100) + '% расходов', small: true }
      : { label: 'Топ категория', value: '—', cls: '', sub: '' },
  ];

  $('kpi-row').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}" ${k.small ? 'style="font-size:19px"' : ''}>${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join('');
}

function renderMonthly(txs) {
  const expenses = txs.filter(isExpense);
  const byMonth = {};
  for (const t of expenses) {
    byMonth[t.month] = byMonth[t.month] || {};
    const cat = state.seriesOrder.includes(t.cat) ? t.cat : '__other';
    byMonth[t.month][cat] = (byMonth[t.month][cat] || 0) + Math.abs(t.amount);
  }
  const months = Object.keys(byMonth).sort().map(m => ({ month: m, values: byMonth[m] }));

  const series = state.seriesOrder.map(catId => ({
    catId,
    name: CATEGORY_BY_ID[catId].name,
    color: catColor(catId),
  }));
  series.push({ catId: '__other', name: 'Остальное', color: 'var(--other)' });

  const usedSeries = series.filter(s => months.some(m => (m.values[s.catId] || 0) > 0));
  renderMonthlyChart($('chart-monthly'), months, usedSeries);
  renderLegend($('legend-monthly'), usedSeries);
  $('monthly-note').textContent = months.length ? 'наведи на сегмент, чтобы увидеть детали' : '';
}

/* Тренды по категориям месяц к месяцу: считаются по ВСЕЙ загруженной
   истории, не по текущему фильтру месяца — иначе сравнивать было бы не с чем. */
function renderTrends() {
  const expenses = state.transactions.filter(isExpense);
  const months = [...new Set(expenses.map(t => t.month))].sort();
  const card = $('trends-card');
  if (months.length < 2) { card.hidden = true; return; }
  card.hidden = false;

  const byCat = {};
  const totalByMonth = {};
  for (const t of expenses) {
    byCat[t.cat] = byCat[t.cat] || {};
    byCat[t.cat][t.month] = (byCat[t.cat][t.month] || 0) + Math.abs(t.amount);
    totalByMonth[t.month] = (totalByMonth[t.month] || 0) + Math.abs(t.amount);
  }
  const catRows = Object.entries(byCat)
    .map(([catId, byMonth]) => ({ catId, byMonth, total: Object.values(byMonth).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total);

  const deltaCell = (cur, prev) => {
    if (!prev) return '';
    const pct = Math.round((cur - prev) / prev * 100);
    if (Math.abs(pct) < 3) return `<span class="trend-delta flat">≈ без изменений</span>`;
    const cls = pct > 0 ? 'up' : 'down';
    const arrow = pct > 0 ? '▲' : '▼';
    return `<span class="trend-delta ${cls}">${arrow} ${Math.abs(pct)}%</span>`;
  };

  $('trends-thead-row').innerHTML = `<th>Категория</th>` + months.map(m => `<th>${monthLabel(m)}</th>`).join('');

  const rowsHtml = catRows.map(row => {
    const cells = months.map((m, i) => {
      const cur = row.byMonth[m] || 0;
      const prev = i > 0 ? (row.byMonth[months[i - 1]] || 0) : 0;
      if (!cur) return `<td>–</td>`;
      return `<td><span class="trend-amount">${fmtEur(cur, 2)}</span>${deltaCell(cur, prev)}</td>`;
    }).join('');
    return `<tr><td><span class="trend-cat">${CATEGORY_BY_ID[row.catId].icon} ${CATEGORY_BY_ID[row.catId].name}</span></td>${cells}</tr>`;
  }).join('');

  const totalCells = months.map((m, i) => {
    const cur = totalByMonth[m] || 0;
    const prev = i > 0 ? (totalByMonth[months[i - 1]] || 0) : 0;
    return `<td><span class="trend-amount">${fmtEur(cur, 2)}</span>${deltaCell(cur, prev)}</td>`;
  }).join('');

  $('trends-tbody').innerHTML = rowsHtml + `<tr class="trends-total"><td>Итого</td>${totalCells}</tr>`;
}

function renderCats(txs) {
  const expenses = txs.filter(isExpense);
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const byCat = {};
  for (const t of expenses) {
    byCat[t.cat] = byCat[t.cat] || { value: 0, count: 0 };
    byCat[t.cat].value += Math.abs(t.amount);
    byCat[t.cat].count++;
  }
  const items = Object.entries(byCat)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([catId, v]) => ({
      name: CATEGORY_BY_ID[catId].name,
      icon: CATEGORY_BY_ID[catId].icon,
      color: catColor(catId),
      value: v.value,
      count: v.count,
      share: total ? Math.round(v.value / total * 100) : 0,
    }));
  renderCategoryBars($('chart-categories'), items);
}

function renderMerchants(txs) {
  const expenses = txs.filter(isExpense);
  const byM = {};
  for (const t of expenses) {
    const k = merchantKey(t.merchant);
    byM[k] = byM[k] || { name: t.merchant, cat: t.cat, sum: 0, count: 0 };
    byM[k].sum += Math.abs(t.amount);
    byM[k].count++;
  }
  const top = Object.values(byM).sort((a, b) => b.sum - a.sum).slice(0, 10);
  $('top-merchants').innerHTML = top.length ? top.map(m => `
    <div class="merchant-row">
      <span class="merchant-name">${escapeHtml(m.name)}
        <span class="merchant-cat">${CATEGORY_BY_ID[m.cat].icon} ${CATEGORY_BY_ID[m.cat].name}</span>
      </span>
      <span class="merchant-count">×${m.count}</span>
      <span class="merchant-sum">${fmtEur(m.sum, 2)}</span>
    </div>`).join('') : '<p class="card-note">Нет расходов</p>';
}

function renderTable(txs) {
  const tbody = $('tx-tbody');
  const shown = txs.slice(0, state.rowsShown);
  const catOptions = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  tbody.innerHTML = shown.map((t, i) => `
    <tr>
      <td class="num">${fmtDate(t.date)}</td>
      <td><span class="tx-merchant">${escapeHtml(t.merchant)}</span><span class="tx-desc" title="${escapeHtml(t.desc)}">${escapeHtml(t.desc)}</span></td>
      <td class="num ${t.amount < 0 ? 'amount-neg' : 'amount-pos'}">${t.amount < 0 ? '−' : '+'}${fmtEur(Math.abs(t.amount), 2)}</td>
      <td><select class="cat-select" data-idx="${i}">${catOptions}</select></td>
    </tr>`).join('');

  tbody.querySelectorAll('.cat-select').forEach(sel => {
    const t = shown[+sel.dataset.idx];
    sel.value = t.cat;
    sel.addEventListener('change', () => {
      const newCat = sel.value;
      // правило запоминается для мерчанта и применяется ко всем его транзакциям
      state.userRules[merchantKey(t.merchant)] = newCat;
      applyCategories(state.transactions);
      assignColors();
      persist();
      render();
    });
  });

  $('tx-count').textContent = `${txs.length} шт.`;
  $('btn-more-rows').hidden = txs.length <= state.rowsShown;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Фильтры ── */
function rebuildFilterOptions() {
  const months = [...new Set(state.transactions.map(t => t.month))].sort().reverse();
  $('filter-month').innerHTML = '<option value="all">Все месяцы</option>' +
    months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');

  const usedCats = [...new Set(state.transactions.map(t => t.cat))];
  $('filter-cat').innerHTML = '<option value="all">Все категории</option>' +
    CATEGORIES.filter(c => usedCats.includes(c.id))
      .map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

/* ── Экспорт CSV ── */
function exportCSV() {
  const rows = [['Дата', 'Мерчант', 'Описание', 'Сумма', 'Валюта', 'Категория']];
  for (const t of state.transactions) {
    rows.push([fmtDate(t.date), t.merchant, t.desc, String(t.amount).replace('.', ','), t.currency, CATEGORY_BY_ID[t.cat].name]);
  }
  const csv = rows.map(r => r.map(f => '"' + String(f).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'расходы-по-категориям.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Переключение экранов ── */
function showDashboard() {
  $('empty-state').hidden = true;
  $('dashboard').hidden = false;
  $('btn-export').hidden = false;
  $('btn-clear').hidden = false;
  rebuildFilterOptions();
  render();
}

function showEmpty() {
  $('empty-state').hidden = false;
  $('dashboard').hidden = true;
  $('btn-export').hidden = true;
  $('btn-clear').hidden = true;
}

/* ── Инициализация ── */
function init() {
  initTheme();
  restore();
  initReceiptsUI();

  // dropzone
  const dz = $('dropzone');
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

  $('file-input').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  $('file-input-more').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

  $('btn-demo').addEventListener('click', () => {
    state.transactions = generateDemoData();
    applyCategories(state.transactions);
    state.transactions.sort((a, b) => b.date - a.date);
    assignColors();
    persist();
    showDashboard();
  });

  $('btn-theme').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  $('btn-export').addEventListener('click', exportCSV);

  $('btn-clear').addEventListener('click', () => {
    if (!confirm('Удалить все загруженные данные и правила категорий из этого браузера?')) return;
    localStorage.removeItem(LS_TX);
    localStorage.removeItem(LS_RULES);
    localStorage.removeItem(LS_RECEIPTS);
    localStorage.removeItem(LS_PRODUCT_RULES);
    state.transactions = [];
    state.userRules = {};
    receiptsState.receipts = [];
    receiptsState.productRules = {};
    state.filters = { month: 'all', cat: 'all', q: '' };
    showEmpty();
  });

  $('filter-month').addEventListener('change', e => { state.filters.month = e.target.value; state.rowsShown = 100; render(); });
  $('filter-cat').addEventListener('change', e => { state.filters.cat = e.target.value; state.rowsShown = 100; render(); });
  $('filter-q').addEventListener('input', e => { state.filters.q = e.target.value; state.rowsShown = 100; render(); });
  $('btn-more-rows').addEventListener('click', () => { state.rowsShown += 200; render(); });

  if (state.transactions.length) {
    assignColors();
    showDashboard();
  }
}

document.addEventListener('DOMContentLoaded', init);
