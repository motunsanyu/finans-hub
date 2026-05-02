// js/modules/fuel.js — Yakıt ve Navigasyon Modülü

const FuelModule = (() => {

  // Navigasyon global değişkenleri
  let navCitiesData = null;
  let navMap = null;
  let navRouteLayers = [];
  let navMarkers = [];
  let navUserLocation = null;
  let navActiveRoutes = [];
  let navCurrentSelectedIndex = 0;

  // ─── YAKIT SİMÜLATÖR ────────────────────────────────────────
  function calcSimYakit() {
    const km = sum([...state.fuelRecords], "km"); const amt = sum([...state.fuelRecords], "amount");
    const costPerKm = km > 0 ? (amt / km) : 0;
    let targetKm = Number(document.getElementById("simKm").value) || 0;
    if (document.getElementById("simReturn").checked) targetKm *= 2;
    document.getElementById("simResult").textContent = formatCurrency(targetKm * costPerKm);
  }

  // ─── OLAY BAĞLAMA ───────────────────────────────────────────
  function bindFuel() {
    const simKmInput = document.getElementById("simKm"); const simReturnChk = document.getElementById("simReturn");
    if (simKmInput) simKmInput.addEventListener("input", calcSimYakit);
    if (simReturnChk) simReturnChk.addEventListener("change", calcSimYakit);

    const form = document.getElementById("fuelForm");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const date = document.getElementById("fuelDate").value; const amount = Number(document.getElementById("fuelAmount").value); const km = Number(document.getElementById("fuelKm").value); const price = Number(document.getElementById("fuelPrice").value);
        if (!date || amount <= 0 || km <= 0 || price <= 0) return;
        state.fuelRecords.push({ id: crypto.randomUUID(), date, amount, km, price, liters: amount / price, costPer100: (amount / km) * 100, litersPer100: ((amount / price) / km) * 100 });
        writeStorage(STORAGE_KEYS.fuel, state.fuelRecords); renderFuelSummary(); renderFuelTable(); form.reset(); document.getElementById("newFuelDetails").removeAttribute("open");
      });
    }

    document.getElementById("fuelTable").addEventListener("click", (e) => {
      if (e.target.classList.contains('fuel-del-btn')) { if (confirm('Kayıt silinsin mi?')) { state.fuelRecords = state.fuelRecords.filter(r => r.id !== e.target.dataset.id); writeStorage(STORAGE_KEYS.fuel, state.fuelRecords); renderFuelTable(); renderFuelSummary(); } }
    });
    document.getElementById("clearAllFuelBtn").addEventListener("click", () => {
      if (confirm('Tüm yakıt dökümü silinecek. Arşiv gidiyor. Onaylıyor musun?')) { state.fuelRecords = []; writeStorage(STORAGE_KEYS.fuel, state.fuelRecords); renderFuelTable(); renderFuelSummary(); }
    });
  }

  // ─── YAKIT ÖZET RENDER ──────────────────────────────────────
  function renderFuelSummary() {
    const km = sum([...state.fuelRecords], "km"); const amt = sum([...state.fuelRecords], "amount"); const lt = sum([...state.fuelRecords], "liters");
    document.getElementById("sumAmount").innerHTML = `${formatNumber(amt, 0)} <span style="font-size:12px; font-weight:400;">TL</span>`;
    document.getElementById("sumKm").innerHTML = `${formatNumber(km, 1)} <span style="font-size:12px; font-weight:400;">KM</span>`;
    document.getElementById("sumLiters").innerHTML = `${formatNumber(lt, 1)} <span style="font-size:12px; font-weight:400;">L</span>`;
    setText("avgCost100", formatCurrency(km > 0 ? (amt / km) * 100 : 0));
    document.getElementById("avgLt100").innerHTML = `${formatNumber(km > 0 ? (lt / km) * 100 : 0, 2)} <span style="font-size:12px; font-weight:400;">L</span>`;
    calcSimYakit();
  }

  function renderFuelTable() {
    const tbody = document.querySelector("#fuelTable tbody"); if (!tbody) return; tbody.innerHTML = "";
    [...state.fuelRecords].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td style="font-size:10px;">${formatDateShortYY(r.date)}</td>
          <td style="font-size:11px;"><b>${formatCurrency(r.amount, 0, "0")}</b></td>
          <td style="font-size:10px;">${formatNumber(r.km, 0)}</td>
          <td style="font-size:10px;">${formatCurrency(r.price, 2)}</td>
          <td style="font-size:11px; font-weight:800;">${formatCurrency(r.amount / r.km, 2)}</td>
          <td style="text-align:right; padding:8px 0; width:15px;"><button class="btn danger-btn fuel-del-btn" data-id="${r.id}" style="padding:4px; font-size:10px; line-height:1;">X</button></td>`;
      tbody.appendChild(tr);
    });
  }

  // ─── NAVİGASYON ALT SEKME ───────────────────────────────────
  window.switchFuelTab = function (tab) {
    const mainSec = document.getElementById("fuelMainSection");
    const navSec = document.getElementById("fuelNavSection");
    const btnMain = document.getElementById("btnFuelMain");
    const btnNav = document.getElementById("btnFuelNav");

    if (tab === 'main') {
      mainSec.style.display = "block";
      navSec.style.display = "none";
      btnMain.classList.add("active");
      btnNav.classList.remove("active");
    } else {
      mainSec.style.display = "none";
      navSec.style.display = "block";
      btnMain.classList.remove("active");
      btnNav.classList.add("active");

      if (!navMap) {
        initNavMap();
        loadNavCitiesData();
      } else {
        setTimeout(() => navMap.invalidateSize(), 100);
      }
      fillNavFuelCost();
    }
  };

  function fillNavFuelCost() {
    const km = sum([...state.fuelRecords], "km");
    const amt = sum([...state.fuelRecords], "amount");
    const avgCost = km > 0 ? (amt / km) : 2.5;
    const input = document.getElementById("navFuelCostPerKm");
    if (input) input.value = avgCost.toFixed(2);
  }

  function initNavMap() {
    if (navMap) return;
    const turkeyBounds = L.latLngBounds([36.0, 26.0], [42.0, 45.0]);
    navMap = L.map('navMap').fitBounds(turkeyBounds);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(navMap);
  }

  async function loadNavCitiesData() {
    try {
      const response = await fetch('./cities.json');
      if (!response.ok) throw new Error('Yerel JSON yüklenemedi');
      navCitiesData = await response.json();
      populateNavCitySelects();
    } catch (error) { console.error('Navigasyon yerel veri yükleme hatası:', error); }
  }

  function populateNavCitySelects() {
    const originCitySelect = document.getElementById('originCityNav');
    const destCitySelect = document.getElementById('destCityNav');
    if (!originCitySelect || !destCitySelect) return;
    const sortedCities = [...navCitiesData].sort((a, b) => a.name.localeCompare(b.name));
    sortedCities.forEach(city => {
      originCitySelect.add(new Option(city.name, city.id));
      destCitySelect.add(new Option(city.name, city.id));
    });
    originCitySelect.onchange = () => updateNavDistricts('origin', parseInt(originCitySelect.value));
    destCitySelect.onchange = () => updateNavDistricts('dest', parseInt(destCitySelect.value));
    if (sortedCities.length > 0) {
      updateNavDistricts('origin', sortedCities[0].id);
      updateNavDistricts('dest', sortedCities[0].id);
    }
    document.getElementById("calculateNavBtn").onclick = calculateAndShowNavRoute;
    document.getElementById("useMyLocationBtn").onclick = useMyLocation;
    document.getElementById("clearLocationBtn").onclick = clearUserLocation;
  }

  function updateNavDistricts(type, cityId) {
    const city = navCitiesData.find(c => c.id === cityId);
    const districtSelect = document.getElementById(`${type}DistrictNav`);
    if (!city || !districtSelect) return;
    districtSelect.innerHTML = '';
    const sortedTowns = [...city.towns].sort((a, b) => a.name.localeCompare(b.name));
    sortedTowns.forEach(town => {
      const opt = new Option(town.name, town.id);
      opt.dataset.lat = town.latitude;
      opt.dataset.lng = town.longitude;
      districtSelect.add(opt);
    });
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return alert("Tarayıcınız konum özelliğini desteklemiyor.");
    if (!navMap) initNavMap();
    const btn = document.getElementById("useMyLocationBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = "⌛ Konum Alınıyor...";
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (isNaN(lat) || isNaN(lng)) { btn.innerHTML = originalText; btn.disabled = false; return alert("Geçersiz koordinat alındı."); }
        navUserLocation = { lat, lng, name: "Mevcut Konum" };
        document.getElementById("originSelectWrap").style.display = "none";
        document.getElementById("activeLocationBadge").style.display = "flex";
        document.getElementById("clearLocationBtn").style.display = "block";
        btn.style.display = "none";
        if (navMarkers[0]) navMap.removeLayer(navMarkers[0]);
        const m = L.marker([lat, lng], { icon: L.divIcon({ className: 'custom-marker', html: '🔵', iconSize: [25, 25] }) }).bindPopup("Konumunuz alınıyor...").addTo(navMap);
        navMarkers[0] = m;
        navMap.setView([lat, lng], 15);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=tr`);
          const data = await res.json();
          const address = data.display_name || "Adres bulunamadı";
          navUserLocation.name = address;
          m.setPopupContent(`📍 <b>Konumunuz:</b><br>${address}`).openPopup();
          document.getElementById("navAddressText").textContent = address;
        } catch { }
        btn.innerHTML = originalText;
        btn.disabled = false;
      },
      (err) => { alert("Konum alınamadı."); btn.innerHTML = originalText; btn.disabled = false; },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clearUserLocation() {
    navUserLocation = null;
    document.getElementById("originSelectWrap").style.display = "block";
    document.getElementById("activeLocationBadge").style.display = "none";
    document.getElementById("clearLocationBtn").style.display = "none";
    document.getElementById("useMyLocationBtn").style.display = "flex";
    if (navMarkers[0]) navMap.removeLayer(navMarkers[0]);
  }

  async function calculateAndShowNavRoute() {
    const originDist = document.getElementById("originDistrictNav");
    const destDist = document.getElementById("destDistrictNav");
    const costInput = document.getElementById("navFuelCostPerKm");
    const dOpt = destDist.options[destDist.selectedIndex];
    const fuelCost = parseFloat(costInput.value) || 0;
    if (!dOpt) return alert("Lütfen varış noktasını seçin.");

    let start;
    if (navUserLocation) {
      start = navUserLocation;
    } else {
      const oOpt = originDist.options[originDist.selectedIndex];
      if (!oOpt) return alert("Lütfen başlangıç noktasını seçin.");
      start = { lat: parseFloat(oOpt.dataset.lat), lng: parseFloat(oOpt.dataset.lng), name: oOpt.text };
    }
    const end = { lat: parseFloat(dOpt.dataset.lat), lng: parseFloat(dOpt.dataset.lng), name: dOpt.text };
    const btn = document.getElementById("calculateNavBtn");
    btn.textContent = "⌛ Hesaplanıyor..."; btn.disabled = true;

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        navRouteLayers.forEach(l => navMap.removeLayer(l));
        navRouteLayers = [];
        navActiveRoutes = data.routes.sort((a, b) => a.distance - b.distance);
        navMarkers.forEach((m, idx) => { if (idx > 0 || !navUserLocation) navMap.removeLayer(m); });
        if (!navUserLocation) navMarkers = []; else navMarkers = [navMarkers[0]];

        const colors = ['var(--brand)', '#e67e22', '#2ecc71'];
        const allBounds = L.latLngBounds();
        navActiveRoutes.slice(0, 3).forEach((route, idx) => {
          const distKm = route.distance / 1000;
          const durationMin = Math.round(route.duration / 60);
          const rLayer = L.geoJSON(route.geometry, {
            style: { color: colors[idx] || '#848e9c', weight: idx === 0 ? 6 : 4, opacity: idx === 0 ? 0.9 : 0.4 }
          }).addTo(navMap);
          const popupContent = `<div style="font-family:'Manrope',sans-serif; min-width:140px;"><b style="color:${colors[idx]}; font-size:14px;">Rota ${idx + 1} ${idx === 0 ? '(En Hızlı)' : ''}</b><br><div style="margin-top:5px; font-size:12px;">📏 <b>${distKm.toFixed(1)} KM</b><br>⏱️ <b>${durationMin} Dakika</b><br>💰 <b style="color:var(--brand)">${formatCurrency(distKm * fuelCost)}</b></div><button onclick="FuelModule.selectNavRoute(${idx})" style="margin-top:10px; width:100%; padding:6px; background:var(--brand); color:#000; border:none; border-radius:4px; font-weight:800; cursor:pointer;">Bu Rotayı Seç</button></div>`;
          rLayer.bindPopup(popupContent);
          navRouteLayers.push(rLayer);
          allBounds.extend(rLayer.getBounds());
        });

        if (!navUserLocation) {
          const m1 = L.marker([start.lat, start.lng], { icon: L.divIcon({ className: 'custom-marker', html: '🚩', iconSize: [25, 25] }) }).bindPopup("Başlangıç: " + start.name).addTo(navMap);
          navMarkers.push(m1);
        }
        const m2 = L.marker([end.lat, end.lng], { icon: L.divIcon({ className: 'custom-marker', html: '🏁', iconSize: [25, 25] }) }).bindPopup("Varış: " + end.name).addTo(navMap);
        navMarkers.push(m2);

        selectNavRoute(0);

        const buttonsWrap = document.getElementById("navRouteButtonsWrap");
        buttonsWrap.innerHTML = "";
        if (navActiveRoutes.length > 1) {
          buttonsWrap.style.display = "flex";
          navActiveRoutes.slice(0, 3).forEach((route, idx) => {
            const btn = document.createElement("button");
            btn.type = "button"; btn.className = "nav-route-btn"; btn.id = `navRouteBtn_${idx}`;
            btn.innerHTML = `<span style="font-size:11px;">${idx === 0 ? "⭐ Önerilen" : `🔄 Alternatif ${idx + 1}`}</span><br><b style="font-size:13px;">${(route.distance / 1000).toFixed(1)} km</b>`;
            btn.onclick = () => selectNavRoute(idx);
            buttonsWrap.appendChild(btn);
          });
        } else { buttonsWrap.style.display = "none"; }

        if (allBounds.isValid()) navMap.fitBounds(allBounds, { padding: [50, 50] });
        document.getElementById("navResultBox").style.display = "block";
        document.getElementById("activeLocationBadge").style.display = "flex";
      } else { alert("Rota bulunamadı."); }
    } catch (err) { alert("Rota hesaplanırken bir hata oluştu."); }
    finally { btn.textContent = "Rotayı Hesapla"; btn.disabled = false; }
  }

  function selectNavRoute(index) {
    navCurrentSelectedIndex = index;
    const route = navActiveRoutes[index];
    if (!route) return;
    const fuelCost = parseFloat(document.getElementById("navFuelCostPerKm").value) || 0;
    const isRoundTrip = document.getElementById("navRoundTrip").checked;
    let distKm = route.distance / 1000;
    if (isRoundTrip) distKm *= 2;
    const totalCost = distKm * fuelCost;
    document.getElementById("navDistanceResult").textContent = distKm.toFixed(1) + " km";
    document.getElementById("navCostResult").textContent = formatCurrency(totalCost);
    const resBox = document.getElementById("navResultBox");
    if (isRoundTrip) {
      resBox.style.borderLeftColor = "var(--up)";
      resBox.style.background = "linear-gradient(90deg, rgba(14,203,129,0.1), var(--bg-secondary))";
    } else {
      resBox.style.borderLeftColor = "var(--brand)";
      resBox.style.background = "var(--bg-secondary)";
    }
    navRouteLayers.forEach((layer, idx) => {
      if (idx === index) { layer.setStyle({ weight: 7, opacity: 1 }); layer.bringToFront(); }
      else { layer.setStyle({ weight: 4, opacity: 0.25 }); }
    });
    for (let i = 0; i < 3; i++) {
      const b = document.getElementById(`navRouteBtn_${i}`);
      if (b) b.classList.toggle("active", i === index);
    }
    navMap.closePopup();
  }

  window.updateNavCalculation = function () {
    selectNavRoute(navCurrentSelectedIndex);
  };

  // ─── BAŞLATMA ───────────────────────────────────────────────
  function init() {
    bindFuel();
    renderFuelSummary();
    renderFuelTable();
    // Yakıt fiyatlarını gecikmeli yükle
    setTimeout(() => { if (typeof window.fetchFuelPrices === 'function') window.fetchFuelPrices(); }, 1200);
    console.log('✅ Yakıt modülü başlatıldı');
  }

  return { init, selectNavRoute };
})();