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

  // ═══════════════ NAVİGASYON FONKSİYONLARI (DEĞİŞMEDİ) ═══════════════
  window.switchFuelTab = function (tab) {
    const mainSec = document.getElementById("fuelMainSection");
    const navSec = document.getElementById("fuelNavSection");
    const addrSec = document.getElementById("fuelAddressSection");
    const btnMain = document.getElementById("btnFuelMain");
    const btnNav = document.getElementById("btnFuelNav");
    const btnAddress = document.getElementById("btnFuelAddress");

    // Tüm sekmeleri gizle
    if (mainSec) mainSec.style.display = "none";
    if (navSec) navSec.style.display = "none";
    if (addrSec) addrSec.style.display = "none";
    if (btnMain) btnMain.classList.remove("active");
    if (btnNav) btnNav.classList.remove("active");
    if (btnAddress) btnAddress.classList.remove("active");

    if (tab === 'main') {
      if (mainSec) mainSec.style.display = "block";
      if (btnMain) btnMain.classList.add("active");
    } else if (tab === 'nav') {
      if (navSec) navSec.style.display = "block";
      if (btnNav) btnNav.classList.add("active");
      if (!navMap) {
        initNavMap();
        loadNavCitiesData();
      } else {
        setTimeout(() => navMap.invalidateSize(), 100);
      }
      fillNavFuelCost();
    } else if (tab === 'address') {
      if (addrSec) addrSec.style.display = "block";
      if (btnAddress) btnAddress.classList.add("active");
      if (typeof AddressModule !== 'undefined') AddressModule.renderAddresses();
    }
  };

  async function fillNavFuelCost() {
    try {
      const { data: records } = await getSB()
        .from('fuel_records')
        .select('amount, km');

      const km = records ? records.reduce((sum, r) => sum + Number(r.km), 0) : 0;
      const amt = records ? records.reduce((sum, r) => sum + Number(r.amount), 0) : 0;
      const avgCost = km > 0 ? (amt / km) : 2.5;
      const input = document.getElementById("navFuelCostPerKm");
      if (input) input.value = avgCost.toFixed(2);
    } catch (e) {
      // sessizce devam et
    }
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
    async function startActualLocationFetch() {
      if (!navMap) initNavMap();
      const originalText = btn.innerHTML;
      btn.innerHTML = "⌛ Konum Alınıyor...";
      btn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (isNaN(lat) || isNaN(lng)) {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.showToast) window.showToast('❌ Geçersiz koordinat alındı.', 'error');
            return;
          }
        navUserLocation = { lat, lng, name: "Mevcut Konum", il: '', ilce: '' };
        document.getElementById("originSelectWrap").style.display = "none";
        document.getElementById("activeLocationBadge").style.display = "flex";
        document.getElementById("clearLocationBtn").style.display = "block";
        // Kaydet butonunu göster ve olayı bağla
        const saveAddrBtn = document.getElementById("saveAddressBtn");
        if (saveAddrBtn) {
          saveAddrBtn.style.display = "inline-flex";
          saveAddrBtn.onclick = () => {
            if (typeof AddressModule !== 'undefined') {
              AddressModule.showAddressModal({ lat, lng, il: navUserLocation.il || '', ilce: navUserLocation.ilce || '' });
            }
          };
        }
        btn.style.display = "none";
        if (navUserMarker) navMap.removeLayer(navUserMarker);
        const m = L.marker([lat, lng], { icon: L.divIcon({ className: 'custom-marker', html: '🔵', iconSize: [25, 25] }) }).bindPopup("Konumunuz alınıyor...").addTo(navMap);
        navUserMarker = m;
        navMap.setView([lat, lng], 15);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=tr`);
          const data = await res.json();
          navUserLocation.name = data.display_name || 'Adres bulunamadı';

          // İl/ilçe bilgisini parse et
          if (data.address) {
            navUserLocation.il = data.address.province || data.address.state || '';
            navUserLocation.ilce = data.address.town || data.address.city_district
              || data.address.district || data.address.suburb || '';
          }

          // Kısa ve net adres formatı (Sokak No, İlçe / Şehir)
          let adresTam = '';
          if (typeof AddressModule !== 'undefined' && data.address) {
            adresTam = AddressModule.formatNominatimAddress(data.address);
          }
          if (!adresTam) adresTam = navUserLocation.name; // Fallback: tam display_name
          navUserLocation.adresTam = adresTam;

          m.setPopupContent(`📍 <b>Konumunuz:</b><br>${adresTam || navUserLocation.name}`).openPopup();
          document.getElementById('navAddressText').textContent = adresTam || navUserLocation.name;

          // Kaydet butonunu güncelle: adresTam'ı da ilet
          const saveAddrBtn2 = document.getElementById('saveAddressBtn');
          if (saveAddrBtn2) {
            saveAddrBtn2.onclick = () => {
              if (typeof AddressModule !== 'undefined') {
                AddressModule.showAddressModal({
                  lat,
                  lng,
                  il: navUserLocation.il || '',
                  ilce: navUserLocation.ilce || '',
                  adresTam: navUserLocation.adresTam || ''
                });
              }
            };
          }
        } catch { }
        btn.innerHTML = originalText;
        btn.disabled = false;
      },
      (err) => {
        if (window.showToast) window.showToast('❌ Konum alınamadı. Lütfen izin verin.', 'error');
        else alert("Konum alınamadı.");
        btn.innerHTML = originalText;
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    }

    if (!navigator.geolocation) {
      if (window.showToast) window.showToast('❌ Tarayıcınız konum özelliğini desteklemiyor.', 'error');
      return;
    }

    const modal = document.getElementById('locationPermissionModal');
    const allowBtn = document.getElementById('allowLocationBtn');
    const denyBtn = document.getElementById('denyLocationBtn');
    const btn = document.getElementById("useMyLocationBtn");

    // Permission check to avoid redundant modal
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') {
          await startActualLocationFetch();
          return;
        } else if (result.state === 'denied') {
          if (window.showToast) window.showToast('❌ Konum izni reddedildi. Tarayıcı ayarlarından izin verin.', 'error');
          return;
        }
        // else: 'prompt' — show modal
      } catch (e) {
        console.warn('Permission check failed:', e);
        // Fall through to modal
      }
    }

    if (modal && allowBtn && denyBtn) {
      modal.style.display = 'flex';

      allowBtn.onclick = () => {
        modal.style.display = 'none';
        startActualLocationFetch();
      };

      denyBtn.onclick = () => {
        modal.style.display = 'none';
      };
    } else {
      startActualLocationFetch();
    }
  }


  function clearUserLocation() {
    navUserLocation = null;
    document.getElementById("originSelectWrap").style.display = "block";
    document.getElementById("activeLocationBadge").style.display = "none";
    document.getElementById("clearLocationBtn").style.display = "none";
    document.getElementById("useMyLocationBtn").style.display = "flex";
    // Kaydet butonunu gizle
    const saveAddrBtn = document.getElementById("saveAddressBtn");
    if (saveAddrBtn) saveAddrBtn.style.display = "none";

    if (navMap && navUserMarker) {
      navMap.removeLayer(navUserMarker);
      navUserMarker = null;
    }
  }

  async function calculateAndShowNavRoute() {
    const calculateBtn = document.getElementById("calculateNavBtn");
    const originalText = calculateBtn.innerHTML;

    try {
      let startLat, startLng, startName;

      if (!navMap) initNavMap();
      navMap.invalidateSize(); // Fix possible zero-size issues

      if (navUserLocation) {
        startLat = navUserLocation.lat;
        startLng = navUserLocation.lng;
        startName = navUserLocation.name;
      } else {
        const originDistrictSelect = document.getElementById('originDistrictNav');
        const opt = originDistrictSelect.options[originDistrictSelect.selectedIndex];
        if (!opt) {
          if (window.showToast) window.showToast("Lütfen başlangıç noktası seçin.", "error");
          else alert("Lütfen başlangıç noktası seçin.");
          return;
        }
        startLat = parseFloat(opt.dataset.lat);
        startLng = parseFloat(opt.dataset.lng);
        startName = opt.text;
      }

      const destDistrictSelect = document.getElementById('destDistrictNav');
      const destOpt = destDistrictSelect.options[destDistrictSelect.selectedIndex];
      if (!destOpt) {
        if (window.showToast) window.showToast("Lütfen varış noktası seçin.", "error");
        else alert("Lütfen varış noktası seçin.");
        return;
      }
      const endLat = parseFloat(destOpt.dataset.lat);
      const endLng = parseFloat(destOpt.dataset.lng);
      const endName = destOpt.text;

      calculateBtn.innerHTML = "⌛ Hesaplanıyor...";
      calculateBtn.disabled = true;

      // OSRM API Call
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok') throw new Error('Rota bulunamadı');

      navActiveRoutes = data.routes;
      navCurrentSelectedIndex = 0;

      // Clear old layers
      navRouteLayers.forEach(layer => navMap.removeLayer(layer));
      navRouteLayers = [];
      navMarkers.forEach(marker => navMap.removeLayer(marker));
      navMarkers = [];

      // Add Markers
      const startMarker = L.marker([startLat, startLng], {
        icon: L.divIcon({ className: 'custom-marker', html: '🚩', iconSize: [25, 25] })
      }).addTo(navMap).bindPopup(`<b>Başlangıç:</b><br>${startName}`);

      const endMarker = L.marker([endLat, endLng], {
        icon: L.divIcon({ className: 'custom-marker', html: '🏁', iconSize: [25, 25] })
      }).addTo(navMap).bindPopup(`<b>Varış:</b><br>${endName}`);

      navMarkers.push(startMarker, endMarker);

      // UI Update
      document.getElementById("navResultBox").style.display = "block";

      // Render Route Buttons if alternatives exist
      const buttonsWrap = document.getElementById("navRouteButtonsWrap");
      buttonsWrap.innerHTML = "";
      if (navActiveRoutes.length > 1) {
        buttonsWrap.style.display = "flex";
        navActiveRoutes.forEach((route, i) => {
          const btn = document.createElement("button");
          btn.className = `btn ${i === 0 ? 'primary' : 'ghost'}`;
          btn.style.padding = "6px 12px";
          btn.style.fontSize = "11px";
          btn.textContent = `Rota ${i + 1} (${(route.distance / 1000).toFixed(1)} km)`;
          btn.onclick = () => selectNavRoute(i);
          buttonsWrap.appendChild(btn);
        });
      } else {
        buttonsWrap.style.display = "none";
      }

      selectNavRoute(0);

    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast("Rota bulunamadı veya bir hata oluştu.", "error");
      else alert("Rota hesaplanırken bir hata oluştu: " + err.message);
    } finally {
      calculateBtn.innerHTML = originalText;
      calculateBtn.disabled = false;
    }
  }

  function selectNavRoute(index) {
    if (!navActiveRoutes[index]) return;
    navCurrentSelectedIndex = index;
    const route = navActiveRoutes[index];

    // Clear old route lines
    navRouteLayers.forEach(layer => navMap.removeLayer(layer));
    navRouteLayers = [];

    // Draw Polyline
    const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    const polyline = L.polyline(coordinates, {
      color: '#fcd535',
      weight: 6,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(navMap);

    navRouteLayers.push(polyline);
    navMap.invalidateSize();
    navMap.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    // Update UI
    const distanceKm = route.distance / 1000;
    const fuelCostPerKm = parseFloat(document.getElementById("navFuelCostPerKm").value) || 0;
    const isRoundTrip = document.getElementById("navRoundTrip").checked;

    const displayDistance = isRoundTrip ? distanceKm * 2 : distanceKm;
    const totalCost = displayDistance * fuelCostPerKm;

    document.getElementById("navDistanceResult").textContent = `${displayDistance.toFixed(1)} km`;
    document.getElementById("navCostResult").textContent = formatCurrency(totalCost);

    // Update Button styles
    const buttons = document.querySelectorAll("#navRouteButtonsWrap button");
    buttons.forEach((btn, i) => {
      if (i === index) {
        btn.classList.add("primary");
        btn.classList.remove("ghost");
      } else {
        btn.classList.remove("primary");
        btn.classList.add("ghost");
      }
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