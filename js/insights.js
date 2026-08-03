/* Советы по оптимизации: считаются локально из уже категоризированных
   данных — без ИИ и без сети. Каждый совет строится только тогда,
   когда цифры его подкрепляют (нет данных — нет совета), чтобы не
   превращаться в шаблонные банальности. */

function computeInsights(txs, allTxs) {
  const insights = [];
  const expenses = txs.filter(isExpense);
  const totalSpent = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (!totalSpent) return insights;

  const byCat = {};
  for (const t of expenses) {
    byCat[t.cat] = byCat[t.cat] || { value: 0, count: 0 };
    byCat[t.cat].value += Math.abs(t.amount);
    byCat[t.cat].count++;
  }

  // 1. Самая крупная статья расходов
  const catRanked = Object.entries(byCat).sort((a, b) => b[1].value - a[1].value);
  if (catRanked.length) {
    const [catId, v] = catRanked[0];
    const share = Math.round(v.value / totalSpent * 100);
    if (share >= 20) {
      insights.push({
        icon: CATEGORY_BY_ID[catId].icon,
        title: `${CATEGORY_BY_ID[catId].name} — самая крупная статья`,
        text: `${fmtEur(v.value, 2)} (${share}% расходов). Сократи на 10% — сэкономишь ${fmtEur(v.value * 0.1, 2)} в месяц.`,
      });
    }
  }

  // 2. Заметный рост категории месяц к месяцу (по всем данным, не по фильтру)
  const monthCat = {};
  for (const t of allTxs) {
    if (!isExpense(t)) continue;
    monthCat[t.month] = monthCat[t.month] || {};
    monthCat[t.month][t.cat] = (monthCat[t.month][t.cat] || 0) + Math.abs(t.amount);
  }
  const months = Object.keys(monthCat).sort();
  if (months.length >= 2) {
    const last = months[months.length - 1], prev = months[months.length - 2];
    let biggest = null;
    for (const catId of Object.keys(monthCat[last])) {
      const cur = monthCat[last][catId], before = monthCat[prev][catId] || 0;
      const delta = cur - before;
      if (delta > 0 && (!biggest || delta > biggest.delta)) biggest = { catId, delta, cur, before };
    }
    if (biggest && biggest.before > 0 && biggest.delta / biggest.before >= 0.25 && biggest.delta >= 15) {
      const pct = Math.round(biggest.delta / biggest.before * 100);
      insights.push({
        icon: '📈',
        title: `${CATEGORY_BY_ID[biggest.catId].name}: рост на ${pct}%`,
        text: `${monthLabel(prev)} → ${monthLabel(last)}: ${fmtEur(biggest.before, 2)} → ${fmtEur(biggest.cur, 2)}.`,
      });
    }
  }

  // 3. Подписки — стоит свериться, все ли ещё нужны
  const subs = byCat['subscriptions'];
  if (subs && subs.value > 0) {
    insights.push({
      icon: '📱',
      title: 'Подписки и цифровые сервисы',
      text: `${fmtEur(subs.value, 2)} за период, ${subs.count} списаний. Стоит проверить — всё ли ещё нужно.`,
    });
  }

  // 4. Комиссии банка — чистая потеря без выгоды
  const fees = byCat['fees'];
  if (fees && fees.value > 0) {
    insights.push({
      icon: '🏦',
      title: 'Комиссии банка',
      text: `${fmtEur(fees.value, 2)} ушло на обслуживание счёта — возможно, есть тариф или банк без этой комиссии.`,
    });
  }

  // 5. Доставка vs самостоятельные покупки
  const delivery = byCat['delivery'];
  const groceries = byCat['groceries'];
  if (delivery && delivery.value > 0) {
    const avgDelivery = delivery.value / delivery.count;
    let text = `${fmtEur(delivery.value, 2)} за ${delivery.count} заказ(ов), в среднем ${fmtEur(avgDelivery, 2)} за раз.`;
    if (groceries && groceries.value > 0) {
      const avgGrocery = groceries.value / groceries.count;
      text += ` Один поход в магазин обходится в среднем в ${fmtEur(avgGrocery, 2)}.`;
    }
    insights.push({ icon: '🛵', title: 'Доставка еды', text });
  }

  // 6. Кафе — частота посещений
  const cafe = byCat['cafe'];
  if (cafe && cafe.count >= 5) {
    const avg = cafe.value / cafe.count;
    insights.push({
      icon: '☕',
      title: `Кафе — ${cafe.count} раз за период`,
      text: `В среднем ${fmtEur(avg, 2)} за визит, всего ${fmtEur(cafe.value, 2)}.`,
    });
  }

  // 7. Наличные — слепая зона: куда ушли дальше, аппка не видит
  const cash = byCat['cash'];
  if (cash && cash.value > 0) {
    const share = Math.round(cash.value / totalSpent * 100);
    if (share >= 10) {
      insights.push({
        icon: '🏧',
        title: 'Много снятий наличных',
        text: `${fmtEur(cash.value, 2)} (${share}%) снято наличными — что куплено дальше, из выписки не видно.`,
      });
    }
  }

  return insights;
}

/* Советы по продуктовой корзине (данные из чеков, а не из банковской выписки) */
function computeProductInsights(receipts) {
  const insights = [];
  if (!receipts || !receipts.length) return insights;

  const byCat = {};
  let total = 0;
  for (const r of receipts) {
    for (const it of r.items) {
      if (it.price <= 0) continue;
      byCat[it.cat] = (byCat[it.cat] || 0) + it.price;
      total += it.price;
    }
  }
  if (!total) return insights;

  const share = catId => Math.round((byCat[catId] || 0) / total * 100);

  if (byCat.alcohol && share('alcohol') >= 10) {
    insights.push({
      icon: PRODUCT_CATEGORY_BY_ID.alcohol.icon,
      title: `Алкоголь — ${share('alcohol')}% продуктовой корзины`,
      text: `${fmtEur(byCat.alcohol, 2)} из ${fmtEur(total, 2)} по разобранным чекам.`,
    });
  }
  if (byCat.sweets && share('sweets') >= 12) {
    insights.push({
      icon: PRODUCT_CATEGORY_BY_ID.sweets.icon,
      title: `Сладости и снеки — ${share('sweets')}%`,
      text: `${fmtEur(byCat.sweets, 2)} из ${fmtEur(total, 2)} продуктовой корзины.`,
    });
  }
  if (byCat.ready && share('ready') >= 10) {
    insights.push({
      icon: PRODUCT_CATEGORY_BY_ID.ready.icon,
      title: `Готовая еда из магазина — ${share('ready')}%`,
      text: `${fmtEur(byCat.ready, 2)} — обычно дороже, чем приготовить самой из тех же продуктов.`,
    });
  }

  return insights;
}
