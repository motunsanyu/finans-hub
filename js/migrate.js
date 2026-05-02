// js/migrate.js
// Mevcut localStorage verilerini Supabase'e taşır.
// Sadece giriş yapan kullanıcı için, bir kereye mahsus çalıştırması önerilir.

(async () => {
  if (!window._supabaseClient) {
    console.warn('Supabase bağlantısı yok, taşıma başlatılamadı.');
    return;
  }

  const sb = window._supabaseClient;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const uid = user.id;

  // 1) fuel_records
  const fuel = JSON.parse(localStorage.getItem('financeApp.fuelRecords') || '[]');
  if (fuel.length) {
    const formatted = fuel.map(r => ({
      user_id: uid,
      date: r.date,
      amount: r.amount,
      km: r.km,
      price: r.price
    }));
    await sb.from('fuel_records').upsert(formatted);
  }

  // 2) day_records
  const days = JSON.parse(localStorage.getItem('financeApp.dayRecords') || '[]');
  if (days.length) {
    const formatted = days.map(r => ({
      user_id: uid,
      title: r.title,
      end_date: r.end,
      created_at: new Date(r.created).toISOString()
    }));
    await sb.from('day_records').upsert(formatted);
  }

  // 3) vault_records
  const vault = JSON.parse(localStorage.getItem('financeApp.vault') || '[]');
  if (vault.length) {
    const formatted = vault.map(r => ({
      user_id: uid,
      date: r.date,
      title: r.title,
      amount: r.amount,
      type: r.type,
      linked_rec_id: r.linkedRecId || null
    }));
    await sb.from('vault_records').upsert(formatted);
  }

  // 4) debts
  const debts = JSON.parse(localStorage.getItem('financeApp.debts') || '{}');
  await sb.from('debts').upsert({
    user_id: uid,
    usd: debts.usd || 0,
    eur: debts.eur || 0,
    gold: debts.gold || 0,
    btc: debts.btc || 0,
    try: debts.try || 0
  });

  // 5) school plans + records
  const school = JSON.parse(localStorage.getItem('financeApp.schoolRecords') || '[]');
  for (const plan of school) {
    const { data: insertedPlan } = await sb.from('school_plans').insert({
      user_id: uid,
      name: plan.name,
      total_debt: plan.totalDebt
    }).select('id').single();

    if (insertedPlan && plan.records) {
      const records = plan.records.map(r => ({
        plan_id: insertedPlan.id,
        no: r.no,
        due_date: r.dueDate,
        amount: r.amount,
        paid: r.paid
      }));
      await sb.from('school_records').upsert(records);
    }
  }

  console.log('✅ Veriler Supabase’e taşındı!');
  // Başarılı taşımadan sonra localStorage’ı temizleyebilirsiniz (istemezseniz dokunmayın)
  // localStorage.clear();
})();