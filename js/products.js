/* Продуктовая корзина: категории товаров, словарь латышских названий,
   эвристический парсер текстовых э-чеков (Mans Rimi / Maxima Paldies). */

const PRODUCT_CATEGORIES = [
  { id: 'dairy',     name: 'Молочка и яйца',       icon: '🥛' },
  { id: 'meat',      name: 'Мясо и рыба',          icon: '🥩' },
  { id: 'produce',   name: 'Овощи и фрукты',       icon: '🥦' },
  { id: 'bread',     name: 'Хлеб и выпечка',       icon: '🍞' },
  { id: 'pantry',    name: 'Бакалея',              icon: '🍝' },
  { id: 'sweets',    name: 'Сладости и снеки',     icon: '🍫' },
  { id: 'coffee',    name: 'Кофе и чай',           icon: '☕' },
  { id: 'drinks',    name: 'Напитки',              icon: '🥤' },
  { id: 'alcohol',   name: 'Алкоголь',             icon: '🍷' },
  { id: 'frozen',    name: 'Заморозка и п/ф',      icon: '🧊' },
  { id: 'ready',     name: 'Готовая еда',          icon: '🍱' },
  { id: 'household', name: 'Бытовая химия и гигиена', icon: '🧴' },
  { id: 'homegoods', name: 'Для дома',             icon: '🏠' },
  { id: 'petfood',   name: 'Зоотовары',            icon: '🐈' },
  { id: 'deposit',   name: 'Депозит и пакеты',     icon: '♻️' },
  { id: 'p_other',   name: 'Прочее',               icon: '📦' },
];

const PRODUCT_CATEGORY_BY_ID = Object.fromEntries(PRODUCT_CATEGORIES.map(c => [c.id, c]));

/* Ключевые слова (латышский + немного английского/русского), верхний регистр.
   Порядок важен — более специфичные раньше. */
