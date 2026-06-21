import requests
import bs4
import warnings

# Suppress XMLParsedAsHTMLWarning
warnings.filterwarnings('ignore', category=bs4.XMLParsedAsHTMLWarning)

def fetch_top_news(limit: int = 5) -> list[dict[str, str]]:
    """
    Fetches the top news from Sozcu and Haberturk RSS feeds.
    Visits each article link to extract the og:image and og:description.
    Returns up to `limit` articles from each source, interleaved.
    """
    feeds = [
        {"name": "Sözcü", "url": "https://www.sozcu.com.tr/rss/tum-haberler.xml"},
        {"name": "Habertürk", "url": "https://www.haberturk.com/rss"}
    ]
    
    headers = {'User-Agent': 'Mozilla/5.0'}
    all_news = []
    
    for feed in feeds:
        try:
            response = requests.get(feed["url"], headers=headers, timeout=10)
            response.raise_for_status()
            soup = bs4.BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            print(f"Failed to fetch RSS for {feed['name']}: {e}")
            continue

        items = soup.find_all('item')
        source_news = []
        
        for item in items[:limit]:
            title = item.title.text.strip() if item.title else ""
            link_tag = item.find('link')
            link = ""
            if link_tag and getattr(link_tag, 'next_sibling', None) and isinstance(link_tag.next_sibling, str):
                link = link_tag.next_sibling.strip()
                
            if not link and item.find('guid'):
                link = item.find('guid').text.strip()
                
            if not link and link_tag:
                link = link_tag.text.strip()
                
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
                
            source_news.append({
                "title": title,
                "link": link,
                "image": image_url,
                "description": description,
                "source": feed["name"]
            })
            
        all_news.append(source_news)
    
    # Interleave results from both sources
    interleaved_news = []
    max_len = max(len(sn) for sn in all_news) if all_news else 0
    for i in range(max_len):
        for sn in all_news:
            if i < len(sn):
                interleaved_news.append(sn[i])
                
    return interleaved_news

if __name__ == "__main__":
    import json
    print(json.dumps(fetch_top_news(2), indent=2, ensure_ascii=False))
