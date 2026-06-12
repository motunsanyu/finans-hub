import requests
import bs4

def fetch_top_news(limit: int = 5) -> list[dict[str, str]]:
    """
    Fetches the top news from Sozcu RSS feed.
    Visits each article link to extract the og:image and og:description.
    """
    rss_url = "https://www.sozcu.com.tr/rss/tum-haberler.xml"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        response = requests.get(rss_url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = bs4.BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Failed to fetch RSS: {e}")
        return []

    items = soup.find_all('item')
    news_list = []
    
    for item in items[:limit]:
        title = item.title.text.strip() if item.title else ""
        link_tag = item.find('link')
        link = ""
        if link_tag and link_tag.next_sibling and isinstance(link_tag.next_sibling, str):
            link = link_tag.next_sibling.strip()
            
        if not link and item.find('guid'):
            link = item.find('guid').text.strip()
            
        if not title or not link:
            continue
            
        # Extract details from the article page
        image_url = ""
        description = ""
        try:
            article_resp = requests.get(link, headers=headers, timeout=10)
            if article_resp.status_code == 200:
                article_soup = bs4.BeautifulSoup(article_resp.text, 'html.parser')
                
                # Extract og:image
                og_image = article_soup.find('meta', property='og:image')
                if og_image:
                    image_url = og_image.get('content', '')
                    
                # Extract og:description
                og_desc = article_soup.find('meta', property='og:description')
                if og_desc:
                    description = og_desc.get('content', '')
        except Exception as e:
            print(f"Failed to fetch article details for {link}: {e}")
            
        news_list.append({
            "title": title,
            "link": link,
            "image": image_url,
            "description": description
        })
        
    return news_list

if __name__ == "__main__":
    import json
    print(json.dumps(fetch_top_news(2), indent=2, ensure_ascii=False))
