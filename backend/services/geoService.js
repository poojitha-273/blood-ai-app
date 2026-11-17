const supabase = require('../config/supabase');

function resolveNominatimUserAgent() {
  const rawOrigin =
    process.env.CLIENT_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'https://lifelink.health';
  const normalizedOrigin = /^https?:\/\//i.test(rawOrigin)
    ? rawOrigin.replace(/\/+$/, '')
    : `https://${rawOrigin}`.replace(/\/+$/, '');
  return `LifeLinkBloodAI/1.0 (${normalizedOrigin})`;
}

const NOMINATIM_UA = resolveNominatimUserAgent();
const geocodeCache = new Map();

function hasValidCoords(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') {
    return false;
  }
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  if (nLat === 0 && nLng === 0) return false;
  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

function isWithinIndia(lat, lng) {
  return hasValidCoords(lat, lng) && lat >= 6 && lat <= 38.5 && lng >= 67 && lng <= 98.5;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function calculateDistanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatNominatimPlace(item) {
  const addr = item?.address || {};
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
  const state = addr.state || '';
  const locality = addr.suburb || addr.neighbourhood || addr.road || '';
  const shortLabel = [locality, city, state].filter(Boolean).slice(0, 3).join(', ') || item?.display_name || '';
  return {
    label: shortLabel,
    fullName: item?.display_name || shortLabel,
    city,
    state,
    lat: Number(Number(item.lat).toFixed(6)),
    lng: Number(Number(item.lon).toFixed(6)),
  };
}

async function forwardGeocode(query, limit = 5, timeoutMs = 6000) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const cacheKey = `fwd:${limit}:${q.toLowerCase()}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
  const upstream = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!upstream.ok) {
    throw new Error(`Nominatim HTTP ${upstream.status}`);
  }
  const rows = await upstream.json();
  const mapped = (Array.isArray(rows) ? rows : []).map(formatNominatimPlace);
  geocodeCache.set(cacheKey, mapped);
  if (geocodeCache.size > 400) geocodeCache.clear();
  return mapped;
}

async function reverseGeocode(lat, lng, timeoutMs = 6000) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!hasValidCoords(nLat, nLng)) {
    throw new Error('Invalid coordinates');
  }
  const cacheKey = `rev:${nLat.toFixed(3)},${nLng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${nLat}&lon=${nLng}`;
  const upstream = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!upstream.ok) {
    throw new Error(`Nominatim reverse HTTP ${upstream.status}`);
  }
  const item = await upstream.json();
  const formatted = item?.lat ? formatNominatimPlace(item) : { label: '', fullName: '', city: '', state: '', lat: nLat, lng: nLng };
  geocodeCache.set(cacheKey, formatted);
  if (geocodeCache.size > 400) geocodeCache.clear();
  return formatted;
}

// ---------- Official e-RaktKosh (Ministry of Health & Family Welfare, India) Real-Time Feed ----------
const ERAKTKOSH_BASE = 'https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank';
const CACHE_TTL_MS = 15 * 60 * 1000;

let indiaBankCache = {
  data: null,
  fetchedAt: 0,
  inflight: null,
};

const directoryCache = new Map();

function stripHtmlTags(raw) {
  return String(raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchJsonSafe(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': NOMINATIM_UA,
      Accept: 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
  return res.json();
}

async function loadIndiaRealtimeFromUpstream() {
  const [liveRows, allRows, dbBanksResult] = await Promise.all([
    fetchJsonSafe(`${ERAKTKOSH_BASE}/campSchedule.cnt?hmode=FETCHACTIVELOCATIONS`).catch(() => []),
    fetchJsonSafe(`${ERAKTKOSH_BASE}/campSchedule.cnt?hmode=FETCHACTIVELOCATIONS&bbDataType=1`).catch(() => []),
    supabase
      .from('users')
      .select('id, name, phone, address, city, state, latitude, longitude')
      .eq('role', 'blood_bank')
      .then((r) => r)
      .catch(() => ({ data: [] })),
  ]);

  const activeCodes = new Set();
  if (Array.isArray(liveRows)) {
    for (const row of liveRows) {
      if (Array.isArray(row) && row[3] !== undefined && row[3] !== null) {
        activeCodes.add(String(row[3]));
      }
    }
  }

  const byKey = new Map();

  // Merge LifeLink DB blood banks inside India first so they retain phone/address details
  for (const bb of dbBanksResult?.data || []) {
    const lat = Number(bb.latitude);
    const lng = Number(bb.longitude);
    if (!isWithinIndia(lat, lng)) continue;
    const key = `ll-${bb.id}`;
    byKey.set(key, {
      id: key,
      code: String(bb.id),
      name: bb.name || 'LifeLink Blood Bank',
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      liveOnline: true,
      source: 'LifeLink Network',
      address: [bb.address, bb.city, bb.state].filter(Boolean).join(', '),
      phone: bb.phone || '',
      city: bb.city || '',
      state: bb.state || '',
    });
  }

  // Merge all e-RaktKosh India registered & live-enabled blood banks
  const combinedOsm = [
    ...(Array.isArray(liveRows) ? liveRows : []),
    ...(Array.isArray(allRows) ? allRows : []),
  ];

  for (const row of combinedOsm) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const name = String(row[0] || '').trim();
    const lat = Number(row[1]);
    const lng = Number(row[2]);
    const code = row[3] !== undefined && row[3] !== null ? String(row[3]) : '';
    if (!name || !isWithinIndia(lat, lng)) continue;

    const dedupKey = code ? `erakt-${code}` : `geo-${name.toLowerCase()}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
    const isLive = code ? activeCodes.has(code) : false;

    const existing = byKey.get(dedupKey);
    if (existing) {
      if (isLive) existing.liveOnline = true;
      continue;
    }

    byKey.set(dedupKey, {
      id: dedupKey,
      code,
      name,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      liveOnline: isLive,
      source: 'e-RaktKosh India',
    });
  }

  const banks = Array.from(byKey.values());
  const liveOnlineCount = banks.filter((b) => b.liveOnline).length;
  return {
    source: 'e-RaktKosh (Ministry of Health & Family Welfare, Govt. of India) + LifeLink Network',
    fetchedAt: new Date().toISOString(),
    totalCount: banks.length,
    liveOnlineCount,
    banks,
  };
}

