export async function onRequest(context) {
  // Use the main portal which is often more up-to-date and bot-friendly
  const url = "https://www.altinkaynak.com/altin/kur/guncel";
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });
    
    if (!response.ok) throw new Error("Kaynak siteye erişilemedi: Status " + response.status);
    
    const html = await response.text();
    
    // Isolate the "Perakende Altın" table to avoid wholesale/simulation confusion
    const sections = html.split('Perakende Altın');
    if (sections.length < 2) throw new Error("Perakende Altın tablosu sayfada bulunamadı.");
    const targetHtml = sections[1].split('</table>')[0]; // Get the first table after the title

    const results = {};
    // This regex looks for: <div class="pair">NAME</div> ... <div class="value ">SELL</div> ... <div class="value ">BUY</div>
    // Note: On the retail table, values are often sell/buy
    const regex = /<div class="pair"[^>]*?>\s*(.*?)\s*<\/div>.*?<div class="value\s*[^"]*?">\s*([\d.,]+)\s*<\/div>.*?<div class="value\s*[^"]*?">\s*([\d.,]+)\s*<\/div>/gs;
    
    let match;
    while ((match = regex.exec(targetHtml)) !== null) {
      const name = match[1].replace(/<[^>]*>?/gm, '').trim();
      const val1 = match[2].trim();
      const val2 = match[3].trim();
      // On retail table, usually the second value is the sell price (higher)
      if (name && val1 && val2) {
        results[name] = { buy: val1, sell: val2 };
      }
    }

    const output = {
      gram24: results["Gram Altın"] || results["24 Ayar Has"] || results["Has Altın"] || {buy:"--", sell:"--"},
      bilezik22: results["22 Ayar Bilezik"] || {buy:"--", sell:"--"},
      ceyrek: results["Çeyrek Altın"] || {buy:"--", sell:"--"},
      ata: results["Cumhuriyet Altını"] || results["Ata Cumhuriyet"] || {buy:"--", sell:"--"},
      ons: results["Ons Altın"] || {buy:"0", sell:"0"},
      source: "Altınkaynak Perakende",
      updated_at: new Date().toISOString()
    };

    if (output.gram24.buy === "--") throw new Error("Veriler ayrıştırılamadı. Format değişmiş olabilir.");

    return new Response(JSON.stringify(output), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Altınkaynak Hatası: " + error.message }), {
      status: 200, // Keep 200 so the frontend can read the JSON error
      headers: { "Content-Type": "application/json" }
    });
  }
}
