export async function onRequest(context) {
  const sources = [
    { url: "https://static.altinkaynak.com/public/Gold", type: "json" },
    { url: "https://www.altinkaynak.com/altin/kur/guncel", type: "html" }
  ];
  
  let finalResults = null;
  let lastError = "";

  for (const src of sources) {
    try {
      const response = await fetch(src.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" },
        timeout: 5000
      });
      
      if (!response.ok) continue;

      if (src.type === "json") {
          const data = await response.json();
          const results = {};
          if (Array.isArray(data)) {
              data.forEach(item => {
                  const name = item.Description || item.Name || "";
                  results[name] = { 
                      buy: (item.Buy || item.Alis || "0").toString().replace('.', ','), 
                      sell: (item.Sell || item.Satis || "0").toString().replace('.', ',')
                  };
              });
              if (results["Gram Altın"]) { finalResults = results; break; }
          }
      } else {
          const html = await response.text();
          const sections = html.split('Perakende Altın');
          const target = sections.length > 1 ? sections[1] : html;
          const results = {};
          const regex = /<div class="pair"[^>]*?>\s*(.*?)\s*<\/div>.*?<div class="value ">([\d.,]+)<\/div>.*?<div class="value ">([\d.,]+)<\/div>/gs;
          let match;
          while ((match = regex.exec(target)) !== null) {
              results[match[1].replace(/<[^>]*>?/gm, '').trim()] = { buy: match[2].trim(), sell: match[3].trim() };
          }
          if (results["Gram Altın"] || results["24 Ayar Has"]) { finalResults = results; break; }
      }
    } catch (e) {
      lastError += src.url + ": " + e.message + ". ";
    }
  }

  if (!finalResults) {
    return new Response(JSON.stringify({ error: "Tüm kaynaklar engellendi veya ulaşılamıyor. " + lastError }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const output = {
    gram24: finalResults["Gram Altın"] || finalResults["24 Ayar Has"] || finalResults["Has Altın"] || {buy:"--", sell:"--"},
    bilezik22: finalResults["22 Ayar Bilezik"] || {buy:"--", sell:"--"},
    ceyrek: finalResults["Çeyrek Altın"] || {buy:"--", sell:"--"},
    ata: finalResults["Cumhuriyet Altını"] || finalResults["Ata Cumhuriyet"] || {buy:"--", sell:"--"},
    ons: finalResults["Ons Altın"] || {buy:"0", sell:"0"},
    updated_at: new Date().toISOString()
  };

  return new Response(JSON.stringify(output), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
