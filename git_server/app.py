import os
import threading
from flask import Flask, jsonify
from github_market_cron import main as run_bot

app = Flask(__name__)

@app.route("/")
def index():
    return "Finans Hub Bot API Aktif! /cron adresine istek atarak botu tetikleyebilirsiniz.", 200

@app.route("/cron")
def cron():
    try:
        thread = threading.Thread(target=run_bot, daemon=True)
        thread.start()
        return jsonify({"status": "success", "message": "Bot arka planda tetiklendi."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
