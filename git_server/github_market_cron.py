import datetime as dt
import os
import sys
from typing import Any

import requests

from market import fetch_market_snapshot


DEFAULT_TABLE = "market_snapshots"


def _env(name: str, *, required: bool = True, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if required and not value:
        raise RuntimeError(f"{name} environment variable is required.")
    return str(value).strip()


def _clean_supabase_url(raw: str) -> str:
    return raw.rstrip("/")


def _build_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
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
    }


def _insert_supabase_row(payload: dict[str, Any]) -> None:
    supabase_url = _clean_supabase_url(_env("SUPABASE_URL"))
    supabase_key = _env("SUPABASE_KEY")
    table = _env("SUPABASE_TABLE", required=False, default=DEFAULT_TABLE)
    endpoint = f"{supabase_url}/rest/v1/{table}"

    response = requests.post(
        endpoint,
        headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=payload,
        timeout=20,
    )
    if response.status_code not in {200, 201, 204}:
        raise RuntimeError(
            f"Supabase insert failed: HTTP {response.status_code} - {response.text}"
        )


def main() -> int:
    snapshot = fetch_market_snapshot()
    payload = _build_payload(snapshot)
    _insert_supabase_row(payload)
    print(
        "Market snapshot saved:",
        {
            "fetched_at": payload["fetched_at"],
            "usd_try": payload["usd_try"],
            "eur_try": payload["eur_try"],
            "gram_gold_try": payload["gram_gold_try"],
            "bist100": payload["bist100"],
            "silver_try": payload["silver_try"],
            "brent": payload["brent"],
        },
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