const PRODUCT_RULES = [
  // Молочка и яйца
  { m: ['PIENS', 'JOGURT', 'BIEZPIEN', 'KRĒJUM', 'KREJUM', 'SVIESTS', 'SIERS', 'SIERIŅ', 'SIERIN', 'KEFĪR', 'KEFIR', 'OLAS', 'OLA ', 'PANĪR', 'PANIR', 'SKĀBAIS', 'MILK', 'МОЛОКО', 'ТВОРОГ'], cat: 'dairy' },
  // Мясо и рыба
  { m: ['VISTAS', 'VISTA', 'CĀĻA', 'CALA ', 'FILEJA', 'CŪKGAĻ', 'CUKGAL', 'LIELLOP', 'MALTĀ GAĻA', 'MALTA GALA', 'GAĻA', 'GALA ', 'DESA', 'DESIŅ', 'DESIN', 'ŠĶIŅĶ', 'SKINK', 'CĪSIŅ', 'CISIN', 'BEKONS', 'LASIS', 'LAŠA', 'LASA ', 'ZIVS', 'ZIVJU', 'FORELE', 'SIĻĶE', 'SILKE', 'TUNCIS', 'GARNELES', 'HERING'], cat: 'meat' },
  // Овощи и фрукты
  { m: ['TOMĀTI', 'TOMATI', 'GURĶI', 'GURKI', 'KARTUPEĻI', 'KARTUPELI', 'SĪPOLI', 'SIPOLI', 'BURKĀNI', 'BURKANI', 'KĀPOSTI', 'KAPOSTI', 'SALĀTI', 'SALATI ', 'PAPRIKA', 'BANĀNI', 'BANANI', 'ĀBOLI', 'ABOLI', 'APELSĪNI', 'APELSINI', 'CITRONI', 'MANDARĪNI', 'MANDARINI', 'VĪNOGAS', 'VINOGAS', 'ZEMENES', 'MELLENES', 'AVOKADO', 'ĶIPLOK', 'KIPLOK', 'CUKĪNI', 'BROKOĻI', 'BROKOLI', 'SĒNES', 'SENES', 'ŠAMPINJONI', 'SAMPINJONI', 'BUMBIERI', 'KIVI', 'PERSIKI', 'DILLE', 'PĒTERSĪĻ'], cat: 'produce' },
  // Хлеб и выпечка
  { m: ['MAIZE', 'BAGETE', 'BULCIŅ', 'BULCIN', 'KRUASĀN', 'KRUASAN', 'KŪKA', 'KUKA ', 'PĪRĀGS', 'PIRAGS', 'PĪRĀDZIŅ', 'SMALKMAIZ', 'TOSTERMAIZE', 'LAVAŠ', 'LAVAS', 'TORTILJA'], cat: 'bread' },
  // Бакалея
  { m: ['MAKARONI', 'SPAGETI', 'RĪSI', 'RISI ', 'GRIĶI', 'GRIKI', 'AUZU', 'PĀRSLAS', 'PARSLAS', 'MILTI', 'CUKURS', 'SĀLS', 'SALS ', 'EĻĻA', 'ELLA ', 'ETIĶIS', 'MĒRCE', 'MERCE', 'KEČUPS', 'KECUPS', 'MAJONĒZE', 'MAJONEZE', 'KONSERV', 'ZUPA ', 'BULJONS', 'GARŠVIELA', 'GARSVIELA', 'MEDUS', 'IEVĀRĪJUMS', 'DŽEMS', 'DZEMS', 'RIEKSTI', 'MANDELES', 'TUNZIVIS'], cat: 'pantry' },
  // Сладости и снеки
  { m: ['ŠOKOLĀDE', 'SOKOLADE', 'KONFEKTES', 'CEPUMI', 'VAFELES', 'BATONIŅ', 'BATONIN', 'ČIPSI', 'CIPSI', 'SALDĒJUMS', 'SALDEJUMS', 'ZEFĪRS', 'ZEFIRS', 'MARMELĀDE', 'KRENDEĻ', 'POPKORNS', 'HALVA', 'GUMIJAS'], cat: 'sweets' },
  // Кофе и чай
  { m: ['KAFIJA', 'KAFIJAS', 'ESPRESSO', 'TĒJA', 'TEJA ', 'KAKAO', 'COFFEE'], cat: 'coffee' },
  // Напитки
  { m: ['ŪDENS', 'UDENS', 'SULA', 'NEKTĀRS', 'NEKTARS', 'LIMONĀDE', 'LIMONADE', 'KOLA', 'PEPSI', 'FANTA', 'SPRITE', 'DZĒRIENS', 'DZERIENS', 'KVASS', 'ENERĢIJAS', 'ENERGIJAS', 'SMŪTIJS', 'SMUTIJS'], cat: 'drinks' },
  // Алкоголь
  { m: ['ALUS', 'VĪNS', 'VINS ', 'SIDRS', 'DEGVĪNS', 'DEGVINS', 'LIĶIERIS', 'LIKIERIS', 'ŠAMPANIETIS', 'SAMPANIETIS', 'VISKIJS', 'DŽINS', 'DZINS', 'RUMS', 'VERMUTS', 'BRENDIJS', 'KONJAKS', 'PROSECCO'], cat: 'alcohol' },
  // Заморозка и полуфабрикаты
  { m: ['SALDĒT', 'SALDET', 'PELMEŅI', 'PELMENI', 'PICA', 'FRĪ', 'FRI ', 'KOTLETES', 'NAGGETS', 'VĀRTIŅ'], cat: 'frozen' },
  // Готовая еда (кулинария)
  { m: ['KULINĀRIJA', 'KULINARIJA', 'GATAVS', 'GATAVĀ', 'SUŠI', 'SUSI ', 'SVAIGI GATAVOTS', 'ROLLS'], cat: 'ready' },
  // Бытовая химия и гигиена
  { m: ['VEĻAS', 'VELAS ', 'TRAUKU', 'MAZGĀŠANAS', 'MAZGASANAS', 'ŠAMPŪNS', 'SAMPUNS', 'ZOBU PASTA', 'ZOBU BIRSTE', 'TUALETES PAPĪRS', 'TUALETES PAPIRS', 'ZIEPES', 'DEZODORANTS', 'SALVETES', 'SALVETĪTES', 'HIGIĒNAS', 'HIGIENAS', 'SKALOŠANAS', 'TĪRĪŠANAS', 'TIRISANAS', 'ATKRITUMU MAISI'], cat: 'household' },
  // Для дома
  { m: ['SVECES', 'BATERIJAS', 'SPULDZE', 'FOLIJA', 'CEPAMPAPĪRS', 'CEPAMPAPIRS', 'TRAUKI ', 'GLĀZES', 'GLAZES'], cat: 'homegoods' },
  // Зоотовары
  { m: ['KAĶU', 'KAKU ', 'SUŅU', 'SUNU ', 'BARĪBA', 'BARIBA', 'PAKAIŠI', 'PAKAISI'], cat: 'petfood' },
  // Депозит и пакеты
  { m: ['DEPOZĪTS', 'DEPOZITS', 'DEPOZĪTA', 'DEPOZITA', 'MAISIŅŠ', 'MAISINS', 'MAISIŅ', 'IEPIRKUMU SOMA'], cat: 'deposit' },
];

