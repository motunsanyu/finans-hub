import requests
from supabase import create_client, Client
import os
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "YOUR_SUPABASE_KEY")
LOGO_BUCKET = "borsa-logos"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_logo_url(supabase: Client, symbol: str) -> str | None:
    """
    TradingView CDN'inden hisse logosunu indirir ve Supabase Storage'a yükler.
    Zaten yüklenmişse doğrudan public URL'yi döner.
    """
    symbol_lower = symbol.lower()
    file_name = f"{symbol_lower}.svg"
    
    # Önce bucket'ta var mı diye kontrol et (gereksiz yeniden yüklemeyi önlemek için)
    try:
        existing = supabase.storage.from_(LOGO_BUCKET).list()
        existing_names = [f["name"] for f in existing] if existing else []
        if file_name in existing_names:
            public_url = supabase.storage.from_(LOGO_BUCKET).get_public_url(file_name)
            return public_url
    except Exception:
        pass  # Kontrol başarısız olursa yeniden yüklemeye devam et

    # TradingView CDN'inden logoyu dene (birkaç farklı URL formatı)
    logo_urls_to_try = [
        f"https://s3-symbol-logo.tradingview.com/turkey/{symbol_lower}--big.svg",
        f"https://s3-symbol-logo.tradingview.com/{symbol_lower}--big.svg",
    ]
    
    logo_content = None
    for logo_url in logo_urls_to_try:
        try:
            resp = requests.get(logo_url, headers=HEADERS, timeout=10)
            if resp.status_code == 200 and len(resp.content) > 100:
                logo_content = resp.content
                break
        except Exception:
            continue
    
    if not logo_content:
        return None
    
    # Supabase Storage'a yükle
    try:
        supabase.storage.from_(LOGO_BUCKET).upload(
            path=file_name,
            file=logo_content,
            file_options={"content-type": "image/svg+xml", "upsert": "true"}
        )
        public_url = supabase.storage.from_(LOGO_BUCKET).get_public_url(file_name)
        return public_url
    except Exception as e:
        print(f"  Logo upload error for {symbol}: {e}")
        return None


def scrape_borsa():
    url = "https://finans.mynet.com/borsa/canliborsa/?plist=finans-canliborsa-button"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

    text = response.text

    if '|_|' not in text:
        print("Could not find the data separator '|_|'. The page structure might have changed.")
        return []
        
    raw_items = text.split('|_|')
    data_list = []
    
    for item in raw_items:
        parts = item.split('|')
        if len(parts) >= 16:
            try:
                symbol = parts[13].strip()
                price = parts[1].strip()
                high = parts[2].strip()
                low = parts[3].strip()
                change = parts[4].strip()
                time_str = parts[5].strip()
                aof = parts[10].strip()
                vol_lot = parts[11].strip()
                vol_tl = parts[12].strip()
                link = parts[15].strip()
                
                if not link.startswith("http"):
                    link = "https://finans.mynet.com/" + link.lstrip("/")
                    
                if symbol and price:
                    data_list.append({
                        "symbol": symbol,
                        "name": symbol,
                        "price": price,
                        "change_percentage": change,
                        "time": time_str,
                        "detail_link": link,
                        "high": high,
                        "low": low,
                        "aof": aof,
                        "volume_lot": vol_lot,
                        "volume_tl": vol_tl,
                        "updated_at": "now()"
                    })
            except Exception as e:
                print(f"Error parsing item: {e}")
                continue

    return data_list


def fetch_existing_logos(supabase: Client) -> set:
    """Bucket'taki mevcut logo dosya isimlerini döner (tekrar yüklemeyi önler)."""
    try:
        files = supabase.storage.from_(LOGO_BUCKET).list()
        return {f["name"] for f in files} if files else set()
    except Exception as e:
        print(f"Could not list existing logos: {e}")
        return set()


