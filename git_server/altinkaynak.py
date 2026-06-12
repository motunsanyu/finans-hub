import requests
import json
import logging

def fetch_altinkaynak_gold():
    """
    Altınkaynak API'sinden güncel altın fiyatlarını çeker.
    """
    url = "https://static.altinkaynak.com/public/Gold"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        # Eğer başarılıyla liste alındıysa döndür
        if isinstance(data, list) and len(data) > 0:
            return data
            
        return []
    except Exception as e:
        logging.error(f"Altinkaynak Gold API error: {e}")
        return []

if __name__ == "__main__":
    prices = fetch_altinkaynak_gold()
    print(f"Fetched {len(prices)} items.")
