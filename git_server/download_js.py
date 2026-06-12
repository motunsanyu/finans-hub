import requests

def fetch_js():
    url = "https://www.altinkaynakkuyumculuk.com/assets/index-CjUJXjIg.js"
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    with open("index.js", "w", encoding="utf-8") as f:
        f.write(res.text)
    print("Saved index.js")

if __name__ == "__main__":
    fetch_js()
