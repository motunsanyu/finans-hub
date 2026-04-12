export async function onRequest(context) {
  const url = "https://www.altinkaynakkuyumculuk.com/Altin/Kur/Guncel";
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.google.com/"
      }
    });
    
    if (!response.ok) throw new Error("Connection failed: " + response.status);
    
    let html = await response.text();
    
    // Perakende Altın bölümünü izole et (Toptan kısmını atlamış oluruz)
    const perakendeSplit = html.split('Perakende Altın');
    const targetHtml = perakendeSplit.length > 1 ? perakendeSplit[1] : html;

    const results = {};
    // Altinkaynak specific pattern parsing
    const regex = /<div class="pair"[^>]*?>\s*(.*?)\s*<\/div>.*?<div class="value ">([\d.,]+)<\/div>.*?<div class="value ">([\d.,]+)<\/div>/gs;
    
    let match;
    while ((match = regex.exec(targetHtml)) !== null) {
      const name = match[1].replace(/<[^>]*>?/gm, '').trim();
      const buy = match[2].trim();
      const sell = match[3].trim();
      if (name && buy && sell) {
        results[name] = { buy, sell };
      }
    }

    // Map to specific categories requested by user
    const output = {
      gram24: results["24 Ayar Has"] || results["Has Altın"] || results["Gram Altın"] || {buy:"--", sell:"--"},
      bilezik22: results["22 Ayar Bilezik"] || {buy:"--", sell:"--"},
      ceyrek: results["Çeyrek Altın"] || {buy:"--", sell:"--"},
      ata: results["Cumhuriyet Altını"] || results["Ata Cumhuriyet"] || {buy:"--", sell:"--"},
      ons: results["Ons Altın"] || {buy:"0", sell:"0"},
      updated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(output), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
