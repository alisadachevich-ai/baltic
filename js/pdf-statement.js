/* Локальный разбор PDF-выписок: pdf.js работает целиком в браузере,
   без сети и без API-ключа. Извлекаем текстовые блоки с координатами,
   восстанавливаем порядок строк слева направо и построчно ищем
   дату + сумму регулярками — это надёжнее, чем пытаться угадать
   границы колонок таблицы (в PDF они «плавают» от строки к строке). */

let pdfWorkerReady = null;

function ensurePdfWorker() {
  if (pdfWorkerReady) return pdfWorkerReady;
  pdfWorkerReady = new Promise((resolve, reject) => {
    if (!window.pdfjsLib) { reject(new Error('Библиотека для чтения PDF не загрузилась')); return; }
    try {
      const blob = new Blob([window.PDFJS_WORKER_SOURCE], { type: 'text/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      window.pdfjsLib.GlobalWorkerOptions.workerPort = worker;
      resolve(worker);
    } catch (e) { reject(e); }
  });
  return pdfWorkerReady;
}

/* Группируем текстовые куски страницы по строкам (Y с допуском) и внутри
   строки склеиваем слева направо через пробел — без попытки угадать
   колонки: сумма и дата ищутся регулярками уже в готовой строке. */
function reconstructLines(items) {
  const sorted = items.filter(it => it.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let current = null;
  for (const it of sorted) {
    if (!current || Math.abs(current.y - it.y) > 2) {
      current = { y: it.y, parts: [] };
      rows.push(current);
    }
    current.parts.push(it.str.trim());
  }
  return rows.map(r => r.parts.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/* PDF → массив текстовых строк (по всем страницам, в порядке чтения) */
async function extractPdfLines(buf) {
  await ensurePdfWorker();
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const allLines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter(it => typeof it.str === 'string')
      .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
    allLines.push(...reconstructLines(items));
  }
  return allLines;
}

const PDF_DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}|\d{1,2}[./]\d{1,2}[./]\d{2})\b/;
const PDF_AMOUNT_RE = /-?\d+(?:[ .]\d{3})*[.,]\d{2}(?!\d)/g;
const SKIP_LINE_RE = /APGROZĪJUMS|APGROZIJUMS|ATLIKUM|SĀKUMA|SAKUMA|BEIGU SALDO|OPENING BALANCE|CLOSING BALANCE|KOPĀ|KOPA\b|PERIOD|LAPA \d|PAGE \d/i;

/* Одна восстановленная строка PDF → транзакция или null */
function parsePdfLine(line, fileName) {
  const dateMatch = line.match(PDF_DATE_RE);
  if (!dateMatch) return null;
  const date = parseDateStr(dateMatch[1]);
  if (!date) return null;

  let rest = line.slice(dateMatch[0].length);
  if (SKIP_LINE_RE.test(rest)) return null;

  const amounts = rest.match(PDF_AMOUNT_RE);
  if (!amounts || !amounts.length) return null;
  const amountStr = amounts[0];
  const amount = parseAmountStr(amountStr);
  if (amount === null) return null;

  // описание — всё вокруг найденной суммы (первое вхождение), без даты и лишних пробелов
  const idx = rest.indexOf(amountStr);
  const desc = (rest.slice(0, idx) + ' ' + rest.slice(idx + amountStr.length))
    .replace(/\s+/g, ' ').trim() || rest.trim();

  return {
    date,
    month: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
    desc,
    amount,
    currency: 'EUR',
    source: fileName,
  };
}

/* PDF-выписка → транзакции, полностью локально, без API-ключа.
   Бросает ошибку, если в PDF нет текстового слоя (скан) или не нашлось
   ни одной строки с датой+суммой — тогда вызывающий код может
   попробовать распознать через Claude API. */
async function parseStatementPdfLocally(buf, fileName) {
  const lines = await extractPdfLines(buf);
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  if (totalChars < 20) throw new Error('В PDF нет текстового слоя — похоже, это скан: ' + fileName);

  const txs = [];
  for (const line of lines) {
    const tx = parsePdfLine(line, fileName);
    if (tx) txs.push(tx);
  }
  if (!txs.length) throw new Error('Не нашла операций в PDF (дата + сумма на одной строке): ' + fileName);
  return txs;
}
