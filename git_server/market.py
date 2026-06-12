import requests
from bs4 import BeautifulSoup
from typing import Any

def fetch_market_snapshot() -> dict[str, Any]:
    url = "https://www.doviz.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching data from doviz.com: {e}")
        return {}

    soup = BeautifulSoup(response.text, "html.parser")
    snapshot = {}
    
    # Doviz.com ana sayfasındaki borsa/döviz kutularını parse edeceğiz.
    # Yapısı genelde <div class="item"> içinde span.value ve span.name şeklindedir.
    # Örnek yapılar için doviz.com'un class isimlerini (örn: value, name, up/down) baz alıyoruz.
    
    items = soup.find_all("div", class_="item")
    for item in items:
        name_tag = item.find("span", class_="name")
        value_tag = item.find("span", class_="value")
        
        # Değişim yüzdesi genelde up, down veya neutral sınıfına sahip span'lerde bulunur
        change_tag = item.find("div", class_="change-rate") or item.find("span", class_="change-rate") or item.find("div", class_="change")
        status = "neutral"
        if change_tag:
            if "up" in change_tag.get("class", []):
                status = "up"
            elif "down" in change_tag.get("class", []):
                status = "down"
            change_text = change_tag.text.strip()
        else:
            change_text = "%0,00"

        if not name_tag or not value_tag:
            continue
            
        name = name_tag.text.strip().upper()
        
        # Sayıları düzeltmek için (örn: 32,1543 -> 32.1543 veya $63.680 -> 63680.0)
        raw_val = value_tag.text.strip().replace("$", "").replace("₺", "").replace("€", "").replace(".", "").replace(",", ".")
        try:
            val = float(raw_val)
        except ValueError:
            val = None

        if "DOLAR" in name:
            snapshot["usd_try"] = val
            snapshot["usd_try_change"] = change_text
            snapshot["usd_status"] = status
        elif "EURO" in name:
            snapshot["eur_try"] = val
            snapshot["eur_try_change"] = change_text
            snapshot["eur_status"] = status
        elif "GRAM ALTIN" in name:
            snapshot["gram_gold_try"] = val
            snapshot["gram_gold_change"] = change_text
            snapshot["gold_status"] = status
        elif "BIST 100" in name:
            snapshot["bist100"] = val
            snapshot["bist100_change"] = change_text
            snapshot["bist_status"] = status
        elif "GÜMÜŞ" in name or "GÜMÜ" in name:
            snapshot["silver_try"] = val
            snapshot["silver_try_change"] = change_text
            snapshot["silver_status"] = status
        elif "BRENT" in name:
            snapshot["brent"] = val
            snapshot["brent_change"] = change_text
            snapshot["brent_status"] = status

    return snapshot
