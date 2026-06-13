import requests
from bs4 import BeautifulSoup
import json

def test_doviz_fuel():
    url = "https://www.doviz.com/akaryakit-fiyatlari"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        rows = soup.select("table tbody tr")
        results = []
        for row in rows[:10]:
            cols = row.find_all("td")
            cols_text = [c.get_text(strip=True).replace("\u20ba", "TL") for c in cols]
            results.append(cols_text)
            
        with open("fuel_test.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print("Done")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_doviz_fuel()
