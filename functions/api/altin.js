export async function onRequest(context) {
  try {
    // Attempt to fetch with a very clean header
    const response = await fetch('https://finans.truncgil.com/v4/today.json', {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json'
      },
      cf: { cacheTtl: 60 } // Cache for 60 seconds at edge
    });
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: `Kaynak Sitede Hata: ${response.status}` }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
    
    const data = await response.json();

    const output = {
      kaynak: 'Truncgil Finans',
      guncelleme: new Date().toLocaleTimeString('tr-TR'),
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

    return new Response(JSON.stringify(output), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=60'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "İletişim Hattı Kesildi: " + e.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