async function fetchIndiaRealtimeBloodBanks(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && indiaBankCache.data && now - indiaBankCache.fetchedAt < CACHE_TTL_MS) {
    return indiaBankCache.data;
  }

  if (indiaBankCache.inflight) {
    return indiaBankCache.inflight;
  }

  indiaBankCache.inflight = loadIndiaRealtimeFromUpstream()
    .then((payload) => {
      if (payload.totalCount > 0 || !indiaBankCache.data) {
        indiaBankCache.data = payload;
        indiaBankCache.fetchedAt = Date.now();
      }
      return indiaBankCache.data || payload;
    })
    .catch((err) => {
      if (indiaBankCache.data) return indiaBankCache.data;
      throw err;
    })
    .finally(() => {
      indiaBankCache.inflight = null;
    });

  return indiaBankCache.inflight;
}

async function fetchERaktKoshStates() {
  const key = 'states';
  const cached = directoryCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS * 4) return cached.data;

  const list = await fetchJsonSafe(`${ERAKTKOSH_BASE}/nearbyBB.cnt?hmode=GETSTATELIST`, 10000);
  const formatted = (Array.isArray(list) ? list : [])
    .filter((s) => s && s.value && Number(s.value) > 0)
    .map((s) => ({ code: String(s.value), name: String(s.label || '').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  directoryCache.set(key, { at: Date.now(), data: formatted });
  return formatted;
}

async function fetchERaktKoshDistricts(stateCode) {
  const code = String(stateCode || '').trim();
  if (!code) return [];
  const key = `dist:${code}`;
  const cached = directoryCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS * 4) return cached.data;

  const payload = await fetchJsonSafe(
    `${ERAKTKOSH_BASE}/nearbyBB.cnt?hmode=GETDISTRICTLIST&selectedStateCode=${encodeURIComponent(code)}`,
    10000
  );
  const formatted = (Array.isArray(payload?.records) ? payload.records : [])
    .filter((d) => d && d.value)
    .map((d) => ({ code: String(d.value), name: String(d.id || '').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  directoryCache.set(key, { at: Date.now(), data: formatted });
  return formatted;
}

async function fetchERaktKoshDirectory(stateCode, districtCode = '-1') {
  const st = String(stateCode || '').trim();
  const dist = String(districtCode || '-1').trim() || '-1';
  if (!st) return [];
  const key = `dir:${st}:${dist}`;
  const cached = directoryCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const payload = await fetchJsonSafe(
    `${ERAKTKOSH_BASE}/nearbyBB.cnt?hmode=GETNEARBYBLOODBANK&stateCode=${encodeURIComponent(st)}&districtCode=${encodeURIComponent(dist)}`,
    12000
  );
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const formatted = rows.map((row, idx) => {
    const htmlCamp = String(row[7] || '');
    const codeMatch = htmlCamp.match(/hospitalCode=(\d+)/i);
    return {
      srNo: stripHtmlTags(row[0]) || String(idx + 1),
      code: codeMatch ? codeMatch[1] : '',
      name: stripHtmlTags(row[1]),
      address: stripHtmlTags(row[2]),
      phone: stripHtmlTags(row[3]),
      email: stripHtmlTags(row[4]),
      category: stripHtmlTags(row[5]),
      type: stripHtmlTags(row[6]),
    };
  });

  directoryCache.set(key, { at: Date.now(), data: formatted });
  return formatted;
}

module.exports = {
  hasValidCoords,
  isWithinIndia,
  calculateDistanceKm,
  forwardGeocode,
  reverseGeocode,
  fetchIndiaRealtimeBloodBanks,
  fetchERaktKoshStates,
  fetchERaktKoshDistricts,
  fetchERaktKoshDirectory,
};
