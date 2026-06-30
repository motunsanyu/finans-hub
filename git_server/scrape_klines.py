import os
import sys
import datetime as dt
import requests
import json
import yfinance as yf

def _env(name: str, *, required: bool = True, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if required and not value:
        raise RuntimeError(f"{name} environment variable is required.")
    return str(value).strip()

def _clean_supabase_url(raw: str) -> str:
    return raw.rstrip("/")

def _get_headers(supabase_key: str) -> dict:
    return {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

def get_symbols_from_supabase(supabase_url: str, supabase_key: str) -> list[str]:
    endpoint = f"{supabase_url}/rest/v1/borsa_data?select=symbol"
    resp = requests.get(endpoint, headers=_get_headers(supabase_key), timeout=20)
    if resp.status_code != 200:
        print(f"Error fetching symbols: {resp.status_code} - {resp.text}")
        return []
    
    data = resp.json()
    symbols = [row["symbol"] for row in data if "symbol" in row]
    return symbols

def fetch_and_upsert_klines():
    supabase_url = _clean_supabase_url(_env("SUPABASE_URL"))
    supabase_key = _env("SUPABASE_KEY")
    
    print("Supabase'den semboller çekiliyor...")
    symbols = get_symbols_from_supabase(supabase_url, supabase_key)
    
    if not symbols:
        print("Hisse sembolü bulunamadı.")
        return

    print(f"Toplam {len(symbols)} sembol bulundu. Geçmiş veriler indiriliyor...")
    
    # Yahoo Finance için sonlarına .IS ekleyelim
    yf_symbols = [f"{s}.IS" for s in symbols]
    
    # Çoklu indirme (son 6 ay = 130 civarı iş günü)
    # yfinance bulk download dönerken DataFrame multi-index dönüyor.
    # Group_by ticker kullanarak daha kolay ayırabiliriz.
    data = yf.download(tickers=" ".join(yf_symbols), period="6mo", interval="1d", group_by="ticker", threads=True, progress=False)
    
    tr_tz = dt.timezone(dt.timedelta(hours=3))
    now_iso = dt.datetime.now(tr_tz).isoformat()
    
    upsert_payload = []
    
    for symbol in symbols:
        yf_sym = f"{symbol}.IS"
        
        try:
            # Tek sembol çekildiğinde DataFrame yapısı farklı olur, 
            # çoklu sembol çekildiğinde farklı. Bunu handle edelim.
            if len(symbols) == 1:
                df = data
            else:
                if yf_sym not in data.columns.levels[0]:
                    continue
                df = data[yf_sym]
                
            df = df.dropna(subset=['Close'])
            if df.empty:
                continue
                
            klines = []
            for date_idx, row in df.iterrows():
                # Timestamp'i saniye cinsinden alıyoruz
                timestamp = int(date_idx.timestamp())
                klines.append({
                    "time": timestamp,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"]) if "Volume" in row and not import_pandas_isna(row["Volume"]) else 0
                })
            
            if klines:
                upsert_payload.append({
                    "symbol": symbol,
                    "klines": klines,
                    "updated_at": now_iso
                })
                
        except Exception as e:
            print(f"Hata ({symbol}): {e}")
            continue

    if not upsert_payload:
        print("Kaydedilecek geçerli kline verisi bulunamadı.")
        return

    print(f"{len(upsert_payload)} hisse için veriler Supabase'e gönderiliyor...")
    
    # Bulk UPSERT işlemi (100'erli gruplar halinde)
    endpoint = f"{supabase_url}/rest/v1/borsa_klines"
    headers = _get_headers(supabase_key)
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    
    batch_size = 50
    for i in range(0, len(upsert_payload), batch_size):
        batch = upsert_payload[i:i+batch_size]
        resp = requests.post(endpoint, headers=headers, json=batch, timeout=30)
        if resp.status_code not in {200, 201, 204}:
            print(f"Upsert hatası (Batch {i}): HTTP {resp.status_code} - {resp.text}")
        else:
            print(f"Batch {i} - {i+len(batch)} başarıyla yüklendi.")
            
    print("Veri aktarımı tamamlandı!")

def import_pandas_isna(val):
    import pandas as pd
    return pd.isna(val)

if __name__ == "__main__":
    fetch_and_upsert_klines()
