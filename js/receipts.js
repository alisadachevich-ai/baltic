/* Чеки и продуктовая корзина: хранение, привязка к транзакциям,
   разбор текста локально и фото/PDF через Claude API (ключ пользователя). */

const LS_RECEIPTS = 'baltic-audit-receipts-v1';
const LS_PRODUCT_RULES = 'baltic-audit-product-rules-v1';
const LS_API_KEY = 'baltic-audit-api-key';
const LS_AI_MODEL = 'baltic-audit-ai-model';

const receiptsState = {
  receipts: [],        // {id, merchant, date(Date), total, items:[{name, price, cat}], source}
  productRules: {},    // нормализованное имя товара → catId
};

/* ── Хранение ── */
function persistReceipts() {
  try {
    localStorage.setItem(LS_RECEIPTS, JSON.stringify(receiptsState.receipts.map(r => ({
      id: r.id, m: r.merchant, d: r.date.getTime(), t: r.total, s: r.source,
      i: r.items.map(it => ({ n: it.name, p: it.price, c: it.cat })),
    }))));
  } catch (e) { console.warn('Не удалось сохранить чеки', e); }
  localStorage.setItem(LS_PRODUCT_RULES, JSON.stringify(receiptsState.productRules));
}

function restoreReceipts() {
  try {
    receiptsState.productRules = JSON.parse(localStorage.getItem(LS_PRODUCT_RULES) || '{}');
    receiptsState.receipts = (JSON.parse(localStorage.getItem(LS_RECEIPTS) || '[]')).map(r => ({
      id: r.id, merchant: r.m, date: new Date(r.d), total: r.t, source: r.s,
      items: r.i.map(it => ({ name: it.n, price: it.p, cat: it.c })),
    }));
    applyProductRules();
  } catch (e) { receiptsState.receipts = []; }
}

const productKey = n => String(n || '').toUpperCase().replace(/\s+/g, ' ').trim();

function applyProductRules() {
  for (const r of receiptsState.receipts) {
    for (const it of r.items) {
      const override = receiptsState.productRules[productKey(it.name)];
      if (override) it.cat = override;
    }
  }
}

function addReceipt(parsed, source) {
  const receipt = {
    id: 'r' + Date.now() + Math.random().toString(36).slice(2, 7),
    merchant: parsed.merchant || 'Магазин',
    date: parsed.date instanceof Date ? parsed.date : (parseDateStr(parsed.date) || new Date()),
    total: parsed.total,
    items: parsed.items.map(it => ({
      name: it.name,
      price: it.price,
      cat: receiptsState.productRules[productKey(it.name)] || it.cat || categorizeProduct(it.name),
    })),
    source,
  };
  receiptsState.receipts.push(receipt);
  receiptsState.receipts.sort((a, b) => b.date - a.date);
  persistReceipts();
  return receipt;
}

/* Чек «привязан», если в выписке есть трата с той же суммой в ±3 дня */
function isReceiptLinked(receipt) {
  return state.transactions.some(t =>
    t.amount < 0 &&
    Math.abs(Math.abs(t.amount) - receipt.total) < 0.01 &&
    Math.abs(t.date - receipt.date) < 3 * 86400000
  );
}

/* ── Claude API: фото / PDF / сложный текст ── */
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: 'string', description: 'Название магазина, например Rimi, Maxima, Lidl' },
    date: { type: ['string', 'null'], description: 'Дата чека в формате YYYY-MM-DD, null если не видна' },
    total: { type: 'number', description: 'Итоговая сумма чека в EUR' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название товара как в чеке' },
          price: { type: 'number', description: 'Итоговая цена позиции в EUR со всеми скидками' },
          category: { type: 'string', enum: PRODUCT_CATEGORIES.map(c => c.id) },
        },
        required: ['name', 'price', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['merchant', 'date', 'total', 'items'],
  additionalProperties: false,
};

