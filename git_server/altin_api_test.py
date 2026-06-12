import requests

def test_api():
    url = "https://static.altinkaynak.com/public/Gold"
    try:
        res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        print("Status:", res.status_code)
        if res.status_code == 200:
            print("Success:", res.text[:500])
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_api()
