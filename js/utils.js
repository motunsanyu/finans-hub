// js/utils.js — Ortak Yardımcı Fonksiyonlar ve Depolama Yönetimi

const STORAGE_KEYS = {
  fuel: "financeApp.fuelRecords",
  days: "financeApp.dayRecords",
  school: "financeApp.schoolRecords",
  financeSnapshot: "financeApp.financeSnapshot",
  debts: "financeApp.debts",
  appPin: "financeApp.pin",
  vault: "financeApp.vault",
  yesterdayDebt: "financeApp.yesterdayDebt",
  lastDailyUpdate: "financeApp.lastDailyUpdate"
};

function getSB() {
  return window._supabaseClient;
}

function readStorage(k, f) { 
  try { 
    const r = localStorage.getItem(k); 
    return r ? JSON.parse(r) : f; 
  } catch { 
    return f; 
  } 
}

function writeStorage(k, v) { 
  localStorage.setItem(k, JSON.stringify(v)); 
}

function formatCurrency(v, dec = 0, f = "0") { 
  return !Number.isFinite(Number(v)) ? f : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v) + " ₺"; 
}

function formatNumber(v, d = 2, f = "--") { 
  return !Number.isFinite(Number(v)) ? f : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v); 
}

function formatDate(d) { 
  return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; 
}

function formatDateShort(d) { 
  if (!d) return "-"; 
  const date = new Date(d); 
  return String(date.getDate()).padStart(2, '0') + "." + String(date.getMonth() + 1).padStart(2, '0'); 
}

function formatDateShortYY(d) { 
  if (!d) return "-"; 
  const date = new Date(d); 
  return String(date.getDate()).padStart(2, '0') + "." + String(date.getMonth() + 1).padStart(2, '0') + "." + String(date.getFullYear()).slice(-2); 
}

function setText(i, v) { 
  const e = document.getElementById(i); 
  if (e) e.textContent = v; 
}

function parseFlexibleNumber(input) { 
  if (!input) return Number.NaN; 
  const raw = String(input).trim().replace(/\s/g, "").replace("%", ""); 
  if (!raw) return Number.NaN; 
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", ".")); 
  return Number(raw.replace(",", ".").replace(/[^0-9.-]/g, "")); 
}