function receiptPrompt() {
  const cats = PRODUCT_CATEGORIES.map(c => `${c.id} = ${c.name}`).join('; ');
  return `Это кассовый чек из магазина (скорее всего Латвия: Rimi, Maxima, Lidl и т.п., названия товаров на латышском). Извлеки все товарные позиции с итоговыми ценами (учти скидки: строка "Atlaide" со знаком минус относится к товару выше). Депозит за тару (Depozīts) и пакеты — отдельные позиции категории deposit. Категории: ${cats}. Верни JSON по схеме.`;
}

/* Общий вызов Claude API со структурированным выводом по схеме */
async function claudeExtract({ content, schema, maxTokens = 8192 }) {
  const apiKey = (localStorage.getItem(LS_API_KEY) || '').trim();
  if (!apiKey) throw new Error('Нужен API-ключ Anthropic — добавь его в ⚙️ настройках раздела «Продуктовая корзина»');
  if (!/^sk-ant-/.test(apiKey)) throw new Error('Похоже, ключ введён неверно — он должен начинаться с "sk-ant-". Проверь, не попал ли лишний пробел или перенос строки при копировании');
  const model = localStorage.getItem(LS_AI_MODEL) || 'claude-opus-4-8';

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (networkErr) {
    throw new Error('Не получилось достучаться до api.anthropic.com. Проверь интернет-соединение и не блокирует ли запрос антивирус/расширение браузера (adblock, VPN). Технически: ' + networkErr.message);
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    if (resp.status === 401) throw new Error('Ключ не принят (401) — проверь, что скопирован полностью и не отозван в консоли Anthropic');
    if (resp.status === 403) throw new Error('Доступ запрещён (403): ' + (err.error?.message || 'у ключа нет прав на эту модель'));
    if (resp.status === 429) throw new Error('Превышен лимит запросов (429) — подожди немного и попробуй снова');
    throw new Error('Claude API: ' + (err.error?.message || resp.status));
  }
  const data = await resp.json();
  if (data.stop_reason === 'refusal') throw new Error('Модель отказалась обрабатывать этот файл');
  if (data.stop_reason === 'max_tokens') throw new Error('Документ слишком большой для одного запроса — раздели PDF на части');
  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Пустой ответ от Claude API');
  return JSON.parse(textBlock.text);
}

async function parseReceiptWithClaude({ base64, mediaType, text }) {
  const content = [];
  if (base64) {
    content.push(mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
  }
  content.push({ type: 'text', text: receiptPrompt() + (text ? '\n\nТекст чека:\n' + text : '') });

  const parsed = await claudeExtract({ content, schema: RECEIPT_SCHEMA });
  return {
    merchant: parsed.merchant,
    date: parsed.date ? parseDateStr(parsed.date) : new Date(),
    total: parsed.total,
    items: parsed.items.map(it => ({ name: it.name, price: it.price, cat: it.category })),
  };
}

/* ── PDF-выписка банка через Claude API ── */
const STATEMENT_SCHEMA = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Дата операции YYYY-MM-DD' },
          description: { type: 'string', description: 'Описание операции: получатель и назначение платежа как в выписке' },
          amount: { type: 'number', description: 'Сумма в EUR: отрицательная для расходов/списаний, положительная для поступлений' },
          currency: { type: 'string', description: 'Валюта, например EUR' },
        },
        required: ['date', 'description', 'amount', 'currency'],
        additionalProperties: false,
      },
    },
  },
  required: ['transactions'],
  additionalProperties: false,
};

