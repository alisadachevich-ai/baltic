/* Демо-данные: ~3 месяца правдоподобных трат в Риге,
   чтобы посмотреть аппку без загрузки настоящей выписки. */

function generateDemoData() {
  // детерминированный генератор, чтобы демо всегда выглядело одинаково
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + rnd() * (b - a);

  const today = new Date();
  const txs = [];
  const add = (daysAgo, desc, amount) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    txs.push({
      date: d,
      month: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      desc, amount: Math.round(amount * 100) / 100, currency: 'EUR', source: 'demo',
    });
  };

  const groceries = [
    ['PIRKUMS 5449xx...1234 RIMI LIDLS 1085 RIGA', -8, -45],
    ['PIRKUMS 5449xx...1234 MAXIMA XX RIGA', -6, -38],
    ['PIRKUMS 5449xx...1234 LIDL RIGA BRIVIBAS', -10, -32],
    ['PIRKUMS 5449xx...1234 ELVI VEIKALS RIGA', -4, -15],
  ];
  const cafes = [
    ['PIRKUMS 5449xx...1234 CAFFEINE LV RIGA', -3.5, -7.5],
    ['PIRKUMS 5449xx...1234 LIDO ORIGO RIGA', -9, -18],
    ['PIRKUMS 5449xx...1234 ROCKET BEAN ROASTERY RIGA', -4, -9],
    ['PIRKUMS 5449xx...1234 NARVESEN 123 RIGA', -2, -6],
  ];

  for (let day = 0; day < 92; day++) {
    // продукты: примерно через день
    if (rnd() < 0.55) { const g = pick(groceries); add(day, g[0], between(g[2], g[1])); }
    // кофе/кафе
    if (rnd() < 0.4) { const c = pick(cafes); add(day, c[0], between(c[2], c[1])); }
    // Bolt / транспорт
    if (rnd() < 0.25) add(day, 'BOLT.EU/O/2407 TALLINN', -between(4, 12));
    if (rnd() < 0.2) add(day, 'PIRKUMS 5449xx...1234 MOBILLY RIGA', -between(1, 4));
    // Wolt по выходным
    if (day % 7 < 2 && rnd() < 0.5) add(day, 'WOLT RIGA', -between(14, 28));
    // аптека, красота, разное
    if (rnd() < 0.08) add(day, 'PIRKUMS 5449xx...1234 MENESS APTIEKA RIGA', -between(6, 25));
    if (rnd() < 0.06) add(day, 'PIRKUMS 5449xx...1234 DROGAS AKROPOLE RIGA', -between(8, 30));
    if (rnd() < 0.05) add(day, 'PIRKUMS 5449xx...1234 SINSAY AKROPOLE RIGA', -between(12, 45));
    if (rnd() < 0.04) add(day, 'PIRKUMS 5449xx...1234 DEPO KRASTA RIGA', -between(10, 60));
    if (rnd() < 0.04) add(day, 'PIRKUMS 5449xx...1234 DINO ZOO PASAULE RIGA', -between(8, 35));
    if (rnd() < 0.03) add(day, 'PIRKUMS 5449xx...1234 APOLLO KINO AKROPOLE', -between(8, 16));
  }

  // ежемесячные платежи
  for (let m = 0; m < 3; m++) {
    const base = m * 30 + 2;
    add(base, 'LMT ABONESANAS MAKSA', -19.99);
    add(base + 1, 'SPOTIFY P2ABC123 STOCKHOLM', -6.99);
    add(base + 2, 'NETFLIX.COM AMSTERDAM', -12.99);
    add(base + 3, 'ANTHROPIC CLAUDE.AI SAN FRANCISCO', -21.78);
    add(base + 5, 'RIGAS NAMU PARVALDNIEKS REKINS', -between(85, 140));
    add(base + 6, 'ELEKTRUM LATVENERGO REKINS', -between(30, 55));
    add(base + 8, 'MYFITNESS ABONEMENTS RIGA', -39.99);
    add(base + 10, 'KOMISIJAS MAKSA PAR KONTA APKALPOSANU', -2.5);
    add(base + 12, 'SKAIDRAS NAUDAS IZNEMSANA ATM SWEDBANK', -50);
    // зарплата
    add(base + 1, 'DARBA ALGA SIA UZNEMUMS', between(1450, 1650));
    // ипотека, страховка, налоги — не бытовые траты, считаются отдельно
    add(base + 3, 'HIPOTEKARAIS KREDITA MAKSAJUMS SWEDBANK', -420);
    add(base + 4, 'BALTA APDROSINASANA OCTA', -18.5);
    // между своими счетами — откладываю на накопительный счёт
    add(base + 2, 'PARSKAITIJUMS ALISA DACEVICA UZKRAJUMU KONTS', -100);
    // семья
    add(base + 7, 'PARSKAITIJUMS VALENTINA DACHEVICH', -50);
  }
  add(35, 'RIGAS VALSTSPILSETAS PASVALDIBA NIN', -34);
  add(80, 'PARSKAITIJUMS VALENTINA DACHEVICH DZIMSANAS DIENA', 30);
  // разовые
  add(20, 'AIRBALTIC RIGA TICKETS', -89.99);
  add(45, 'BOOKING.COM HOTEL VILNIUS', -124);
  add(70, 'PIRKUMS 5449xx...1234 RD ELECTRONICS RIGA', -159.99);

  return txs;
}
