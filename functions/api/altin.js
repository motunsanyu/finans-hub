export async function onRequest(context) {
  try {
    const response = await fetch('https://static.altinkaynak.com/public/Gold', {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      },
      cf: { cacheTtl: 60 } 
    });
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: `Kaynak Sitede Hata: ${response.status}` }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: response.status
        });
    }
    
    const data = await response.json();

    return new Response(JSON.stringify({
      kaynak: 'Altınkaynak',
      guncelleme: new Date().toLocaleTimeString('tr-TR'),
      veriler: data
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=60'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "İletişim Hattı Kesildi: " + e.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500
    });
  }
}
