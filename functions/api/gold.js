export async function onRequest(context) {
  const url = "https://www.altinkaynakkuyumculuk.com/Altin/Kur/Guncel";
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    
    if (!response.ok) throw new Error("Altinkaynak access failed");
    
    const html = await response.text();
    const results = {};

    const regex = /<div class="pair"[^>]*?>(.*?)<\/div>.*?<div class="value ">([\d.,]+)<\/div><div class="value ">([\d.,]+)<\/div>/gs;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1].trim();
      const buy = match[2].trim();
      const sell = match[3].trim();
      results[name] = { buy, sell };
    }

    const output = {
      gram24: results["Gram Altın"] || results["Has Toptan"] || {buy:"0", sell:"0"},
      bilezik22: results["22 Ayar Bilezik"] || {buy:"0", sell:"0"},
      ceyrek: results["Çeyrek Altın"] || {buy:"0", sell:"0"},
      ata: results["Ata Cumhuriyet"] || {buy:"0", sell:"0"},
      ons: results["Ons Altın"] || {buy:"0", sell:"0"},
      updated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(output), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
