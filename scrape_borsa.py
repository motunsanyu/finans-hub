import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import os
import time

# To run this script, set SUPABASE_URL and SUPABASE_KEY environment variables,
# or replace them below (not recommended for security).
SUPABASE_URL = os.environ.get("SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "YOUR_SUPABASE_KEY")

def scrape_borsa():
    url = "https://finans.mynet.com/borsa/canliborsa/?plist=finans-canliborsa-button"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

    soup = BeautifulSoup(response.content, "html.parser")
    
    # Mynet canlı borsa table structure:
    # Usually it's in a table, or a list.
    # We need to find the rows containing stock data.
    # Looking for table rows or specific list items. Let's look for tr with data-symbol or typical class.
    
    data_list = []
    
    table_rows = soup.select("tbody tr")
    for row in table_rows:
        try:
            # typical columns in Mynet
            cols = row.find_all("td")
            if len(cols) < 5:
                continue
            
            symbol_tag = row.select_first("td.text-left a")
            if not symbol_tag:
                continue
                
            symbol = symbol_tag.text.strip()
            detail_link = symbol_tag.get("href", "")
            if detail_link and not detail_link.startswith("http"):
                detail_link = "https://finans.mynet.com" + detail_link
                
            # Price is usually the second or third column
            # In mynet it's typically: 1: Hisse, 2: Son, 3: Alış, 4: Satış, 5: %Fark, 6: Zaman
            price_tag = cols[1] # Son (Last Price)
            change_tag = cols[4] # %Fark
            time_tag = cols[5] # Zaman
            
            price = price_tag.text.strip() if price_tag else ""
            change = change_tag.text.strip() if change_tag else ""
            time_str = time_tag.text.strip() if time_tag else ""
            
            if symbol and price:
                data_list.append({
                    "symbol": symbol,
                    "name": symbol, # Since name is often not separated or it's the symbol itself
                    "price": price,
                    "change_percentage": change,
                    "time": time_str,
                    "detail_link": detail_link,
                    "updated_at": "now()"
                })
        except Exception as e:
            print(f"Error parsing row: {e}")
            continue

    return data_list

def update_supabase(data_list):
    if not SUPABASE_URL or not SUPABASE_KEY or SUPABASE_URL == "YOUR_SUPABASE_URL":
        print("Please configure SUPABASE_URL and SUPABASE_KEY.")
        return
        
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        for item in data_list:
            # Upsert by symbol
            supabase.table("borsa_data").upsert(
                item,
                on_conflict="symbol"
            ).execute()
            
        print(f"Successfully updated {len(data_list)} records in Supabase.")
    except Exception as e:
        print(f"Error updating Supabase: {e}")

if __name__ == "__main__":
    print("Starting Borsa scraping...")
    data = scrape_borsa()
    if data:
        print(f"Scraped {len(data)} stocks. Updating Supabase...")
        update_supabase(data)
    else:
        print("No data scraped.")
