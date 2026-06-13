"""
fuel.py — doviz.com/akaryakit-fiyatlari'ndan şehir/ilçeye özel yakıt fiyatlarını çeker.
Her ilçe için ayrı URL'den veri çekip city key -> [marka listesi] şeklinde döndürür.
"""
import requests
from bs4 import BeautifulSoup
import time

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9",
}

BASE_URL = "https://www.doviz.com/akaryakit-fiyatlari"

# Frontend dropdown value -> (il slug, ilçe slug) for doviz.com URL
CITIES = {
    "konya-selcuklu":       ("konya",           "selcuklu"),
    "ankara-cankaya":       ("ankara",           "cankaya"),
    "istanbul-arnavutkoy":  ("istanbul-avrupa",  "arnavutkoy"),
    "izmir-aliaga":         ("izmir",            "aliaga"),
    "antalya-konyaalti":    ("antalya",          "konyaalti"),
}


def _parse_price(raw: str) -> float | None:
    """'₺65,01' gibi string'i float'a çevirir."""
    if not raw or raw.strip() in ("-", ""):
        return None
    cleaned = (
        raw.replace("₺", "")
           .replace("TL", "")
           .replace("\u20ba", "")
           .strip()
           .replace(".", "")
           .replace(",", ".")
    )
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def _scrape_city(il: str, ilce: str) -> list[dict]:
    """Belirli bir il/ilçe için fiyat listesini döndürür."""
    url = f"{BASE_URL}/{il}/{ilce}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[fuel] {url} HTTP hatası: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("table tbody tr")

    results = []
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 3:
            continue
        marka = cols[0].get_text(strip=True)
        benzin  = _parse_price(cols[1].get_text(strip=True) if len(cols) > 1 else "")
        motorin = _parse_price(cols[2].get_text(strip=True) if len(cols) > 2 else "")
        lpg     = _parse_price(cols[3].get_text(strip=True) if len(cols) > 3 else "")
        if marka:
            results.append({"marka": marka, "benzin": benzin, "motorin": motorin, "lpg": lpg})

    return results


def fetch_fuel_prices() -> dict[str, list[dict]]:
    """
    Tüm şehirler için fiyat verisi döndürür.
    Döndürülen yapı:
    {
        "konya-selcuklu":      [{"marka": "Petrol Ofisi", "benzin": 65.01, ...}, ...],
        "ankara-cankaya":      [...],
        "istanbul-arnavutkoy": [...],
        "izmir-aliaga":        [...],
        "antalya-konyaalti":   [...],
    }
    """
    all_data = {}
    for city_key, (il, ilce) in CITIES.items():
        prices = _scrape_city(il, ilce)
        all_data[city_key] = prices
        print(f"[fuel] {city_key}: {len(prices)} marka çekildi.")
        time.sleep(0.5)  # sunucuyu yormamak için kısa bekleme

    return all_data


if __name__ == "__main__":
    import json
    data = fetch_fuel_prices()
    print(json.dumps(data, ensure_ascii=False, indent=2))
