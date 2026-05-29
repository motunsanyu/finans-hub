// js/modules/fuel.js — Yakıt ve Navigasyon Modülü (Supabase Entegrasyonlu)

const FuelModule = (() => {

  let navCitiesData = null;
  let navMap = null;
  let navRouteLayers = [];
  let navMarkers = [];
  let navUserLocation = null;
  let navActiveRoutes = [];
  let navCurrentSelectedIndex = 0;
  let navUserMarker = null;

  // Supabase client'a kısayol
  function getSB() {
    return window._supabaseClient;
  }

  // ═══════════════ YAKIT SİMÜLATÖR ═══════════════
  async function calcSimYakit() {
    try {
      const { data: records } = await getSB()
        .from('fuel_records')
        .select('amount, km');

      const km = records ? records.reduce((sum, r) => sum + Number(r.km), 0) : 0;
      const amt = records ? records.reduce((sum, r) => sum + Number(r.amount), 0) : 0;
      const costPerKm = km > 0 ? (amt / km) : 0;
      let targetKm = Number(document.getElementById("simKm").value) || 0;
      if (document.getElementById("simReturn").checked) targetKm *= 2;
      document.getElementById("simResult").textContent = formatCurrency(targetKm * costPerKm);
    } catch (e) {
      console.warn('Simülatör hesaplanamadı:', e.message);
    }
  }

  // ═══════════════ OLAY BAĞLAMA ═══════════════
  function bindFuel() {
    const simKmInput = document.getElementById("simKm");
    const simReturnChk = document.getElementById("simReturn");
    if (simKmInput) simKmInput.addEventListener("input", () => calcSimYakit());
    if (simReturnChk) simReturnChk.addEventListener("change", () => calcSimYakit());

    const form = document.getElementById("fuelForm");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const date = document.getElementById("fuelDate").value;
        const amount = Number(document.getElementById("fuelAmount").value);
        const km = Number(document.getElementById("fuelKm").value);
        const price = Number(document.getElementById("fuelPrice").value);
        if (!date || amount <= 0 || km <= 0 || price <= 0) return;

        try {
          const { data: { user } } = await getSB().auth.getUser();
          await getSB().from('fuel_records').insert({
            user_id: user.id,
            date: date,
            amount: amount,
            km: km,
            price: price
          });

          form.reset();
          document.getElementById("newFuelDetails").removeAttribute("open");
          await renderFuelSummary();
          await renderFuelTable();
        } catch (err) {
          console.error('Yakıt kaydı eklenemedi:', err.message);
          alert('Kayıt eklenirken hata oluştu!');
        }
      });
    }

    document.getElementById("fuelTable").addEventListener("click", async (e) => {
      if (e.target.classList.contains('fuel-del-btn')) {
        const id = e.target.dataset.id;
        window.showCustomConfirm('Kayıt silinsin mi?', async () => {
          try {
            await getSB().from('fuel_records').delete().eq('id', id);
            await renderFuelTable();
            await renderFuelSummary();
          } catch (err) {
            console.error('Silme hatası:', err.message);
          }
        });
      }
    });

    document.getElementById("clearAllFuelBtn").addEventListener("click", async () => {
      window.showCustomConfirm('Tüm yakıt dökümü silinecek. Onaylıyor musunuz?', async () => {
        try {
          const { data: { user } } = await getSB().auth.getUser();
          await getSB().from('fuel_records').delete().eq('user_id', user.id);
          await renderFuelTable();
          await renderFuelSummary();
        } catch (err) {
          console.error('Toplu silme hatası:', err.message);
        }
      });
    });
  }

  // ═══════════════ YAKIT ÖZET RENDER ═══════════════
  async function renderFuelSummary() {
    try {
      const { data: records } = await getSB()
        .from('fuel_records')
        .select('amount, km, liters, price');

      if (!records || records.length === 0) {
        document.getElementById("sumAmount").innerHTML = `0 <span style="font-size:12px; font-weight:400;">TL</span>`;
        document.getElementById("sumKm").innerHTML = `0 <span style="font-size:12px; font-weight:400;">KM</span>`;
        document.getElementById("sumLiters").innerHTML = `0 <span style="font-size:12px; font-weight:400;">L</span>`;
        setText("avgCost100", formatCurrency(0));
        document.getElementById("avgLt100").innerHTML = `0 <span style="font-size:12px; font-weight:400;">L</span>`;
        return;
      }

      const km = records.reduce((sum, r) => sum + Number(r.km), 0);
      const amt = records.reduce((sum, r) => sum + Number(r.amount), 0);
      const lt = records.reduce((sum, r) => sum + Number(r.liters || (r.amount / r.price)), 0);

      document.getElementById("sumAmount").innerHTML = `${formatNumber(amt, 0)} <span style="font-size:12px; font-weight:400;">TL</span>`;
      document.getElementById("sumKm").innerHTML = `${formatNumber(km, 1)} <span style="font-size:12px; font-weight:400;">KM</span>`;
      document.getElementById("sumLiters").innerHTML = `${formatNumber(lt, 1)} <span style="font-size:12px; font-weight:400;">L</span>`;
      setText("avgCost100", formatCurrency(km > 0 ? (amt / km) * 100 : 0));
      document.getElementById("avgLt100").innerHTML = `${formatNumber(km > 0 ? (lt / km) * 100 : 0, 2)} <span style="font-size:12px; font-weight:400;">L</span>`;

      await calcSimYakit();
    } catch (e) {
      console.warn('Yakıt özeti yüklenemedi:', e.message);
    }
  }

  // ═══════════════ YAKIT TABLOSU RENDER ═══════════════
  async function renderFuelTable() {
    const tbody = document.querySelector("#fuelTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    try {
      const { data: records } = await getSB()
        .from('fuel_records')
        .select('*')
        .order('date', { ascending: false });

      if (!records || records.length === 0) return;

      for (const r of records) {
        const tr = document.createElement("tr");
        const liters = r.liters || (r.amount / r.price);
        const costPerKm = r.cost_per_100 || ((r.amount / r.km) * 100);
        const costPerKmSingle = (r.amount / r.km);
        tr.innerHTML = `
          <td style="font-size:10px;">${formatDateShortYY(r.date)}</td>
          <td style="font-size:11px;"><b>${formatCurrency(r.amount, 0, "0")}</b></td>
          <td style="font-size:10px;">${formatNumber(r.km, 0)}</td>
          <td style="font-size:10px;">${formatCurrency(r.price, 2)}</td>
          <td style="font-size:11px; font-weight:800;">${formatCurrency(costPerKmSingle, 2)}</td>
          <td style="text-align:right; padding:8px 0; width:15px;"><button class="btn danger-btn fuel-del-btn" data-id="${r.id}" style="padding:4px; font-size:10px; line-height:1;">X</button></td>`;
        tbody.appendChild(tr);
      }
    } catch (e) {
      console.error('Yakıt tablosu yüklenemedi:', e.message);
    }
  }

  // ═══════════════ NAVİGASYON FONKSİYONLARI ═══════════════

  window.switchFuelTab = function (tab) {
    const mainSec = document.getElementById("fuelMainSection");
    const navSec  = document.getElementById("fuelNavSection");
    const addrSec = document.getElementById("fuelAddressSection");
    const btnMain    = document.getElementById("btnFuelMain");
    const btnNav     = document.getElementById("btnFuelNav");
    const btnAddress = document.getElementById("btnFuelAddress");

    if (mainSec) mainSec.style.display = "none";
    if (navSec)  navSec.style.display  = "none";
    if (addrSec) addrSec.style.display = "none";
    if (btnMain)    btnMain.classList.remove("active");
    if (btnNav)     btnNav.classList.remove("active");
    if (btnAddress) btnAddress.classList.remove("active");

    if (tab === 'main') {
      if (mainSec) mainSec.style.display = "block";
      if (btnMain) btnMain.classList.add("active");
    } else if (tab === 'nav') {
      if (navSec) navSec.style.display = "block";
      if (btnNav) btnNav.classList.add("active");
      initGoogleMap(); // Google Maps iframe başlat
      if (!navCitiesData) loadNavCitiesData();
      fillNavFuelCost();
    } else if (tab === 'address') {
      if (addrSec) addrSec.style.display = "block";
      if (btnAddress) btnAddress.classList.add("active");
      if (typeof AddressModule !== 'undefined') AddressModule.renderAddresses();
    }
  };

  async function fillNavFuelCost() {
    try {
      const { data: records } = await getSB().from('fuel_records').select('amount, km');
      const km  = records ? records.reduce((sum, r) => sum + Number(r.km),  0) : 0;
      const amt = records ? records.reduce((sum, r) => sum + Number(r.amount), 0) : 0;
      const avgCost = km > 0 ? (amt / km) : 2.5;
      const input = document.getElementById("navFuelCostPerKm");
      if (input) input.value = avgCost.toFixed(2);
    } catch (e) { /* sessizce devam et */ }
  }

  // ── Google Maps iframe kurulumu ──────────────────────────────────────────
  function initGoogleMap() {
    const container = document.getElementById('navMap');
    if (!container) return;
    // Zaten iframe varsa tekrar oluşturma
    if (container.querySelector('iframe')) return;
    container.innerHTML = `
      <iframe id="navMapFrame"
        src="https://maps.google.com/maps?q=Turkey&z=6&output=embed"
        style="width:100%;height:100%;border:none;display:block;"
        loading="lazy" allowfullscreen>
      </iframe>`;
  }

  function setGoogleMapLocation(lat, lng, zoom = 15) {
    const frame = document.getElementById('navMapFrame');
    if (frame) frame.src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
  }

  function setGoogleMapRoute(startLat, startLng, endLat, endLng) {
    const frame = document.getElementById('navMapFrame');
    if (frame) frame.src = `https://maps.google.com/maps?saddr=${startLat},${startLng}&daddr=${endLat},${endLng}&output=embed`;
  }

  // ── Şehir/ilçe seçicileri ───────────────────────────────────────────────
  async function loadNavCitiesData() {
    try {
      const response = await fetch('./cities.json');
      if (!response.ok) throw new Error('JSON yüklenemedi');
      navCitiesData = await response.json();
      populateNavCitySelects();
    } catch (error) { console.error('Navigasyon veri yükleme hatası:', error); }
  }

  function populateNavCitySelects() {
    const originCitySelect = document.getElementById('originCityNav');
    const destCitySelect   = document.getElementById('destCityNav');
    if (!originCitySelect || !destCitySelect) return;
    const sortedCities = [...navCitiesData].sort((a, b) => a.name.localeCompare(b.name));
    sortedCities.forEach(city => {
      originCitySelect.add(new Option(city.name, city.id));
      destCitySelect.add(new Option(city.name, city.id));
    });
    originCitySelect.onchange = () => updateNavDistricts('origin', parseInt(originCitySelect.value));
    destCitySelect.onchange   = () => updateNavDistricts('dest',   parseInt(destCitySelect.value));
    if (sortedCities.length > 0) {
      updateNavDistricts('origin', sortedCities[0].id);
      updateNavDistricts('dest',   sortedCities[0].id);
    }
    document.getElementById("calculateNavBtn").onclick  = calculateAndShowNavRoute;
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

  // ── Hibrit Konum Tespiti (konum.html'den entegre) ────────────────────────
  // 1) GPS dener, 2) Başarısız olursa 3 farklı IP servisi sırayla dener
  async function ipKonumuAl() {
    const servisler = [
      {
        url: 'http://ip-api.com/json/?fields=status,lat,lon,city,country,regionName',
        isle: (d) => {
          if (d.status !== 'success') throw new Error('Başarısız');
          return { lat: d.lat, lon: d.lon };
        }
      },
      {
        url: 'https://ipapi.co/json/',
        isle: (d) => ({ lat: d.latitude, lon: d.longitude })
      },
      {
        url: 'https://geolocation-db.com/json/',
        isle: (d) => ({ lat: d.latitude, lon: d.longitude })
      }
    ];
    for (const s of servisler) {
      try {
        const res = await fetch(s.url);
        if (!res.ok) continue;
        const data = await res.json();
        const sonuc = s.isle(data);
        if (sonuc.lat && sonuc.lon) return sonuc;
      } catch (_) {}
    }
    return null;
  }

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=tr`,
        { headers: { 'User-Agent': 'FinansApp/1.0' } }
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (_) { return null; }
  }

  async function useMyLocation() {
    const btn = document.getElementById("useMyLocationBtn");
    if (!btn) return;

    async function doFetch(useGPS) {
      const originalText = btn.innerHTML;
      btn.innerHTML = "⌛ Konum Alınıyor...";
      btn.disabled  = true;

      try {
        let lat, lng;

        if (useGPS) {
          // GPS
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject,
              { enableHighAccuracy: true, timeout: 8000 })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } else {
          // IP yedek — GPS yoksa veya başarısız olduysa
          const ipRes = await ipKonumuAl();
          if (!ipRes) throw new Error('Konum alınamadı');
          lat = ipRes.lat;
          lng = ipRes.lon;
        }

        navUserLocation = { lat, lng, name: 'Mevcut Konum', il: '', ilce: '' };

        // Haritayı konuma odakla
        setGoogleMapLocation(lat, lng, 15);

        // Adres bul
        const geoData = await reverseGeocode(lat, lng);
        if (geoData && geoData.address) {
          const addr = geoData.address;
          navUserLocation.il   = addr.province || addr.state || '';
          navUserLocation.ilce = addr.town || addr.city_district || addr.district || addr.suburb || '';

          let adresTam = '';
          if (typeof AddressModule !== 'undefined' && AddressModule.formatNominatimAddress) {
            adresTam = AddressModule.formatNominatimAddress(addr);
          }
          if (!adresTam) adresTam = geoData.display_name || '';
          navUserLocation.name = adresTam || 'Konum alındı';
          navUserLocation.adresTam = adresTam;

          const addrEl = document.getElementById('navAddressText');
          if (addrEl) addrEl.textContent = adresTam;

          // Kaydet butonunu göster
          const saveAddrBtn = document.getElementById('saveAddressBtn');
          if (saveAddrBtn) {
            saveAddrBtn.style.display = 'inline-flex';
            saveAddrBtn.onclick = () => {
              if (typeof AddressModule !== 'undefined') {
                AddressModule.showAddressModal({
                  lat, lng,
                  il: navUserLocation.il,
                  ilce: navUserLocation.ilce,
                  adresTam: navUserLocation.adresTam
                });
              }
            };
          }
        }

        document.getElementById("originSelectWrap").style.display = "none";
        document.getElementById("activeLocationBadge").style.display = "flex";
        document.getElementById("clearLocationBtn").style.display = "block";
        btn.style.display = "none";

      } catch (err) {
        console.warn('GPS başarısız, IP konumuna geçiliyor:', err.message);
        if (useGPS) {
          // GPS başarısız — IP ile tekrar dene
          btn.innerHTML = originalText;
          btn.disabled  = false;
          await doFetch(false);
          return;
        }
        if (window.showToast) window.showToast('❌ Konum alınamadı.', 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled  = false;
      }
    }

    // Konum izni kontrolü
    if (!navigator.geolocation) {
      // GPS yok — direkt IP ile al
      await doFetch(false);
      return;
    }

    const modal    = document.getElementById('locationPermissionModal');
    const allowBtn = document.getElementById('allowLocationBtn');
    const denyBtn  = document.getElementById('denyLocationBtn');

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') { await doFetch(true); return; }
        if (result.state === 'denied')  { await doFetch(false); return; } // GPS reddedildi → IP
      } catch (_) {}
    }

    if (modal && allowBtn && denyBtn) {
      modal.style.display = 'flex';
      allowBtn.onclick = () => { modal.style.display = 'none'; doFetch(true);  };
      denyBtn.onclick  = () => { modal.style.display = 'none'; doFetch(false); }; // İptal → IP ile al
    } else {
      await doFetch(true);
    }
  }

  function clearUserLocation() {
    navUserLocation = null;
    document.getElementById("originSelectWrap").style.display = "block";
    document.getElementById("activeLocationBadge").style.display = "none";
    document.getElementById("clearLocationBtn").style.display = "none";
    document.getElementById("useMyLocationBtn").style.display = "flex";
    const saveAddrBtn = document.getElementById("saveAddressBtn");
    if (saveAddrBtn) saveAddrBtn.style.display = "none";
    // Haritayı Türkiye görünümüne sıfırla
    const frame = document.getElementById('navMapFrame');
    if (frame) frame.src = "https://maps.google.com/maps?q=Turkey&z=6&output=embed";
  }

  // ── Rota Hesaplama (OSRM) + Google Maps Görüntüleme ─────────────────────
  async function calculateAndShowNavRoute() {
    const calculateBtn  = document.getElementById("calculateNavBtn");
    const originalText  = calculateBtn.innerHTML;

    try {
      let startLat, startLng, startName;

      if (navUserLocation) {
        startLat  = navUserLocation.lat;
        startLng  = navUserLocation.lng;
        startName = navUserLocation.adresTam || navUserLocation.name;
      } else {
        const originSel = document.getElementById('originDistrictNav');
        const opt = originSel.options[originSel.selectedIndex];
        if (!opt) { if (window.showToast) window.showToast("Başlangıç noktası seçin.", "error"); return; }
        startLat  = parseFloat(opt.dataset.lat);
        startLng  = parseFloat(opt.dataset.lng);
        startName = opt.text;
      }

      const destSel = document.getElementById('destDistrictNav');
      const destOpt = destSel.options[destSel.selectedIndex];
      if (!destOpt) { if (window.showToast) window.showToast("Varış noktası seçin.", "error"); return; }
      const endLat  = parseFloat(destOpt.dataset.lat);
      const endLng  = parseFloat(destOpt.dataset.lng);
      const endName = destOpt.text;

      calculateBtn.innerHTML = "⌛ Hesaplanıyor...";
      calculateBtn.disabled  = true;

      // OSRM — mesafe ve süre hesabı
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=false&alternatives=true`;
      const response = await fetch(osrmUrl);
      const data     = await response.json();
      if (data.code !== 'Ok') throw new Error('Rota bulunamadı');

      navActiveRoutes        = data.routes;
      navCurrentSelectedIndex = 0;

      // Google Maps haritasını rota olarak güncelle
      setGoogleMapRoute(startLat, startLng, endLat, endLng);

      // Alternatif rota butonları
      const buttonsWrap = document.getElementById("navRouteButtonsWrap");
      buttonsWrap.innerHTML = "";
      if (navActiveRoutes.length > 1) {
        buttonsWrap.style.display = "flex";
        navActiveRoutes.forEach((route, i) => {
          const btn = document.createElement("button");
          btn.className = `btn ${i === 0 ? 'primary' : 'ghost'}`;
          btn.style.cssText = "padding:6px 12px; font-size:11px;";
          btn.textContent = `Rota ${i + 1} (${(route.distance / 1000).toFixed(1)} km)`;
          btn.onclick = () => selectNavRoute(i);
          buttonsWrap.appendChild(btn);
        });
      } else {
        buttonsWrap.style.display = "none";
      }

      // Google Maps'te Aç butonu — navigasyon için
      const gmapsLink = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=driving`;
      let openBtnWrap = document.getElementById('navGmapsOpenWrap');
      if (!openBtnWrap) {
        openBtnWrap = document.createElement('div');
        openBtnWrap.id = 'navGmapsOpenWrap';
        openBtnWrap.style.cssText = 'margin-top:10px; text-align:center;';
        document.getElementById("navResultBox").appendChild(openBtnWrap);
      }
      openBtnWrap.innerHTML = `
        <a href="${gmapsLink}" target="_blank" style="
          display:inline-flex; align-items:center; gap:8px;
          background:#4285F4; color:#fff; border-radius:10px;
          padding:10px 20px; font-weight:800; font-size:13px;
          text-decoration:none; box-shadow:0 4px 12px rgba(66,133,244,0.4);
          transition:filter 0.2s;
        " onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#fff"/>
          </svg>
          Google Maps'te Navigasyonu Başlat
        </a>`;

      document.getElementById("navResultBox").style.display = "block";
      selectNavRoute(0);

    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast("Rota bulunamadı veya bir hata oluştu.", "error");
    } finally {
      calculateBtn.innerHTML = originalText;
      calculateBtn.disabled  = false;
    }
  }

  function selectNavRoute(index) {
    if (!navActiveRoutes[index]) return;
    navCurrentSelectedIndex = index;
    const route = navActiveRoutes[index];

    const distanceKm    = route.distance / 1000;
    const fuelCostPerKm = parseFloat(document.getElementById("navFuelCostPerKm").value) || 0;
    const isRoundTrip   = document.getElementById("navRoundTrip").checked;
    const displayDist   = isRoundTrip ? distanceKm * 2 : distanceKm;
    const totalCost     = displayDist * fuelCostPerKm;

    document.getElementById("navDistanceResult").textContent = `${displayDist.toFixed(1)} km`;
    document.getElementById("navCostResult").textContent     = formatCurrency(totalCost);

    const buttons = document.querySelectorAll("#navRouteButtonsWrap button");
    buttons.forEach((btn, i) => {
      btn.classList.toggle("primary", i === index);
      btn.classList.toggle("ghost",   i !== index);
    });
  }

  window.updateNavCalculation = function () {
    selectNavRoute(navCurrentSelectedIndex);
  };



  // ═══════════════ BAŞLATMA ═══════════════
  async function init() {
    bindFuel();
    await renderFuelSummary();
    await renderFuelTable();
    setTimeout(() => { if (typeof window.fetchFuelPrices === 'function') window.fetchFuelPrices(); }, 1200);
    console.log('✅ Yakıt modülü (Supabase) başlatıldı');
  }

  return { init, selectNavRoute };
})();