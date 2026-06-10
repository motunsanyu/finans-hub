export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Eksik URL parametresi." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cf: { cacheTtl: 300 } // Cloudflare tarafında 5 dk önbellek
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Hedef URL'den Hata: ${response.status}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const contentType = response.headers.get("Content-Type");
    const body = await response.text();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType || "text/plain",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "max-age=300"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy Hatası: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
