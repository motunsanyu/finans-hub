export async function onRequest(context) {
  // Ultra-stable JSON endpoint from static.altinkaynak.com
  const url = "https://static.altinkaynak.com/public/Gold";
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) throw new Error("Static API access failed: " + response.status);
    
    // Expecting JSON data directly
    const data = await response.json();
    
    // Altinkaynak Static JSON usually returns an array of objects
    // Finding keys: Gram Altın, 22 Ayar, Çeyrek etc.
    const results = {};
    if (Array.isArray(data)) {
        data.forEach(item => {
            const name = item.Description || item.Name || "";
            results[name] = { 
                buy: (item.Buy || item.Alis || "0").toString().replace('.', ','), 
                sell: (item.Sell || item.Satis || "0").toString().replace('.', ',')
            };
        });
    }

    const output = {
      gram24: results["Gram Altın"] || results["Has Toptan"] || {buy:"--", sell:"--"},
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
    return new Response(JSON.stringify({ error: "Static API Error: " + error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
