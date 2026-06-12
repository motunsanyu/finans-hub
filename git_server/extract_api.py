import re

def extract():
    try:
        with open('index.js', 'r', encoding='utf-8') as f:
            text = f.read()
        
        urls = re.findall(r'https?://[^\s\"\'\`]+', text)
        apis = [u for u in set(urls) if 'api' in u.lower() or 'altinkaynak' in u.lower()]
        
        # also print paths like /api/...
        paths = re.findall(r'[\"\']/api/[^\s\"\'\`]+[\"\']', text)
        
        print("URLs:", apis)
        print("Paths:", set(paths))
    except Exception as e:
        print(e)

if __name__ == "__main__":
    extract()
