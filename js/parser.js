/* Парсер банковских выписок (CSV).
   Поддержка: Swedbank LV, SEB LV, Citadele, Luminor, Revolut + любой CSV,
   где можно автоматически найти колонки даты, суммы и описания. */

/* ── Декодирование файла ── */
function decodeBuffer(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  // если много символов замены (U+FFFD) — это скорее всего windows-1257 (балтийская)
  const badCount = (utf8.match(/\uFFFD/g) || []).length;
  if (badCount > 2) {
    try { return new TextDecoder('windows-1257').decode(buf); } catch (e) { /* оставляем utf-8 */ }
  }
  return utf8.replace(/^﻿/, '');
}

/* ── CSV с кавычками ── */
function detectDelimiter(text) {
  const sample = text.slice(0, 4000);
  const counts = [';', ',', '\t'].map(d => {
    let n = 0, inQ = false;
    for (const ch of sample) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch === d) n++;
    }
    return { d, n };
  });
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ';';
}

function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f.trim() !== '')) rows.push(row); }
  return rows;
}

/* ── Даты и суммы ── */
function parseDateStr(s) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)))                 return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)))       return new Date(+m[3], +m[2] - 1, +m[1]);
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)))      return new Date(2000 + +m[3], +m[2] - 1, +m[1]);
  return null;
}

function parseAmountStr(s) {
  s = String(s || '').replace(/[\s ]/g, '').replace(/EUR|USD|GBP|€|\$/gi, '');
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // оба разделителя: последний — десятичный
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // одна запятая: десятичная, если после неё 1–2 цифры
    const after = s.length - lastComma - 1;
    s = (after <= 2) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

/* ── Поиск колонок ── */
const COL_PATTERNS = {
  date:    /datums|date|dato|data\b|дата|kuupäev|completed date|started date|transaction date|booking/i,
  amount:  /summa\b|amount|betrag|сумма|suma\b/i,
  payee:   /saņēmējs|sanemejs|maksātājs|maksatajs|beneficiary|payee|получатель|name/i,
  info:    /informācija|informacija|description|apraksts|details|назначение|paskaidrojums|maksājuma mērķis|merki|purpose/i,
  dc:      /debets|kredīts|kredits|d\/k|dc\b|debit\/credit/i,
  currency:/valūta|valuta|currency|валюта/i,
  type:    /ieraksta tips|type|veids/i,
  state:   /state|status/i,
};

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (COL_PATTERNS.date.test(joined) && (COL_PATTERNS.amount.test(joined) || /amount/i.test(joined))) return i;
  }
  return -1;
}

function findCol(header, re) {
  for (let i = 0; i < header.length; i++) if (re.test(header[i])) return i;
  return -1;
}

/* Определяем колонки по содержимому, если заголовка нет */
function guessColumns(rows) {
  const probe = rows.slice(0, 20);
  const nCols = Math.max(...probe.map(r => r.length));
  let dateCol = -1, amountCol = -1;
  for (let c = 0; c < nCols; c++) {
    const vals = probe.map(r => r[c]).filter(v => v && v.trim());
    if (!vals.length) continue;
    const dateHits = vals.filter(v => parseDateStr(v)).length;
    if (dateCol === -1 && dateHits > vals.length * 0.6) { dateCol = c; continue; }
    const numHits = vals.filter(v => parseAmountStr(v) !== null && !parseDateStr(v)).length;
    if (amountCol === -1 && c !== dateCol && numHits > vals.length * 0.6) amountCol = c;
  }
  // описание — самая «текстовая» колонка
  let descCol = -1, bestLen = 0;
  for (let c = 0; c < nCols; c++) {
    if (c === dateCol || c === amountCol) continue;
    const vals = probe.map(r => r[c] || '');
    const avgLen = vals.reduce((s, v) => s + v.length, 0) / (vals.length || 1);
    const numeric = vals.filter(v => v && parseAmountStr(v) !== null).length;
    if (avgLen > bestLen && numeric < vals.length * 0.5) { bestLen = avgLen; descCol = c; }
  }
  return { dateCol, amountCol, descCol };
}

