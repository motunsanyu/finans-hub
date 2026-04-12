const METRIC_KEYS = ["usdTry", "eurTry", "goldTry", "btcTry", "bist100"];

exports.handler = async function handler() {
  try {
    const usdPromise = fetchUsdTry();
    const eurPromise = fetchEurTry();
    const btcPromise = usdPromise.then((usdTry) => fetchBtcTry(usdTry)).catch(() => fetchBtcTry());
    const goldPromise = usdPromise.then((usdTry) => fetchGoldTry(usdTry)).catch(() => fetchGoldTry());
    const bistPromise = fetchBist100();

    const [usdRes, eurRes, goldRes, btcRes, bistRes] = await Promise.allSettled([
      usdPromise,
      eurPromise,
      goldPromise,
      btcPromise,
      bistPromise
    ]);

    const metrics = {
      usdTry: settledNumber(usdRes),
      eurTry: settledNumber(eurRes),
      goldTry: settledNumber(goldRes),
      btcTry: settledNumber(btcRes),
      bist100: settledNumber(bistRes)
    };

    const missing = METRIC_KEYS.filter((key) => !Number.isFinite(metrics[key]));

    return jsonResponse(200, {
      updatedAt: Date.now(),
      source: "netlify-function",
      metrics,
      missing
    });
  } catch (error) {
    return jsonResponse(500, {
      error: true,
      message: error?.message || "finance-fetch-failed"
    });
  }
};

function settledNumber(result) {
  if (result.status !== "fulfilled") return null;
  const value = Number(result.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

async function fetchUsdTry() {
  return firstNumber([
    async () => Number((await fetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY")).rates.TRY),
    async () => Number((await fetchJson("https://open.er-api.com/v6/latest/USD")).rates.TRY)
  ]);
}

async function fetchEurTry() {
  return firstNumber([
    async () => Number((await fetchJson("https://api.frankfurter.app/latest?from=EUR&to=TRY")).rates.TRY),
    async () => Number((await fetchJson("https://open.er-api.com/v6/latest/EUR")).rates.TRY)
  ]);
}

async function fetchBtcTry(usdTry) {
  return firstNumber([
    async () => Number((await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=try")).bitcoin.try),
    async () => {
      const btcUsdt = parseFlexibleNumber((await fetchJson("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")).price);
      const usdtTry = parseFlexibleNumber((await fetchJson("https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY")).price);
      return btcUsdt * usdtTry;
    },
    async () => {
      const btcUsd = parseFlexibleNumber((await fetchJson("https://api.coincap.io/v2/assets/bitcoin")).data?.priceUsd);
      const tryRate = Number.isFinite(usdTry) ? usdTry : await fetchUsdTry();
      return btcUsd * tryRate;
    }
  ]);
}

async function fetchGoldTry(usdTry) {
  return firstNumber([
    async () => {
      const xauUsd = await fetchXauUsd();
      const tryRate = Number.isFinite(usdTry) ? usdTry : await fetchUsdTry();
      return (xauUsd * tryRate) / 31.1034768;
    }
  ]);
}

async function fetchXauUsd() {
  return firstNumber([
    async () => {
      const data = await fetchJson("https://api.metals.live/v1/spot");
      return parseGoldFromMetals(data);
    },
    async () => {
      const raw = await fetchText("https://stooq.com/q/l/?s=xauusd&i=d");
      return parseStooqClose(raw);
    }
  ]);
}

async function fetchBist100() {
  return firstNumber([
    async () => parseFlexibleNumber((await fetchJson("https://www.borsaistanbul.com/graphic.php?veriTuru=current-before&indexCode=XU100")).data?.current?.value),
    async () => {
      const rows = (await fetchJson("https://www.borsaistanbul.com/graphic.php?veriTuru=endeks-graphic&indexCode=XU100")).data;
      return Number(rows?.[0]?.clval);
    }
  ]);
}

async function firstNumber(fetchers) {
  const errors = [];
  for (const fetcher of fetchers) {
    try {
      const value = Number(await fetcher());
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
      errors.push("invalid-number");
    } catch (error) {
      errors.push(error?.message || "fetch-failed");
    }
  }
  throw new Error(errors.join(" | "));
}

function parseGoldFromMetals(data) {
  if (!Array.isArray(data)) {
    throw new Error("metals format invalid");
  }

  for (const row of data) {
    if (row && typeof row === "object" && !Array.isArray(row) && Number.isFinite(Number(row.gold))) {
      return Number(row.gold);
    }

    if (Array.isArray(row) && row.length >= 2) {
      const maybePrice = Number(row[1]);
      if (Number.isFinite(maybePrice) && maybePrice > 100) {
        return maybePrice;
      }
    }
  }

  throw new Error("gold price not found");
}

function parseStooqClose(raw) {
  const line = String(raw || "").trim().split(/\r?\n/).pop();
  if (!line) throw new Error("stooq empty");

  const cols = line.split(",");
  const closeCandidates = [cols[6], cols[cols.length - 2], cols[cols.length - 1]];

  for (const candidate of closeCandidates) {
    const value = parseFlexibleNumber(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  throw new Error("stooq parse failed");
}

function parseFlexibleNumber(input) {
  if (typeof input === "number") return input;
  if (input == null) return Number.NaN;

  const raw = String(input).trim().replace(/\s/g, "");
  if (!raw) return Number.NaN;

  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(raw)) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }

  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(raw)) {
    return Number(raw.replace(/,/g, ""));
  }

  return Number(raw.replace(",", ".").replace(/[^0-9.-]/g, ""));
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
  return response.json();
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
  return response.text();
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`http-${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}