async function parseStatementPdfWithClaude(buf, fileName) {
  const base64 = arrayBufferToBase64(buf);
  const parsed = await claudeExtract({
    content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: 'Это PDF-выписка по банковскому счёту/карте (скорее всего латвийский банк: Swedbank, SEB, Luminor, Citadele, Indexo или Revolut). Извлеки ВСЕ операции: дату, полное описание (получатель + назначение), сумму со знаком (расход/списание — минус, поступление — плюс) и валюту. Пропусти строки остатков (sākuma/beigu atlikums), оборотов (apgrozījums) и промежуточные итоги. Верни JSON по схеме.' },
    ],
    schema: STATEMENT_SCHEMA,
    maxTokens: 16000,
  });

  const txs = [];
  for (const t of parsed.transactions) {
    const date = parseDateStr(t.date);
    if (!date || typeof t.amount !== 'number') continue;
    txs.push({
      date,
      month: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
      desc: t.description,
      amount: t.amount,
      currency: t.currency || 'EUR',
      source: fileName,
    });
  }
  if (!txs.length) throw new Error('Не нашла операций в PDF: ' + fileName);
  return txs;
}

/* ── UI ── */
function initReceiptsUI() {
  restoreReceipts();

  const savedKey = localStorage.getItem(LS_API_KEY);
  if (savedKey) $('api-key-input').value = savedKey;
  $('ai-model-select').value = localStorage.getItem(LS_AI_MODEL) || 'claude-opus-4-8';

  $('api-key-input').addEventListener('change', e => {
    const v = e.target.value.trim();
    if (v) localStorage.setItem(LS_API_KEY, v); else localStorage.removeItem(LS_API_KEY);
  });
  $('ai-model-select').addEventListener('change', e => localStorage.setItem(LS_AI_MODEL, e.target.value));

  $('btn-paste-receipt').addEventListener('click', () => $('receipt-dialog').showModal());
  $('btn-receipt-settings').addEventListener('click', () => {
    const s = $('receipt-settings');
    s.hidden = !s.hidden;
  });

  $('btn-parse-receipt-text').addEventListener('click', async () => {
    const text = $('receipt-textarea').value.trim();
    if (!text) return;
    const status = $('receipt-dialog-status');
    const btn = $('btn-parse-receipt-text');
    try {
      btn.disabled = true;
      status.textContent = '⏳ Разбираю…';
      status.classList.add('status-busy');
      let parsed;
      try {
        parsed = parseReceiptText(text);
      } catch (heuristicError) {
        // локально не разобрался — пробуем через Claude, если есть ключ
        if (localStorage.getItem(LS_API_KEY)) {
          status.textContent = '⏳ Локально не разобрала, отправляю в Claude…';
          parsed = await withTimeout(parseReceiptWithClaude({ text }), 45000, 'чек');
        } else throw heuristicError;
      }
      addReceipt(parsed, 'text');
      $('receipt-textarea').value = '';
      status.textContent = '';
      status.classList.remove('status-busy');
      $('receipt-dialog').close();
      renderReceipts();
    } catch (e) {
      status.classList.remove('status-busy');
      status.textContent = '⚠️ ' + e.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('receipt-photo-input').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    const status = $('receipts-status');
    status.classList.add('status-busy');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = files.length > 1 ? `(${i + 1}/${files.length}) ` : '';
      try {
        status.textContent = `${progress}⏳ Распознаю ${file.name} через Claude…`;
        const buf = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);
        const mediaType = file.type || 'image/jpeg';
        const parsed = await withTimeout(parseReceiptWithClaude({ base64, mediaType }), 45000, file.name);
        addReceipt(parsed, 'photo');
        renderReceipts();
        status.textContent = '';
      } catch (err) {
        status.textContent = '⚠️ ' + err.message;
      }
    }
    status.classList.remove('status-busy');
  });
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/* Отрисовка корзины: учитывает фильтр месяца из основного состояния */
/* Чеки за выбранный в общем фильтре месяц (или все, если фильтр не задан) */
function filteredReceipts() {
  const month = state.filters.month;
  return receiptsState.receipts.filter(r => {
    if (month === 'all') return true;
    const rm = r.date.getFullYear() + '-' + String(r.date.getMonth() + 1).padStart(2, '0');
    return rm === month;
  });
}