/* ── Главная функция: текст файла → массив транзакций ── */
function parseStatement(buf, fileName) {
  const text = decodeBuffer(buf);
  const delim = detectDelimiter(text);
  const rows = parseCSV(text, delim);
  if (rows.length < 2) throw new Error('Файл пустой или не похож на CSV: ' + fileName);

  const headerIdx = findHeaderRow(rows);
  let cols, dataRows, bankGuess = 'generic';

  if (headerIdx >= 0) {
    const header = rows[headerIdx].map(h => h.trim());
    const joined = header.join(';').toLowerCase();
    if (/ieraksta tips/.test(joined)) bankGuess = 'swedbank';
    else if (/completed date/.test(joined) && /product/.test(joined)) bankGuess = 'revolut';

    cols = {
      date:    findCol(header, COL_PATTERNS.date),
      amount:  findCol(header, COL_PATTERNS.amount),
      payee:   findCol(header, COL_PATTERNS.payee),
      info:    findCol(header, COL_PATTERNS.info),
      dc:      findCol(header, COL_PATTERNS.dc),
      currency:findCol(header, COL_PATTERNS.currency),
      type:    findCol(header, COL_PATTERNS.type),
      state:   findCol(header, COL_PATTERNS.state),
    };
    // у Revolut две колонки дат — берём Completed Date
    if (bankGuess === 'revolut') {
      const completed = findCol(header, /completed date/i);
      if (completed > -1) cols.date = completed;
    }
    dataRows = rows.slice(headerIdx + 1);
  } else {
    const g = guessColumns(rows);
    if (g.dateCol === -1 || g.amountCol === -1)
      throw new Error('Не нашла колонки даты и суммы в файле: ' + fileName);
    cols = { date: g.dateCol, amount: g.amountCol, payee: -1, info: g.descCol, dc: -1, currency: -1, type: -1, state: -1 };
    dataRows = rows;
  }

  const txs = [];
  for (const r of dataRows) {
    const date = parseDateStr(r[cols.date]);
    if (!date) continue;

    let amount = parseAmountStr(r[cols.amount]);
    if (amount === null) continue;

    // служебные строки Swedbank: тип 10/82/86 — начальный остаток/оборот/конечный остаток
    if (cols.type > -1 && bankGuess === 'swedbank') {
      const t = String(r[cols.type] || '').trim();
      if (t && t !== '20') continue;
    }
    // Revolut: пропускаем незавершённые операции
    if (cols.state > -1) {
      const st = String(r[cols.state] || '').trim().toUpperCase();
      if (st && st !== 'COMPLETED') continue;
    }

    // знак: колонка Debets/Kredīts (D = расход)
    if (cols.dc > -1) {
      const dc = String(r[cols.dc] || '').trim().toUpperCase();
      amount = Math.abs(amount) * (dc === 'D' ? -1 : 1);
    }

    const payee = cols.payee > -1 ? (r[cols.payee] || '').trim() : '';
    const info  = cols.info  > -1 ? (r[cols.info]  || '').trim() : '';
    let desc = [payee, info].filter(Boolean).join(' — ');
    if (!desc) desc = r.filter((f, i) => i !== cols.date && i !== cols.amount && f && f.trim()).join(' ').slice(0, 200);

    const descUp = desc.toUpperCase();
    if (/APGROZĪJUMS|APGROZIJUMS|ATLIKUMS|SĀKUMA|SAKUMA|BEIGU SALDO|OPENING BALANCE|CLOSING BALANCE/.test(descUp)) continue;

    const currency = cols.currency > -1 ? (r[cols.currency] || 'EUR').trim() : 'EUR';

    txs.push({
      date,
      month: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
      desc,
      amount,
      currency: currency || 'EUR',
      source: fileName,
    });
  }

  if (!txs.length) throw new Error('Не нашла ни одной транзакции в файле: ' + fileName);
  return txs;
}
