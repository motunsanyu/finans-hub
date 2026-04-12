export async function onRequest(context) {
  // Altinkaynak retail prices page
  const url = "https://www.altinkaynakkuyumculuk.com/Altin/Kur/Guncel";
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: "Source site blocked or inaccessible: " + response.status }), { status: 200, headers: {"Content-Type":"application/json"} });
    }
    
    const html = await response.text();
    const results = {};

    // More robust regex: finds the pair container and spans to the value divs
    // Pattern: <div class="pair">NAME</div> ... <div class="value">BUY</div> ... <div class="value">SELL</div>
    const regex = /<div class="pair"[^>]*?>\s*(.*?)\s*<\/div>.*?<div class="value\s*[^"]*?">\s*([\d.,]+)\s*<\/div>.*?<div class="value\s*[^"]*?">\s*([\d.,]+)\s*<\/div>/gs;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1].replace(/<[^>]*>?/gm, '').trim();
      const buy = match[2].trim();
      const sell = match[3].trim();
      results[name] = { buy, sell };
    }

    const output = {
      gram24: results["Gram Altın"] || results["Has Toptan"] || results["Has Altın"] || {buy:"--", sell:"--"},
      bilezik22: results["22 Ayar Bilezik"] || {buy:"--", sell:"--"},
      ceyrek: results["Çeyrek Altın"] || {buy:"--", sell:"--"},
      ata: results["Ata Cumhuriyet"] || results["Ata Toptan"] || {buy:"--", sell:"--"},
      ons: results["Ons Altın"] || {buy:"--", sell:"--"},
      debug_total_found: Object.keys(results).length,
      updated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(output), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store" 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Scraper error: " + error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
