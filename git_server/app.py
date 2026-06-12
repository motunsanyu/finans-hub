import os
from flask import Flask, jsonify
from github_market_cron import main as run_bot

app = Flask(__name__)

@app.route("/")
def index():
    return "Finans Hub Bot API Aktif! /cron adresine istek atarak botu tetikleyebilirsiniz.", 200

@app.route("/cron")
def cron():
    try:
        run_bot()
        return jsonify({"status": "success", "message": "Veriler basariyla cekildi ve Supabase'e yazildi."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
