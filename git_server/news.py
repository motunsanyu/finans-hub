import requests
import bs4
import warnings

# Suppress XMLParsedAsHTMLWarning
warnings.filterwarnings('ignore', category=bs4.XMLParsedAsHTMLWarning)

def clean_cdata(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    if text.startswith("<![CDATA[") and text.endswith("]]>"):
        text = text[9:-3]
    return text.strip()

def fetch_top_news(limit: int = 20) -> list[dict[str, str]]:
    """
    Fetches the top news from Sozcu, Haberturk, and Bloomberg HT RSS feeds.
    Visits each article link to extract the og:image and og:description.
    Returns all articles from each source, interleaved.
    """
    feeds = [
        {"name": "Sözcü", "url": "https://www.sozcu.com.tr/rss/tum-haberler.xml"},
        {"name": "Habertürk", "url": "https://www.haberturk.com/rss"},
        {"name": "Bloomberg HT", "url": "https://www.bloomberght.com/rss"}
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
            title = clean_cdata(title)
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
                
            # Try to get from RSS first
            image_url = ""
            description = ""
            
            # Check for image tag or enclosure
            img_tag = item.find('image')
            if img_tag and img_tag.text.strip():
                image_url = img_tag.text.strip()
            elif item.find('enclosure') and item.find('enclosure').get('url'):
                image_url = item.find('enclosure').get('url')
                
            desc_tag = item.find('description')
            if desc_tag and desc_tag.text.strip():
                description = clean_cdata(desc_tag.text.strip())
                
            # If still missing, extract details from the article page
            if not image_url or not description:
                try:
                    article_resp = requests.get(link, headers=headers, timeout=10)
                    if article_resp.status_code == 200:
                        article_soup = bs4.BeautifulSoup(article_resp.text, 'html.parser')
                        
                        # Extract og:image
                        if not image_url:
                            og_image = article_soup.find('meta', property='og:image')
                            if og_image:
                                image_url = og_image.get('content', '')
                                
                        # Extract og:description
                        if not description:
                            og_desc = article_soup.find('meta', property='og:description')
                            if og_desc:
                                description = clean_cdata(og_desc.get('content', ''))
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
    print(json.dumps(fetch_top_news(), indent=2, ensure_ascii=False))
