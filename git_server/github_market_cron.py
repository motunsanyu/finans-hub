import datetime as dt
import os
import sys
from typing import Any

import requests

from market import fetch_market_snapshot
from news import fetch_top_news
from altinkaynak import fetch_altinkaynak_gold
from fuel import fetch_fuel_prices
from scrape_borsa import scrape_borsa, update_supabase
from scrape_klines import fetch_and_upsert_klines_async


DEFAULT_TABLE = "market_snapshots"
MAX_ROWS = 10          # market_snapshots için max kayıt
MAX_FUEL_ROWS = 2      # fuel_prices için max kayıt
FUEL_TABLE = "fuel_prices"


def _env(name: str, *, required: bool = True, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if required and not value:
        raise RuntimeError(f"{name} environment variable is required.")
    return str(value).strip()


def _clean_supabase_url(raw: str) -> str:
    return raw.rstrip("/")


def _build_payload(snapshot: dict[str, Any], news_data: list[dict[str, str]], altin_data: list[dict[str, str]]) -> dict[str, Any]:
    # Türkiye Saati (UTC+3) için zaman dilimi ayarı
    tr_tz = dt.timezone(dt.timedelta(hours=3))
    return {
        "fetched_at": dt.datetime.now(tr_tz).isoformat(),
        "source": "www.doviz.com",
        "usd_try": snapshot.get("usd_try"),
        "usd_try_change": snapshot.get("usd_try_change"),
        "usd_status": snapshot.get("usd_status"),
        "eur_try": snapshot.get("eur_try"),
        "eur_try_change": snapshot.get("eur_try_change"),
        "eur_status": snapshot.get("eur_status"),
        "gram_gold_try": snapshot.get("gram_gold_try"),
        "gram_gold_change": snapshot.get("gram_gold_change"),
        "gold_status": snapshot.get("gold_status"),
        "bist100": snapshot.get("bist100"),
        "bist100_change": snapshot.get("bist100_change"),
        "bist_status": snapshot.get("bist_status"),
        "silver_try": snapshot.get("silver_try"),
        "silver_try_change": snapshot.get("silver_try_change"),
        "silver_status": snapshot.get("silver_status"),
        "brent": snapshot.get("brent"),
        "brent_change": snapshot.get("brent_change"),
        "brent_status": snapshot.get("brent_status"),
        "news": news_data,
        "altin_prices": altin_data,
    }


def _get_headers(supabase_key: str) -> dict:
    return {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _insert_supabase_row(payload: dict[str, Any]) -> None:
    """market_snapshots tablosuna INSERT atar, max 10 kayıt tutar."""
    supabase_url = _clean_supabase_url(_env("SUPABASE_URL"))
    supabase_key = _env("SUPABASE_KEY")
    table = _env("SUPABASE_TABLE", required=False, default=DEFAULT_TABLE)
    endpoint = f"{supabase_url}/rest/v1/{table}"

    # INSERT
    response = requests.post(
        endpoint,
        headers=_get_headers(supabase_key),
        json=payload,
        timeout=20,
    )
    if response.status_code not in {200, 201, 204}:
        raise RuntimeError(
            f"Supabase insert failed: HTTP {response.status_code} - {response.text}"
        )

    # Eski kayıtları temizle — sadece son MAX_ROWS kaydı tut
    _trim_old_rows(supabase_url, supabase_key, table, MAX_ROWS)


def _trim_old_rows(supabase_url: str, supabase_key: str, table: str, max_rows: int) -> None:
    """Tabloda max_rows'dan fazla kayıt varsa en eskileri siler."""
    headers = _get_headers(supabase_key)

    # Toplam kayıt sayısını al
    count_resp = requests.get(
        f"{supabase_url}/rest/v1/{table}?select=id&order=id.asc",
        headers={**headers, "Prefer": "count=exact"},
        timeout=15,
    )
    total = int(count_resp.headers.get("content-range", "0/0").split("/")[-1] or 0)

    if total <= max_rows:
        return

    # Silinecek kayıt sayısı
    delete_count = total - max_rows

    # En eski N kaydın ID'lerini al
    rows_resp = requests.get(
        f"{supabase_url}/rest/v1/{table}?select=id&order=id.asc&limit={delete_count}",
        headers=headers,
        timeout=15,
    )
    rows = rows_resp.json()
    ids = [str(r["id"]) for r in rows if "id" in r]
    if not ids:
        return

    # Sil
    del_resp = requests.delete(
        f"{supabase_url}/rest/v1/{table}?id=in.({','.join(ids)})",
        headers=headers,
        timeout=15,
    )
    if del_resp.status_code in {200, 204}:
        print(f"[trim] {table}: {len(ids)} eski kayıt silindi, {max_rows} kayıt kaldı.")
    else:
        print(f"[trim] Silme hatası: HTTP {del_resp.status_code} - {del_resp.text}")


def _upsert_fuel_prices(fuel_data: list[dict]) -> None:
    """
    fuel_prices tablosuna yakıt verilerini yazar.
    Tabloda sadece son MAX_FUEL_ROWS (2) kayıt kalır.
    """
    if not fuel_data:
        print("[fuel] Veri yok, atlanıyor.")
        return

    supabase_url = _clean_supabase_url(_env("SUPABASE_URL"))
    supabase_key = _env("SUPABASE_KEY")
    headers = _get_headers(supabase_key)

    tr_tz = dt.timezone(dt.timedelta(hours=3))
    payload = {
        "fetched_at": dt.datetime.now(tr_tz).isoformat(),
        "prices": fuel_data,
    }

    endpoint = f"{supabase_url}/rest/v1/{FUEL_TABLE}"

    # INSERT
    resp = requests.post(endpoint, headers=headers, json=payload, timeout=20)
    if resp.status_code not in {200, 201, 204}:
        raise RuntimeError(f"Fuel insert failed: HTTP {resp.status_code} - {resp.text}")

    print(f"[fuel] fuel_prices tablosuna {len(fuel_data)} marka yazıldı.")

    # Eski kayıtları temizle — sadece son MAX_FUEL_ROWS kalır
    _trim_old_rows(supabase_url, supabase_key, FUEL_TABLE, MAX_FUEL_ROWS)


def main() -> int:
    snapshot = fetch_market_snapshot()
    news_data = fetch_top_news(limit=5)
    altin_data = fetch_altinkaynak_gold()
    fuel_data = fetch_fuel_prices()

    # market_snapshots tablosunu güncelle
    payload = _build_payload(snapshot, news_data, altin_data)
    _insert_supabase_row(payload)

    # fuel_prices tablosunu güncelle (max 2 kayıt)
    _upsert_fuel_prices(fuel_data)

    # borsa_data tablosunu güncelle
    borsa_data = scrape_borsa()
    if borsa_data:
        update_supabase(borsa_data)

    # borsa_klines (grafik) geçmiş verilerini arka planda güncelle (timeout olmasin)
    try:
        fetch_and_upsert_klines_async()
    except Exception as e:
        print(f"[klines] Grafik verisi başlatılamadı: {e}")

    print(
        "Market snapshot saved:",
        {
            "fetched_at": payload["fetched_at"],
            "usd_try": payload["usd_try"],
            "eur_try": payload["eur_try"],
            "gram_gold_try": payload["gram_gold_try"],
            "bist100": payload["bist100"],
            "fuel_brands": len(fuel_data),
        },
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
