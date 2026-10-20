with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    } catch (err) {
      console.warn("TradingView BIST100 canlı verisi alınamadı:", err);
    }
  }"""

replacement = """    } catch (err) {
      console.warn("TradingView BIST100 canlı verisi alınamadı:", err);
    }

    // CORS takılmasına karşı Yahoo Finance yedek kaynağı (Proxy üzerinden)
    if (!nextSnapshot.bist100 || !nextSnapshot.bist100.price) {
      try {
        const raw = await fetchWithProxy('https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS');
        if (raw) {
          const parsed = JSON.parse(raw);
          const meta = parsed?.chart?.result?.[0]?.meta;
          if (meta && meta.regularMarketPrice) {
            const p = meta.regularMarketPrice;
            const prev = meta.chartPreviousClose || p;
            const chg = prev ? ((p - prev) / prev) * 100 : 0;
            nextSnapshot.bist100 = { price: p, change: chg };
          }
        }
      } catch (err) {
        console.warn("Yahoo Finance BIST100 proxy verisi alınamadı:", err);
      }
    }
  }"""

if target.replace('\\r\\n', '\\n') in text:
    text = text.replace(target.replace('\\r\\n', '\\n'), replacement.replace('\\r\\n', '\\n'))
elif target.replace('\\n', '\\r\\n') in text:
    text = text.replace(target.replace('\\n', '\\r\\n'), replacement.replace('\\n', '\\r\\n'))
else:
    # simple replace
    text = text.replace(target, replacement)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS")
