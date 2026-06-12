import time
import schedule
import sys
from github_market_cron import main as run_bot

def job():
    print("=========================================")
    print(f"Bot çalışıyor... Tarih: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    try:
        run_bot()
    except Exception as e:
        print(f"Hata oluştu: {e}")
    print("=========================================")

# Her 10 dakikada bir çalışacak
schedule.every(10).minutes.do(job)

if __name__ == "__main__":
    print("Sürekli Bot Başlatıldı. Her 10 dakikada bir çalışacak.")
    print("Veritabanına ilk veri anında yazılıyor...")
    job() # Uygulama başlar başlamaz bir kere çalıştır

    # Sonsuz döngü: Zamanı gelen görevleri tetikler
    while True:
        try:
            schedule.run_pending()
            time.sleep(1)
        except KeyboardInterrupt:
            print("Bot durduruldu.")
            sys.exit(0)
