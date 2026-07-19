/* Категории и словарь мерчантов (Латвия / Балтия).
   Порядок в CATEGORIES фиксированный — от него зависит и порядок в
   выпадающих списках. Цвета графикам назначаются отдельно, по объёму трат. */

const CATEGORIES = [
  { id: 'groceries',    name: 'Продукты',            icon: '🛒' },
  { id: 'cafe',         name: 'Кафе и рестораны',    icon: '☕' },
  { id: 'delivery',     name: 'Доставка еды',        icon: '🛵' },
  { id: 'transport',    name: 'Транспорт',           icon: '🚌' },
  { id: 'fuel',         name: 'Авто и топливо',      icon: '⛽' },
  { id: 'health',       name: 'Аптеки и здоровье',   icon: '💊' },
  { id: 'beauty',       name: 'Красота и уход',      icon: '💅' },
  { id: 'clothes',      name: 'Одежда и обувь',      icon: '👗' },
  { id: 'home',         name: 'Дом и быт',           icon: '🏠' },
  { id: 'electronics',  name: 'Электроника',         icon: '💻' },
  { id: 'subscriptions',name: 'Подписки и цифровое', icon: '📱' },
  { id: 'telecom',      name: 'Связь и интернет',    icon: '📡' },
  { id: 'utilities',    name: 'Коммунальные',        icon: '💡' },
  { id: 'entertainment',name: 'Развлечения',         icon: '🎬' },
  { id: 'sport',        name: 'Спорт',               icon: '🏋️' },
  { id: 'pets',         name: 'Питомцы',             icon: '🐈' },
  { id: 'travel',       name: 'Путешествия',         icon: '✈️' },
  { id: 'cash',         name: 'Наличные (банкомат)', icon: '🏧' },
  { id: 'fees',         name: 'Комиссии банка',      icon: '🏦' },
  { id: 'transfers',    name: 'Переводы',            icon: '🔁' },
  { id: 'income',       name: 'Доходы',              icon: '💰' },
  { id: 'other',        name: 'Прочее',              icon: '📦' },
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/* Правила сопоставления: подстрока ищется в описании транзакции,
   переведённом в верхний регистр. Порядок важен: более специфичные
   правила ("BOLT FOOD") стоят раньше общих ("BOLT"). */
const MERCHANT_RULES = [
  // ── Продукты ──
  { m: ['RIMI'],                       cat: 'groceries', name: 'Rimi' },
  { m: ['MAXIMA'],                     cat: 'groceries', name: 'Maxima' },
  { m: ['LIDL'],                       cat: 'groceries', name: 'Lidl' },
  { m: ['ELVI'],                       cat: 'groceries', name: 'Elvi' },
  { m: ['TOP!', 'VEIKALS TOP'],        cat: 'groceries', name: 'top!' },
  { m: ['MEGO'],                       cat: 'groceries', name: 'Mego' },
  { m: ['AIBE'],                       cat: 'groceries', name: 'Aibe' },
  { m: ['CITRO '],                     cat: 'groceries', name: 'Citro' },
  { m: ['GROSHIK'],                    cat: 'groceries', name: 'Groshik' },
  { m: ['STOCKMANN DELIKA', 'STOCKMANN PART'], cat: 'groceries', name: 'Stockmann Delikatese' },
  { m: ['LATS VEIKALS', ' LATS '],     cat: 'groceries', name: 'LaTS' },
  { m: ['BARBORA'],                    cat: 'groceries', name: 'Barbora' },
  { m: ['TIRGUS', 'CENTRALTIRGUS'],    cat: 'groceries', name: 'Рынок' },

  // ── Доставка еды (до общих Bolt/Wolt-подобных) ──
  { m: ['BOLT FOOD', 'BOLTFOOD'],      cat: 'delivery', name: 'Bolt Food' },
  { m: ['WOLT'],                       cat: 'delivery', name: 'Wolt' },
  { m: ['FOODOUT'],                    cat: 'delivery', name: 'Foodout' },

  // ── Кафе и рестораны ──
  { m: ['CAFFEINE'],                   cat: 'cafe', name: 'Caffeine' },
  { m: ['COSTA COFFEE'],               cat: 'cafe', name: 'Costa Coffee' },
  { m: ['STARBUCKS'],                  cat: 'cafe', name: 'Starbucks' },
  { m: ['MCDONALD', 'MCDRIVE'],        cat: 'cafe', name: "McDonald's" },
  { m: ['HESBURGER'],                  cat: 'cafe', name: 'Hesburger' },
  { m: ['KFC '],                       cat: 'cafe', name: 'KFC' },
  { m: ['LIDO'],                       cat: 'cafe', name: 'Lido' },
  { m: ['NARVESEN'],                   cat: 'cafe', name: 'Narvesen' },
  { m: ['DOUBLE COFFEE'],              cat: 'cafe', name: 'Double Coffee' },
  { m: ['ROCKET BEAN'],                cat: 'cafe', name: 'Rocket Bean' },
  { m: ['SUSHI', 'TOKYO CITY'],        cat: 'cafe', name: 'Суши' },
  { m: ['PIZZA', 'PICERIJA'],          cat: 'cafe', name: 'Пицца' },
  { m: ['KEBAB'],                      cat: 'cafe', name: 'Кебаб' },
  { m: ['RESTOR', 'RESTAUR', 'BISTRO', 'KAFEJNICA', 'KAFEJNĪCA', ' CAFE', 'CAFE '], cat: 'cafe', name: 'Кафе/ресторан' },
  { m: [' BARS ', ' BAR ', 'PUB '],    cat: 'cafe', name: 'Бар' },

  // ── Транспорт ──
  { m: ['BOLT DRIVE'],                 cat: 'transport', name: 'Bolt Drive' },
  { m: ['BOLT.EU', 'BOLT OPERATIONS', 'BOLT RIDE', 'BOLT '], cat: 'transport', name: 'Bolt' },
  { m: ['RIGAS SATIKSME', 'RĪGAS SATIKSME', 'RIGASSATIKSME'], cat: 'transport', name: 'Rīgas satiksme' },
  { m: ['MOBILLY'],                    cat: 'transport', name: 'Mobilly' },
  { m: ['CITYBEE'],                    cat: 'transport', name: 'CityBee' },
  { m: ['CARGURU'],                    cat: 'transport', name: 'CarGuru' },
  { m: ['FORAX', 'PANTERA TAXI', 'RED CAB', 'TAXI', 'TAKSI'], cat: 'transport', name: 'Такси' },
  { m: ['PASAZIERU VILCIENS', 'PASAŽIERU VILCIENS', 'VIVI '], cat: 'transport', name: 'Vivi (поезд)' },
  { m: ['ECOLINES', 'LUX EXPRESS'],    cat: 'transport', name: 'Междугородний автобус' },
  { m: ['EUROPARK', 'CITYPARKS', 'PARKING'], cat: 'transport', name: 'Парковка' },

  // ── Авто и топливо ──
  { m: ['CIRCLE K', 'CIRCLEK'],        cat: 'fuel', name: 'Circle K' },
  { m: ['NESTE'],                      cat: 'fuel', name: 'Neste' },
  { m: ['VIRSI', 'VIRŠI'],             cat: 'fuel', name: 'Virši' },
  { m: ['VIADA'],                      cat: 'fuel', name: 'Viada' },
  { m: ['GOTIKA AUTO', 'AUTOSERVISS', 'AUTO SERV'], cat: 'fuel', name: 'Автосервис' },
  { m: ['DEGVIELA', 'UZPILDES'],       cat: 'fuel', name: 'Заправка' },

  // ── Аптеки и здоровье ──
  { m: ['APOTHEKA'],                   cat: 'health', name: 'Apotheka' },
  { m: ['MENESS APTIEKA', 'MĒNESS APTIEKA'], cat: 'health', name: 'Mēness aptieka' },
  { m: ['BENU'],                       cat: 'health', name: 'BENU Aptieka' },
  { m: ['EUROAPTIEKA'],                cat: 'health', name: 'Euroaptieka' },
  { m: ['APTIEKA'],                    cat: 'health', name: 'Аптека' },
  { m: ['VESELIBAS CENTRS', 'VESELĪBAS CENTRS', 'ARS ', 'POLIKLINIKA'], cat: 'health', name: 'Медцентр' },
  { m: ['ZOBARST', 'DENTAL'],          cat: 'health', name: 'Стоматология' },
  { m: ['E. GULBJA', 'GULBJA LABORATORIJA', 'CENTRALA LABORATORIJA'], cat: 'health', name: 'Лаборатория' },

  // ── Красота ──
  { m: ['DROGAS'],                     cat: 'beauty', name: 'Drogas' },
  { m: ['DOUGLAS'],                    cat: 'beauty', name: 'Douglas' },
  { m: ['KRISTIANA'],                  cat: 'beauty', name: 'Kristiana' },
  { m: ['MADARA'],                     cat: 'beauty', name: 'Madara' },
  { m: ['FRIZETAVA', 'FRIZIER', 'SALONS', 'BEAUTY', 'MANIK'], cat: 'beauty', name: 'Салон' },

  // ── Одежда ──
  { m: ['H&M', 'H & M', 'HENNES'],     cat: 'clothes', name: 'H&M' },
  { m: ['ZARA'],                       cat: 'clothes', name: 'Zara' },
  { m: ['RESERVED'],                   cat: 'clothes', name: 'Reserved' },
  { m: ['SINSAY'],                     cat: 'clothes', name: 'Sinsay' },
  { m: ['CROPP'],                      cat: 'clothes', name: 'Cropp' },
  { m: ['MOHITO'],                     cat: 'clothes', name: 'Mohito' },
  { m: ['LINDEX'],                     cat: 'clothes', name: 'Lindex' },
  { m: ['NEW YORKER'],                 cat: 'clothes', name: 'New Yorker' },
  { m: ['HUMANA'],                     cat: 'clothes', name: 'Humana' },
  { m: ['VINTED'],                     cat: 'clothes', name: 'Vinted' },
  { m: ['ABOUT YOU'],                  cat: 'clothes', name: 'About You' },
  { m: ['ZALANDO'],                    cat: 'clothes', name: 'Zalando' },
  { m: ['DEICHMANN'],                  cat: 'clothes', name: 'Deichmann' },
  { m: ['CCC '],                       cat: 'clothes', name: 'CCC' },

  // ── Дом и быт ──
  { m: ['DEPO'],                       cat: 'home', name: 'Depo' },
  { m: ['K-SENUKAI', 'KSENUKAI', 'K SENUKAI'], cat: 'home', name: 'K-Senukai' },
  { m: ['JYSK'],                       cat: 'home', name: 'JYSK' },
  { m: ['IKEA'],                       cat: 'home', name: 'IKEA' },
  { m: ['KURSI '],                     cat: 'home', name: 'Kurši' },
  { m: ['TET VEIKALS'],                cat: 'home', name: 'Tet veikals' },
  { m: ['ZIEDU', 'FLOWERS'],           cat: 'home', name: 'Цветы' },

  // ── Электроника ──
  { m: ['RD ELECTRONICS', 'RDVEIKALS'],cat: 'electronics', name: 'RD Electronics' },
  { m: ['1A.LV', '1A LV'],             cat: 'electronics', name: '1a.lv' },
  { m: ['220.LV', '220 LV'],           cat: 'electronics', name: '220.lv' },
  { m: ['EURONICS'],                   cat: 'electronics', name: 'Euronics' },
  { m: ['DATEKS'],                     cat: 'electronics', name: 'Dateks' },
  { m: ['CAPITAL '],                   cat: 'electronics', name: 'Capital' },

  // ── Подписки и цифровое ──
  { m: ['SPOTIFY'],                    cat: 'subscriptions', name: 'Spotify' },
  { m: ['NETFLIX'],                    cat: 'subscriptions', name: 'Netflix' },
  { m: ['YOUTUBE', 'GOOGLE YOUTUBE'],  cat: 'subscriptions', name: 'YouTube Premium' },
  { m: ['GOOGLE ONE', 'GOOGLE STORAGE'], cat: 'subscriptions', name: 'Google One' },
  { m: ['GOOGLE*', 'GOOGLE PLAY'],     cat: 'subscriptions', name: 'Google Play' },
  { m: ['APPLE.COM/BILL', 'APPLE COM BILL', 'ITUNES'], cat: 'subscriptions', name: 'Apple' },
  { m: ['OPENAI', 'CHATGPT'],          cat: 'subscriptions', name: 'OpenAI' },
  { m: ['ANTHROPIC', 'CLAUDE.AI'],     cat: 'subscriptions', name: 'Anthropic (Claude)' },
  { m: ['PATREON'],                    cat: 'subscriptions', name: 'Patreon' },
  { m: ['DISNEY'],                     cat: 'subscriptions', name: 'Disney+' },
  { m: ['HBO ', 'MAX.COM'],            cat: 'subscriptions', name: 'HBO Max' },
  { m: ['DROPBOX'],                    cat: 'subscriptions', name: 'Dropbox' },
  { m: ['NOTION'],                     cat: 'subscriptions', name: 'Notion' },
  { m: ['CANVA'],                      cat: 'subscriptions', name: 'Canva' },
  { m: ['AMAZON PRIME'],               cat: 'subscriptions', name: 'Amazon Prime' },

  // ── Связь и интернет ──
  { m: ['LMT'],                        cat: 'telecom', name: 'LMT' },
  { m: ['TELE2'],                      cat: 'telecom', name: 'Tele2' },
  { m: ['BITE', 'BITĒ'],               cat: 'telecom', name: 'Bite' },
  { m: ['TET '],                       cat: 'telecom', name: 'Tet' },
  { m: ['BALTICOM'],                   cat: 'telecom', name: 'Balticom' },

  // ── Коммунальные ──
  { m: ['LATVENERGO', 'ELEKTRUM'],     cat: 'utilities', name: 'Elektrum' },
  { m: ['RIGAS NAMU', 'RĪGAS NAMU', 'NAMU PARVALDNIEKS'], cat: 'utilities', name: 'Rīgas namu pārvaldnieks' },
  { m: ['GASO', 'LATVIJAS GAZE', 'LATVIJAS GĀZE'], cat: 'utilities', name: 'Газ' },
  { m: ['RIGAS UDENS', 'RĪGAS ŪDENS'], cat: 'utilities', name: 'Rīgas ūdens' },
  { m: ['RIGAS SILTUMS', 'RĪGAS SILTUMS'], cat: 'utilities', name: 'Rīgas siltums' },
  { m: ['APSAIMNIEKO'],                cat: 'utilities', name: 'Управление домом' },

  // ── Развлечения ──
  { m: ['FORUM CINEMAS'],              cat: 'entertainment', name: 'Forum Cinemas' },
  { m: ['APOLLO KINO'],                cat: 'entertainment', name: 'Apollo Kino' },
  { m: ['KINO CITADELE'],              cat: 'entertainment', name: 'Kino Citadele' },
  { m: ['STEAM', 'STEAMGAMES'],        cat: 'entertainment', name: 'Steam' },
  { m: ['BILESU SERVISS', 'BIĻEŠU SERVISS', 'BEZRINDAS'], cat: 'entertainment', name: 'Билеты' },
  { m: ['DZINTARU KONCERT', 'OPERA'],  cat: 'entertainment', name: 'Концерты' },
  { m: ['ESCAPE ROOM', 'BOULINGS', 'BOWLING'], cat: 'entertainment', name: 'Развлечения' },

  // ── Спорт ──
  { m: ['MYFITNESS', 'MY FITNESS'],    cat: 'sport', name: 'MyFitness' },
  { m: ['LEMON GYM'],                  cat: 'sport', name: 'Lemon Gym' },
  { m: ['GYM!', 'GYMLATVIA'],          cat: 'sport', name: 'Gym!' },
  { m: ['FITNESS', 'SPORTA KLUBS'],    cat: 'sport', name: 'Фитнес' },
  { m: ['SPORTLAND', 'SPORTSDIRECT'],  cat: 'sport', name: 'Спорттовары' },

  // ── Питомцы ──
  { m: ['ZOOCENTRS', 'ZOO CENTRS', 'DINO ZOO', 'PETCITY', 'ZOOEXPRESS'], cat: 'pets', name: 'Зоомагазин' },
  { m: ['VETERINAR', 'VETCLINIC', 'VET '], cat: 'pets', name: 'Ветеринар' },

  // ── Путешествия ──
  { m: ['AIRBNB'],                     cat: 'travel', name: 'Airbnb' },
  { m: ['BOOKING.COM', 'BOOKING COM'], cat: 'travel', name: 'Booking.com' },
  { m: ['AIRBALTIC', 'AIR BALTIC'],    cat: 'travel', name: 'airBaltic' },
  { m: ['RYANAIR'],                    cat: 'travel', name: 'Ryanair' },
  { m: ['WIZZ AIR', 'WIZZAIR'],        cat: 'travel', name: 'Wizz Air' },
  { m: ['TALLINK', 'VIKING LINE'],     cat: 'travel', name: 'Паром' },
  { m: ['HOTEL', 'VIESNICA', 'VIESNĪCA', 'HOSTEL'], cat: 'travel', name: 'Отель' },

  // ── Банк: наличные, комиссии ──
  { m: ['IZNEMSANA', 'IZŅEMŠANA', 'SKAIDRAS NAUDAS', 'ATM ', 'CASH WITHDRAW', 'BANKOMAT'], cat: 'cash', name: 'Снятие наличных' },
  { m: ['KOMISIJA', 'KOMISIJAS MAKSA', 'MENESA MAKSA', 'MĒNEŠA MAKSA', 'KARTES MAKSA', ' FEE', 'SERVICE CHARGE', 'APKALPOSANAS MAKSA'], cat: 'fees', name: 'Комиссия банка' },

  // ── Переводы ──
  { m: ['PAYPAL'],                     cat: 'transfers', name: 'PayPal' },
  { m: ['REVOLUT TOP-UP', 'TOP-UP', 'TOP UP'], cat: 'transfers', name: 'Пополнение' },
  { m: ['PARSKAITIJUMS', 'PĀRSKAITĪJUMS', 'TRANSFER TO', 'PERVOD'], cat: 'transfers', name: 'Перевод' },
];

/* Ключевые слова доходов — применяются только к поступлениям (amount > 0) */
const INCOME_HINTS = ['ALGA', 'SALARY', 'DARBA SAMAKSA', 'ЗАРПЛАТА', 'AVANSS', 'DIVIDEN', 'ATMAKSA', 'REFUND', 'PROCENTI', 'INTEREST'];

/* Определить категорию и «чистое» имя мерчанта по описанию транзакции. */
function categorize(desc, amount) {
  const up = ' ' + String(desc || '').toUpperCase().replace(/\s+/g, ' ').trim() + ' ';

  for (const rule of MERCHANT_RULES) {
    for (const pat of rule.m) {
      if (up.includes(pat.toUpperCase())) {
        // для поступлений от мерчантов (возвраты) оставляем категорию мерчанта
        return { cat: rule.cat, merchant: rule.name };
      }
    }
  }

  if (amount > 0) {
    const isIncome = INCOME_HINTS.some(h => up.includes(h));
    return { cat: isIncome ? 'income' : 'transfers', merchant: extractMerchantName(desc) };
  }
  return { cat: 'other', merchant: extractMerchantName(desc) };
}

/* Достаём читаемое имя мерчанта из сырого описания:
   убираем маску карты, префикс PIRKUMS, даты и суммы. */
function extractMerchantName(desc) {
  let s = String(desc || '')
    .replace(/PIRKUMS\s*/gi, '')
    .replace(/\d{4,6}[X*]+\d{2,4}/gi, '')          // маска карты 5449xx...1234
    .replace(/\d{2}\.\d{2}\.\d{4}/g, '')            // даты
    .replace(/\d+[.,]\d{2}\s*(EUR|USD|GBP)?/gi, '') // суммы
    .replace(/\((\d{2}\.\d{2}\.\d{4}).*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'Без описания';
  const words = s.split(' ').slice(0, 4).join(' ');
  return words.length > 40 ? words.slice(0, 40) + '…' : words;
}
