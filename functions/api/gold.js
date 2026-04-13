export async function onRequest(context) {
  // ahmetilhn logic: Target the main portal with a fallback proxy to bypass datacenter blocks
  const targetUrl = "https://www.altinkaynak.com/altin/kur/guncel";
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
  
  try {
    const response = await fetch(proxyUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    
    if (!response.ok) throw new Error("Proxy bağlantısı başarısız.");
    
    const wrapper = await response.json();
    const html = wrapper.contents; // allorigins returns HTML inside 'contents'
    
    if (!html || html.length < 500) throw new Error("Kaynak siteden boş veri döndü (Bloklanmış olabilir).");

    const results = {};
    // ahmetilhn/altin-fiyatlari-api is based on '.rate-row.with-input'
    // We replicate this with a highly targeted regex for that specific class structure
    const regex = /<div class="rate-row with-input\s*".*?<div class="pair"[^>]*?>\s*(.*?)\s*<\/div>.*?<div class="value ">([\d.,]+)<\/div>.*?<div class="value ">([\d.,]+)<\/div>/gs;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1].replace(/<[^>]*>?/gm, '').trim();
      const buy = match[2].trim();
      const sell = match[3].trim();
      if (name && buy && sell) {
        results[name] = { buy, sell };
      }
    }

    const output = {
      gram24: results["Gram Altın"] || results["Has Toptan"] || results["24 Ayar Has"] || {buy:"--", sell:"--"},
      bilezik22: results["22 Ayar Bilezik"] || {buy:"--", sell:"--"},
      ceyrek: results["Çeyrek Altın"] || {buy:"--", sell:"--"},
      ata: results["Cumhuriyet Altını"] || results["Ata Cumhuriyet"] || {buy:"--", sell:"--"},
      ons: results["Ons Altın"] || {buy:"0", sell:"0"},
      source: "Altınkaynak (GitHub Repo Mantığı)",
      updated_at: new Date().toISOString()
    };

    if (output.gram24.buy === "--") throw new Error("Veriler ayrıştırılamadı. Repo mantığı eşleşmiyor.");

    return new Response(JSON.stringify(output), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Sistem Hatası: " + error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
