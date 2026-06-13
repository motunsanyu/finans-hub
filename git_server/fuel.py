"""
fuel.py — doviz.com/akaryakit-fiyatlari'ndan yakıt fiyatlarını çeker.
Marka, Benzin 95, Motorin ve LPG fiyatlarını döndürür.
"""
import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9",
}

FUEL_URL = "https://www.doviz.com/akaryakit-fiyatlari"

# İstasyon isimlerini normalize et
BRAND_ALIASES = {
    "petrol ofisi": "Petrol Ofisi",
    "opet": "Opet",
    "shell": "Shell",
    "total": "Total",
    "aytemiz": "Aytemiz",
    "bp": "BP",
    "lukoil": "Lukoil",
    "kadoil": "Kadoil",
    "aygaz": "Aygaz",
    "milangaz": "Milangaz",
    "ipragaz": "İpragaz",
}


def _parse_price(raw: str) -> float | None:
    """'₺63,08' veya 'TL63,08' gibi string'i float'a çevirir."""
    if not raw or raw.strip() == "-":
        return None
    cleaned = raw.replace("₺", "").replace("TL", "").replace("\u20ba", "").strip()
    cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def fetch_fuel_prices() -> list[dict]:
    """
    doviz.com'dan yakıt fiyatlarını çeker.
    Döndürülen liste: [
        {"marka": "Petrol Ofisi", "benzin": 63.03, "motorin": 66.41, "lpg": 31.99},
        ...
    ]
    """
    try:
        resp = requests.get(FUEL_URL, headers=HEADERS, timeout=12)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[fuel] HTTP hatası: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("table tbody tr")

    results = []
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 4:
            continue

        marka_raw = cols[0].get_text(strip=True)
        benzin_raw = cols[1].get_text(strip=True)
        motorin_raw = cols[2].get_text(strip=True)
        lpg_raw = cols[3].get_text(strip=True) if len(cols) > 3 else "-"

        marka = BRAND_ALIASES.get(marka_raw.lower(), marka_raw)

        results.append({
            "marka": marka,
            "benzin": _parse_price(benzin_raw),
            "motorin": _parse_price(motorin_raw),
            "lpg": _parse_price(lpg_raw),
        })

    print(f"[fuel] {len(results)} marka fiyatı çekildi.")
    return results


if __name__ == "__main__":
    import json
    data = fetch_fuel_prices()
    print(json.dumps(data, ensure_ascii=False, indent=2))
