/* Отрисовка графиков на чистом SVG.
   Цвета берутся из CSS-переменных --series-1..8, поэтому графики
   автоматически перекрашиваются при смене темы (app.js перерисовывает). */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.appendChild(c);
  return el;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmtEur(v, digits = 0) {
  return v.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' €';
}

function monthLabel(ym) {
  const NAMES = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const [y, m] = ym.split('-');
  return NAMES[+m - 1] + ' ’' + y.slice(2);
}

/* ── Тултип ── */
const tooltip = {
  el: null,
  show(html, x, y) {
    if (!this.el) this.el = document.getElementById('viz-tooltip');
    this.el.innerHTML = html;
    this.el.hidden = false;
    const r = this.el.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 14;
    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  },
  hide() { if (this.el) this.el.hidden = true; },
};

/* ── Столбчатый график с накоплением: расходы по месяцам ──
   series: [{catId, name, color}] — фиксированный порядок;
   data: [{month, values: {catId: amount}}] */
function renderMonthlyChart(container, months, series) {
  container.innerHTML = '';
  if (!months.length) { container.innerHTML = '<p class="card-note">Нет расходов за выбранный период</p>'; return; }

  const W = 960, plotH = 260, axisBand = 26, H = plotH + axisBand;
  const padL = 56, padR = 12, padT = 24;
  const innerW = W - padL - padR, innerH = plotH - padT;

  const totals = months.map(m => Object.values(m.values).reduce((s, v) => s + v, 0));
  const maxV = Math.max(...totals, 1);
  const niceMax = niceCeil(maxV);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Расходы по месяцам, с разбивкой по категориям' });

  const muted = cssVar('--text-muted'), grid = cssVar('--grid'), baseline = cssVar('--baseline');
  const inkPrimary = cssVar('--text-primary');

  // сетка + подписи оси Y (тонкие сплошные линии)
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const v = niceMax * i / ySteps;
    const y = padT + innerH - (v / niceMax) * innerH;
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: i === 0 ? baseline : grid, 'stroke-width': 1 }));
    svg.appendChild(Object.assign(svgEl('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: muted }), { textContent: fmtEur(v) }));
  }

  const n = months.length;
  const slot = innerW / n;
  const barW = Math.min(64, slot * 0.55);
  const GAP = 2; // зазор цвета поверхности между сегментами

  months.forEach((m, i) => {
    const x = padL + slot * i + (slot - barW) / 2;
    let acc = 0;
    const total = totals[i];

    series.forEach(s => {
      const v = m.values[s.catId] || 0;
      if (v <= 0) return;
      const h = (v / niceMax) * innerH;
      const y = padT + innerH - ((acc + v) / niceMax) * innerH;
      const isTop = acc + v >= total - 0.005;
      const rect = svgEl('rect', {
        x, y: y + (isTop ? 0 : GAP / 2), width: barW,
        height: Math.max(h - (isTop ? GAP / 2 : GAP), 1),
        fill: s.color, rx: isTop ? 4 : 0,
      });
      rect.addEventListener('mousemove', e => tooltip.show(
        `<div class="tt-title">${s.name}</div>
         <div class="tt-row"><span>${monthLabel(m.month)}</span><span class="v">${fmtEur(v, 2)}</span></div>
         <div class="tt-row"><span>Доля месяца</span><span class="v">${Math.round(v / total * 100)}%</span></div>`,
        e.clientX, e.clientY));
      rect.addEventListener('mouseleave', () => tooltip.hide());
      svg.appendChild(rect);
      acc += v;
    });

    // итог месяца — выборочная прямая подпись над столбцом
    const topY = padT + innerH - (total / niceMax) * innerH;
    svg.appendChild(Object.assign(
      svgEl('text', { x: x + barW / 2, y: topY - 6, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: inkPrimary }),
      { textContent: fmtEur(total) }));

    // подпись месяца
    svg.appendChild(Object.assign(
      svgEl('text', { x: x + barW / 2, y: plotH + 16, 'text-anchor': 'middle', 'font-size': 11.5, fill: muted }),
      { textContent: monthLabel(m.month) }));
  });

  container.appendChild(svg);
}

function niceCeil(v) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/* ── Легенда ── */
function renderLegend(container, series) {
  container.innerHTML = '';
  series.forEach(s => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = s.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(s.name));
    container.appendChild(item);
  });
}

/* ── Горизонтальные полосы по категориям (HTML, значение у конца полосы) ── */
function renderCategoryBars(container, items) {
  container.innerHTML = '';
  if (!items.length) { container.innerHTML = '<p class="card-note">Нет расходов</p>'; return; }
  const max = Math.max(...items.map(i => i.value), 1);
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'catbar-row';

    const name = document.createElement('span');
    name.className = 'catbar-name';
    name.textContent = `${it.icon} ${it.name}`;
    name.title = it.name;

    const track = document.createElement('div');
    track.className = 'catbar-track';
    const fill = document.createElement('div');
    fill.className = 'catbar-fill';
    fill.style.width = (it.value / max * 100) + '%';
    fill.style.background = it.color;
    track.appendChild(fill);
    track.addEventListener('mousemove', e => tooltip.show(
      `<div class="tt-title">${it.icon} ${it.name}</div>
       <div class="tt-row"><span>Сумма</span><span class="v">${fmtEur(it.value, 2)}</span></div>
       <div class="tt-row"><span>Транзакций</span><span class="v">${it.count}</span></div>
       <div class="tt-row"><span>Доля расходов</span><span class="v">${it.share}%</span></div>`,
      e.clientX, e.clientY));
    track.addEventListener('mouseleave', () => tooltip.hide());

    const val = document.createElement('span');
    val.className = 'catbar-val';
    val.textContent = fmtEur(it.value);

    row.append(name, track, val);
    container.appendChild(row);
  });
}
