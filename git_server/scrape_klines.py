"""
scrape_klines.py
----------------
BIST hisselerinin son 200 günlük OHLCV geçmiş verilerini
Yahoo Finance REST API üzerinden çeker ve Supabase'e UPSERT eder.

• yfinance kütüphanesi KULLANILMAZ — sadece requests
• Her hisse için tabloda tek satır tutulur (upsert), tablo asla kabarmaz.
• /cron endpoint'ini bloke etmemek için thread'de çalışır.
"""

import os
import time
import datetime as dt
import requests
import json
import threading

# ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

def _env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if not value:
        raise RuntimeError(f"{name} environment variable is required.")
    return str(value).strip()

def _supabase_headers(key: str, upsert: bool = False) -> dict:
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if upsert:
        h["Prefer"] = "resolution=merge-duplicates,return=minimal"
    else:
        h["Prefer"] = "return=minimal"
    return h

# ─── Supabase: Sembol Listesi ─────────────────────────────────────────────────

def get_symbols(supabase_url: str, key: str) -> list[str]:
    """borsa_data tablosundan mevcut sembol listesini çeker."""
    url = f"{supabase_url}/rest/v1/borsa_data?select=symbol"
    resp = requests.get(url, headers=_supabase_headers(key), timeout=20)
    if resp.status_code != 200:
        print(f"[klines] Sembol listesi alınamadı: {resp.status_code} {resp.text[:200]}")
        return []
    return [r["symbol"] for r in resp.json() if "symbol" in r]

# ─── Yahoo Finance: Tek Sembol OHLCV ─────────────────────────────────────────

_YF_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_HEADERS_YF = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
}

def fetch_yahoo_klines(symbol_bist: str, period: str = "200d") -> list[dict] | None:
    """
    Tek bir BIST sembolü için Yahoo Finance'dan günlük OHLCV çeker.
    Dönen liste: [{"time": unix_ts, "open": ..., "high": ..., "low": ..., "close": ..., "volume": ...}]
    Hata veya veri yoksa None döner.
    """
    ticker = f"{symbol_bist}.IS"
    url = _YF_URL.format(ticker=ticker)
    params = {"interval": "1d", "range": "200d"}

    try:
        resp = requests.get(url, headers=_HEADERS_YF, params=params, timeout=15)
        if resp.status_code != 200:
            return None
        body = resp.json()
        result = body.get("chart", {}).get("result")
        if not result:
            return None
        result = result[0]
        timestamps = result.get("timestamp", [])
        quote = result.get("indicators", {}).get("quote", [{}])[0]
        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        klines = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            if c is None:
                continue
            klines.append({
                "time": int(ts),
                "open": round(float(opens[i]), 4) if i < len(opens) and opens[i] is not None else round(float(c), 4),
                "high": round(float(highs[i]), 4) if i < len(highs) and highs[i] is not None else round(float(c), 4),
                "low": round(float(lows[i]), 4) if i < len(lows) and lows[i] is not None else round(float(c), 4),
                "close": round(float(c), 4),
                "volume": int(volumes[i]) if i < len(volumes) and volumes[i] is not None else 0,
            })
        return klines if klines else None

    except Exception as e:
        print(f"[klines] Yahoo çekme hatası ({symbol_bist}): {e}")
        return None

# ─── Supabase: Batch Upsert ───────────────────────────────────────────────────

def upsert_batch(payload: list[dict], supabase_url: str, key: str):
    endpoint = f"{supabase_url}/rest/v1/borsa_klines"
    resp = requests.post(
        endpoint,
        headers=_supabase_headers(key, upsert=True),
        json=payload,
        timeout=30,
    )
    if resp.status_code not in {200, 201, 204}:
        print(f"[klines] Upsert hatası: HTTP {resp.status_code} - {resp.text[:300]}")
    else:
        print(f"[klines] {len(payload)} hisse başarıyla yüklendi.")

# ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

def fetch_and_upsert_klines():
    """
    Tüm BIST sembollerini Supabase'den alır, Yahoo Finance'dan klines çeker,
    borsa_klines tablosuna UPSERT eder. Tablo hiçbir zaman kabarmaz.
    """
    try:
        supabase_url = _env("SUPABASE_URL").rstrip("/")
        supabase_key = _env("SUPABASE_KEY")
    except RuntimeError as e:
        print(f"[klines] Yapılandırma hatası: {e}")
        return

    print("[klines] Semboller alınıyor...")
    symbols = get_symbols(supabase_url, supabase_key)
    if not symbols:
        print("[klines] İşlenecek sembol bulunamadı.")
        return

    print(f"[klines] {len(symbols)} sembol için Yahoo Finance'dan veri çekiliyor...")
    tr_tz = dt.timezone(dt.timedelta(hours=3))
    now_iso = dt.datetime.now(tr_tz).isoformat()

    batch = []
    BATCH_SIZE = 50

    for idx, symbol in enumerate(symbols, 1):
        klines = fetch_yahoo_klines(symbol)
        if klines:
            batch.append({
                "symbol": symbol,
                "klines": klines,
                "updated_at": now_iso,
            })

        # Her 50 hissede bir yükle
        if len(batch) >= BATCH_SIZE:
            upsert_batch(batch, supabase_url, supabase_key)
            batch = []
            time.sleep(0.5)  # Yahoo rate-limit için küçük bekleme

        # Her sembolde 0.1s bekle (Yahoo'yu aşırı yüklememek için)
        time.sleep(0.1)

        if idx % 50 == 0:
            print(f"[klines] {idx}/{len(symbols)} tamamlandı...")

    # Kalan kayıtları gönder
    if batch:
        upsert_batch(batch, supabase_url, supabase_key)

    print("[klines] Tüm kline verileri başarıyla güncellendi.")


def fetch_and_upsert_klines_async():
    """
    fetch_and_upsert_klines'ı arka planda (thread) çalıştırır.
    /cron endpoint'ini bloke etmez.
    """
    t = threading.Thread(target=fetch_and_upsert_klines, daemon=True)
    t.start()
    print("[klines] Grafik verisi güncelleme işlemi arka planda başlatıldı.")


if __name__ == "__main__":
    fetch_and_upsert_klines()