def upload_logos(supabase: Client, data_list: list) -> dict:
    """
    Tüm hisseler için logoları indirir. 
    Zaten var olanları atlar, yeni olanları indirir ve yükler.
    {symbol: logo_url} dict döner.
    """
    print("Fetching existing logos from Supabase Storage...")
    existing_files = fetch_existing_logos(supabase)
    
    logo_map = {}
    base_public_url = f"{SUPABASE_URL}/storage/v1/object/public/{LOGO_BUCKET}/"
    
    # Zaten yüklenmiş olanları doğrudan ekle
    for item in data_list:
        symbol = item["symbol"]
        file_name = f"{symbol.lower()}.svg"
        if file_name in existing_files:
            logo_map[symbol] = base_public_url + file_name
    
    # Eksik olanları indir
    missing = [item for item in data_list if item["symbol"] not in logo_map]
    print(f"  {len(logo_map)} logos already exist. Downloading {len(missing)} new logos...")
    
    downloaded = 0
    failed = 0
    for item in missing:
        symbol = item["symbol"]
        symbol_lower = symbol.lower()
        file_name = f"{symbol_lower}.svg"
        
        logo_urls_to_try = [
            f"https://s3-symbol-logo.tradingview.com/turkey/{symbol_lower}--big.svg",
            f"https://s3-symbol-logo.tradingview.com/{symbol_lower}--big.svg",
        ]
        
        logo_content = None
        for logo_url in logo_urls_to_try:
            try:
                resp = requests.get(logo_url, headers=HEADERS, timeout=8)
                if resp.status_code == 200 and len(resp.content) > 100:
                    logo_content = resp.content
                    break
            except Exception:
                continue
        
        if logo_content:
            try:
                supabase.storage.from_(LOGO_BUCKET).upload(
                    path=file_name,
                    file=logo_content,
                    file_options={"content-type": "image/svg+xml", "upsert": "true"}
                )
                logo_map[symbol] = base_public_url + file_name
                downloaded += 1
            except Exception as e:
                print(f"  Upload error for {symbol}: {e}")
                failed += 1
        else:
            failed += 1
        
        # Sunuculara nazik ol
        time.sleep(0.05)
    
    print(f"  Downloaded: {downloaded}, Failed/No logo: {failed}")
    return logo_map


def update_supabase(data_list: list, logo_map: dict):
    if not SUPABASE_URL or not SUPABASE_KEY or SUPABASE_URL == "YOUR_SUPABASE_URL":
        print("Please configure SUPABASE_URL and SUPABASE_KEY.")
        return
        
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Logo URL'lerini ekle
        for item in data_list:
            symbol = item["symbol"]
            if symbol in logo_map:
                item["logo_url"] = logo_map[symbol]
        
        # Upsert in chunks
        chunk_size = 100
        for i in range(0, len(data_list), chunk_size):
            chunk = data_list[i:i + chunk_size]
            supabase.table("borsa_data").upsert(
                chunk,
                on_conflict="symbol"
            ).execute()
            time.sleep(0.1)
            
        print(f"Successfully updated {len(data_list)} records in Supabase.")
    except Exception as e:
        print(f"Error updating Supabase: {e}")


if __name__ == "__main__":
    print("=== Borsa Scraper ===")
    
    if SUPABASE_URL == "YOUR_SUPABASE_URL":
        print("ERROR: Please set SUPABASE_URL and SUPABASE_KEY environment variables.")
        exit(1)
    
    print("Step 1: Scraping Mynet Borsa data...")
    data = scrape_borsa()
    
    if not data:
        print("No data scraped. Exiting.")
        exit(1)
    
    print(f"  Scraped {len(data)} stocks.")
    
    print("Step 2: Uploading logos to Supabase Storage...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logo_map = upload_logos(supabase, data)
    
    print("Step 3: Updating Supabase database...")
    update_supabase(data, logo_map)
    
    print("=== Done! ===")
