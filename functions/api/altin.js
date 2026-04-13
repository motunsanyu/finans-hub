export async function onRequest(context) {
  try {
    // Truncgil API v4 - Stable Financial Data Source
    const res = await fetch('https://finans.truncgil.com/v4/today.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    
    if (!res.ok) throw new Error("Kaynak sunucu yanıt vermedi: " + res.status);
    
    const data = await res.json();

    const result = {
      kaynak: 'Truncgil Finans',
      guncelleme: new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      veriler: {
        gram_altin:     { alis: data['gram-altin']?.Buying,  satis: data['gram-altin']?.Selling,  degisim: data['gram-altin']?.Change },
        ceyrek_altin:   { alis: data['ceyrek-altin']?.Buying, satis: data['ceyrek-altin']?.Selling, degisim: data['ceyrek-altin']?.Change },
        yarim_altin:    { alis: data['yarim-altin']?.Buying,  satis: data['yarim-altin']?.Selling,  degisim: data['yarim-altin']?.Change },
        tam_altin:      { alis: data['tam-altin']?.Buying,    satis: data['tam-altin']?.Selling,    degisim: data['tam-altin']?.Change },
        ata_cumhuriyet: { alis: data['ata-altin']?.Buying,    satis: data['ata-altin']?.Selling,    degisim: data['ata-altin']?.Change },
        bilezik_22:     { alis: data['22-ayar-bilezik']?.Buying, satis: data['22-ayar-bilezik']?.Selling, degisim: data['22-ayar-bilezik']?.Change },
        altin_ons:      { alis: data['altin-ons']?.Buying,    satis: data['altin-ons']?.Selling,    degisim: data['altin-ons']?.Change },
      }
    };

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 200, // Return 200 so app.js can show the message gracefully
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