function renderReceipts() {
  const receipts = filteredReceipts();

  const empty = !receiptsState.receipts.length;
  $('basket-empty').hidden = !empty;
  $('basket-content').hidden = empty;
  if (empty) return;

  // агрегация по категориям товаров
  const byCat = {};
  const byProduct = {};
  let totalSum = 0;
  for (const r of receipts) {
    for (const it of r.items) {
      if (it.price <= 0) continue;
      byCat[it.cat] = byCat[it.cat] || { value: 0, count: 0 };
      byCat[it.cat].value += it.price;
      byCat[it.cat].count++;
      const pk = productKey(it.name);
      byProduct[pk] = byProduct[pk] || { name: it.name, cat: it.cat, sum: 0, count: 0 };
      byProduct[pk].sum += it.price;
      byProduct[pk].count++;
      totalSum += it.price;
    }
  }

  const items = Object.entries(byCat)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([catId, v]) => ({
      name: PRODUCT_CATEGORY_BY_ID[catId].name,
      icon: PRODUCT_CATEGORY_BY_ID[catId].icon,
      color: 'var(--accent)',
      value: v.value,
      count: v.count,
      share: totalSum ? Math.round(v.value / totalSum * 100) : 0,
    }));
  renderCategoryBars($('basket-categories'), items);

  // топ товаров
  const top = Object.values(byProduct).sort((a, b) => b.sum - a.sum).slice(0, 12);
  $('basket-top-products').innerHTML = top.map(p => `
    <div class="merchant-row">
      <span class="merchant-name">${escapeHtml(p.name)}
        <span class="merchant-cat">${PRODUCT_CATEGORY_BY_ID[p.cat].icon} ${PRODUCT_CATEGORY_BY_ID[p.cat].name}</span>
      </span>
      <span class="merchant-count">×${p.count}</span>
      <span class="merchant-sum">${fmtEur(p.sum, 2)}</span>
    </div>`).join('') || '<p class="card-note">Нет товаров за выбранный период</p>';

  // список чеков
  const linked = receipts.filter(isReceiptLinked).length;
  $('basket-note').textContent = receipts.length
    ? `${receipts.length} чек(ов), ${linked} совпадают с транзакциями из выписки`
    : 'Нет чеков за выбранный период';

  const catOptions = PRODUCT_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  $('receipts-list').innerHTML = receipts.map(r => `
    <details class="receipt-row">
      <summary>
        <span>${fmtDate(r.date)} · <strong>${escapeHtml(r.merchant)}</strong> · ${r.items.length} поз.
          ${isReceiptLinked(r) ? '<span class="linked-badge" title="Совпадает с транзакцией из выписки">✓ выписка</span>' : ''}
        </span>
        <span class="merchant-sum">${fmtEur(r.total, 2)}</span>
      </summary>
      <div class="receipt-items">
        ${r.items.map((it, idx) => `
          <div class="receipt-item">
            <span class="receipt-item-name">${escapeHtml(it.name)}</span>
            <span class="merchant-sum">${fmtEur(it.price, 2)}</span>
            <select class="cat-select" data-rid="${r.id}" data-idx="${idx}">${catOptions}</select>
          </div>`).join('')}
        <div class="receipt-foot">
          <button class="btn small danger" data-del-receipt="${r.id}">Удалить чек</button>
        </div>
      </div>
    </details>`).join('');

  // проставить выбранные категории и повесить обработчики
  $('receipts-list').querySelectorAll('.cat-select').forEach(sel => {
    const receipt = receiptsState.receipts.find(x => x.id === sel.dataset.rid);
    const item = receipt.items[+sel.dataset.idx];
    sel.value = item.cat;
    sel.addEventListener('change', () => {
      receiptsState.productRules[productKey(item.name)] = sel.value;
      applyProductRules();
      persistReceipts();
      renderReceipts();
    });
  });
  $('receipts-list').querySelectorAll('[data-del-receipt]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Удалить этот чек?')) return;
      receiptsState.receipts = receiptsState.receipts.filter(x => x.id !== btn.dataset.delReceipt);
      persistReceipts();
      renderReceipts();
    });
  });
}
