export async function onRequest(context) {
  // We specify TWO sources to increase success rate
  const sources = [
    "https://www.altinkaynakkuyumculuk.com/Altin/Kur/Guncel",
    "https://www.altinkaynak.com/altin/kur/guncel"
  ];
  
  let html = "";
  let errorMsg = "";

  for (let url of sources) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cache-Control": "no-cache"
          },
          redirect: "follow"
        });
        
        if (response.ok) {
            html = await response.text();
            if (html.length > 1000) break; // Success
        } else {
            errorMsg += ` Source ${url} returned ${response.status}. `;
        }
      } catch (e) {
        errorMsg += ` Source ${url} error: ${e.message}. `;
      }
  }

  if (!html) {
      return new Response(JSON.stringify({ error: "ALL SOURCES BLOCKED: " + errorMsg }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
  }

  try {
    const perakendeSplit = html.split('Perakende Altın');
    const targetHtml = perakendeSplit.length > 1 ? perakendeSplit[1] : html;

    const results = {};
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

    const output = {
      gram24: results["24 Ayar Has"] || results["Has Toptan"] || results["Has Altın"] || results["Gram Altın"] || {buy:"--", sell:"--"},
      bilezik22: results["22 Ayar Bilezik"] || {buy:"--", sell:"--"},
      ceyrek: results["Çeyrek Altın"] || {buy:"--", sell:"--"},
      ata: results["Cumhuriyet Altını"] || results["Ata Cumhuriyet"] || {buy:"--", sell:"--"},
      ons: results["Ons Altın"] || {buy:"0", sell:"0"},
      updated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(output), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Parsing error: " + error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
