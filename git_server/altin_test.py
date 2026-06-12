import requests

def fetch_altinkaynak():
    url = "https://www.altinkaynakkuyumculuk.com/Altin/Kur/Guncel"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        with open("altin_source.html", "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print("Saved source to altin_source.html")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_altinkaynak()