function categorizeProduct(name) {
  const up = ' ' + String(name || '').toUpperCase().replace(/\s+/g, ' ').trim() + ' ';
  for (const rule of PRODUCT_RULES) {
    for (const pat of rule.m) {
      if (up.includes(pat)) return rule.cat;
    }
  }
  return 'p_other';
}

/* ── Эвристический парсер текста чека ──
   Возвращает { merchant, date, total, items: [{name, price, cat}] }.
   Терпимо относится к формату: строки «товар … цена [A|B]»,
   количественные строки «0,455 kg X 8,49 EUR/kg», скидки, депозит. */
function parseReceiptText(text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Пустой текст чека');

  const upAll = text.toUpperCase();
  let merchant = 'Магазин';
  if (upAll.includes('RIMI')) merchant = 'Rimi';
  else if (upAll.includes('MAXIMA')) merchant = 'Maxima';
  else if (upAll.includes('LIDL')) merchant = 'Lidl';
  else if (upAll.includes('ELVI')) merchant = 'Elvi';
  else if (upAll.includes('TOP!')) merchant = 'top!';

  // дата: dd.mm.yyyy или yyyy-mm-dd
  let date = null;
  const dm = text.match(/(\d{2})\.(\d{2})\.(\d{4})/) || text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dm) {
    date = dm[0].includes('-')
      ? new Date(+dm[1], +dm[2] - 1, +dm[3])
      : new Date(+dm[3], +dm[2] - 1, +dm[1]);
  }

  const SKIP = /KOPĀ|KOPA\b|SUMMA|PVN|NODOKL|BANKAS|KARTE|SKAIDRA|ATLIKUM|ČEKS|CEKS|KASIER|KASE\b|REĢ\.?\s?NR|REG\.?\s?NR|SIA |A\/S|TĀLR|TALR|WWW\.|PALDIES|APMEKLĒ|ATVĒRTS|KVĪTS|KVITS|TERMINĀL|TERMINAL|LAIKS|DATUMS|Nr\.|KLIENTS|BONUSS|UZKRĀT|NOPELNĪT|MANS RIMI|PIRCĒJ/i;
  const QTY_LINE = /^(\d+[.,]?\d*)\s*(gab|kg|l|ml|g)\.?\s*[xX×]\s*(\d+[.,]\d{2,3})/i;
  const PRICE_END = /^(.*?)\s+(-?\d+[.,]\d{2})\s*([AB])?\s*$/;
  const DISCOUNT = /ATLAIDE|ATL\.|NOCENOJ|DISCOUNT|AKCIJA/i;

  const items = [];
  let total = null;
  let pendingName = null;

  for (const line of lines) {
    // итоговая сумма
    const totalMatch = line.match(/(?:KOPĀ|KOPA|SAMAKSAI|APMAKSAI|TOTAL)\D*(\d+[.,]\d{2})/i);
    if (totalMatch) { total = parseFloat(totalMatch[1].replace(',', '.')); continue; }

    if (SKIP.test(line)) { pendingName = null; continue; }

    // количественная строка: «0,455 kg X 8,49 …  3,86 A»
    const qty = line.match(QTY_LINE);
    if (qty) {
      const priceMatch = line.match(/(-?\d+[.,]\d{2})\s*[AB]?\s*$/);
      if (priceMatch && pendingName) {
        items.push({ name: pendingName, price: parseFloat(priceMatch[1].replace(',', '.')), cat: categorizeProduct(pendingName) });
        pendingName = null;
      }
      continue;
    }

    const pm = line.match(PRICE_END);
    if (pm && pm[1].length >= 2 && /\D{2,}/.test(pm[1])) {
      const name = pm[1].replace(/\s+/g, ' ').trim();
      const price = parseFloat(pm[2].replace(',', '.'));
      if (DISCOUNT.test(name) && price < 0 && items.length) {
        // скидка уменьшает предыдущий товар
        items[items.length - 1].price = Math.round((items[items.length - 1].price + price) * 100) / 100;
      } else if (!DISCOUNT.test(name)) {
        items.push({ name, price, cat: categorizeProduct(name) });
      }
      pendingName = null;
    } else if (/\D{3,}/.test(line) && !/\d{5,}/.test(line)) {
      // строка без цены — возможно имя товара, цена на следующей строке
      pendingName = line.replace(/\s+/g, ' ').trim();
    }
  }

  if (!items.length) throw new Error('Не нашла товаров в тексте чека — проверь, что скопирован список покупок с ценами');

  const itemsSum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
  return { merchant, date: date || new Date(), total: total ?? itemsSum, itemsSum, items };
}
