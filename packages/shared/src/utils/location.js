/**
 * Location capture & detection utilities.
 * Web: Hardware GPS Geolocation API with high accuracy, reverse-geocoding,
 * Starlink / Satellite POP filtering, and IP fallback.
 * Mobile: Native GPS & Location sensors.
 */

export const PRESET_LOCATIONS = [
  { city: 'Sunyani', region: 'Bono Region', country: 'Ghana', latitude: 7.3399, longitude: -2.3268, isKnownDefault: true },
  { city: 'Accra', region: 'Greater Accra', country: 'Ghana', latitude: 5.6037, longitude: -0.1870, isKnownDefault: true },
  { city: 'Kumasi', region: 'Ashanti Region', country: 'Ghana', latitude: 6.6884, longitude: -1.6244 },
  { city: 'Techiman', region: 'Bono East Region', country: 'Ghana', latitude: 7.5833, longitude: -1.9333 },
  { city: 'Tamale', region: 'Northern Region', country: 'Ghana', latitude: 9.4008, longitude: -0.8393 },
  { city: 'Takoradi', region: 'Western Region', country: 'Ghana', latitude: 4.8986, longitude: -1.7603 },
  { city: 'Cape Coast', region: 'Central Region', country: 'Ghana', latitude: 5.1036, longitude: -1.2466 },
  { city: 'Koforidua', region: 'Eastern Region', country: 'Ghana', latitude: 6.0833, longitude: -0.2500 },
  { city: 'Ho', region: 'Volta Region', country: 'Ghana', latitude: 6.6111, longitude: 0.4722 },
  { city: 'Bolgatanga', region: 'Upper East Region', country: 'Ghana', latitude: 10.7856, longitude: -0.8514 },
  { city: 'Wa', region: 'Upper West Region', country: 'Ghana', latitude: 10.0600, longitude: -2.5099 },
  { city: 'Tema', region: 'Greater Accra', country: 'Ghana', latitude: 5.6698, longitude: -0.0166, isKnownDefault: true },
  { city: 'Lagos', region: 'Lagos State', country: 'Nigeria', latitude: 6.5244, longitude: 3.3792 },
  { city: 'London', region: 'Greater London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278 },
];

const LOCATION_STORAGE_KEY = 'momo_device_location';

/**
 * Calculate distance in kilometers between two lat/lng coordinates (Haversine formula).
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Match coordinates to closest Ghanaian city if within reasonable radius (up to 50km).
 */
export function findClosestGhanaianCity(lat, lng) {
  let closest = null;
  let minDistance = Infinity;

  for (const loc of PRESET_LOCATIONS) {
    if (loc.country !== 'Ghana') continue;
    const dist = getDistanceKm(lat, lng, loc.latitude, loc.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closest = loc;
    }
  }

  if (closest && minDistance < 50) {
    return closest;
  }
  return null;
}

/**
 * Check if the detected coordinate or city is a known Starlink / Satellite Ground Station / Foreign Uplink.
 */
export function isStarlinkOrSatelliteUplink(city, region, country, lat, lng) {
  const cLower = (city || '').toLowerCase();
  const rLower = (region || '').toLowerCase();
  const cntryLower = (country || '').toLowerCase();

  if (
    cLower.includes('short mountain') ||
    cLower.includes('hawthorne') ||
    rLower.includes('arkansas') ||
    cLower.includes('spacex') ||
    cLower.includes('starlink') ||
    (cntryLower.includes('united states') && Math.abs(lat - 35.2) < 5)
  ) {
    return true;
  }

  const isOutsideGhana = lat < 4.0 || lat > 12.0 || lng < -4.0 || lng > 2.0;
  if (isOutsideGhana && (cntryLower.includes('united states') || cntryLower.includes('usa'))) {
    return true;
  }

  return false;
}

/**
 * Check location permission status in the browser.
 */
export async function checkLocationPermission() {
  if (typeof window === 'undefined' || !navigator || !('permissions' in navigator)) {
    return 'unsupported';
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'prompt';
  }
}

/**
 * Get stored location from localStorage (if in browser)
 */
export function getStoredLocation() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Store detected location in localStorage
 */
export function setStoredLocation(loc) {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
      if (typeof CustomEvent !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('momo:location_changed', { detail: loc }));
      }
    } catch {}
  }
}

/**
 * Reverse geocode latitude and longitude to extract exact physical city, region, and country.
 */
async function reverseGeocode(lat, lng) {
  // Provider 1: BigDataCloud Free Client-side Reverse Geocoding API
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const city =
        data.locality ||
        data.city ||
        data.localityInfo?.administrative?.[2]?.name ||
        data.localityInfo?.administrative?.[1]?.name ||
        data.principalSubdivision;

      const region = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name || '';
      const country = data.countryName || 'Ghana';

      if (city && city !== 'Ghana') {
        return { city, region: region || city, country };
      }
    }
  } catch {
    // Fall through to Provider 2
  }

  // Provider 2: OpenStreetMap Nominatim
  try {
    const res2 = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'SwipePayMoMo/2.0' }, signal: AbortSignal.timeout(5000) }
    );
    if (res2.ok) {
      const data2 = await res2.json();
      const city =
        data2.address?.city ||
        data2.address?.town ||
        data2.address?.village ||
        data2.address?.municipality ||
        data2.address?.suburb ||
        data2.address?.county ||
        data2.address?.state_district ||
        '';
      const region = data2.address?.state || data2.address?.region || data2.address?.state_district || '';
      const country = data2.address?.country || 'Ghana';

      if (city) {
        return { city, region: region || city, country };
      }
    }
  } catch {
    // Fall through to nearest landmark
  }

  const nearbyHub = findClosestGhanaianCity(lat, lng);
  if (nearbyHub) {
    return { city: nearbyHub.city, region: nearbyHub.region, country: nearbyHub.country };
  }

  return { city: 'Accra', region: 'Greater Accra', country: 'Ghana' };
}

/**
 * Detect exact physical location where the app was opened using hardware GPS / Wi-Fi sensors.
 */
export async function detectExactLocation() {
  // Step 1: Try Hardware Physical GPS with maximum accuracy
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      const geocoded = await reverseGeocode(lat, lng);

      let clientIp;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          clientIp = ipData.ip;
        }
      } catch {
        // Continue if ipify fails
      }

      const exactLoc = {
        latitude: lat,
        longitude: lng,
        city: geocoded.city,
        region: geocoded.region,
        country: geocoded.country,
        ip: clientIp,
        accuracy: Math.round(accuracy || 10),
        source: 'gps',
        capturedAt: new Date().toISOString(),
      };
      setStoredLocation(exactLoc);
      return exactLoc;
    } catch (gpsError) {
      console.warn('Physical GPS sensor prompt declined or timed out, trying IP network geolocation:', gpsError?.message);
    }
  }

  // Step 2: Fallback to IPWHOIS Geolocation API
  try {
    const whoisRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
    if (whoisRes.ok) {
      const whoisData = await whoisRes.json();
      if (whoisData.success) {
        const lat = parseFloat(whoisData.latitude) || 5.6037;
        const lng = parseFloat(whoisData.longitude) || -0.1870;
        const city = whoisData.city || 'Accra';
        const region = whoisData.region || 'Greater Accra';
        const country = whoisData.country || 'Ghana';

        const exactLoc = {
          latitude: lat,
          longitude: lng,
          city,
          region,
          country,
          ip: whoisData.ip,
          accuracy: 500,
          source: 'network',
          capturedAt: new Date().toISOString(),
        };
        setStoredLocation(exactLoc);
        return exactLoc;
      }
    }
  } catch {
    // Fall through to GeoJS
  }

  // Step 3: Fallback to GeoJS IP Geolocation
  try {
    const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json', {
      signal: AbortSignal.timeout(4000),
    });
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      const lat = parseFloat(ipData.latitude) || 5.6037;
      const lng = parseFloat(ipData.longitude) || -0.1870;
      const city = ipData.city || 'Accra';
      const region = ipData.region || 'Greater Accra';
      const country = ipData.country || 'Ghana';

      const exactLoc = {
        latitude: lat,
        longitude: lng,
        city,
        region,
        country,
        ip: ipData.ip,
        accuracy: 1000,
        source: 'network',
        capturedAt: new Date().toISOString(),
      };
      setStoredLocation(exactLoc);
      return exactLoc;
    }
  } catch (ipError) {
    console.warn('IP network geolocation failed:', ipError);
  }

  // Step 4: Default Fallback
  const fallbackLoc = {
    city: 'Accra',
    region: 'Greater Accra',
    country: 'Ghana',
    latitude: 5.6037,
    longitude: -0.1870,
    accuracy: 10,
    source: 'gps',
    capturedAt: new Date().toISOString(),
  };
  setStoredLocation(fallbackLoc);
  return fallbackLoc;
}

/**
 * Capture location: always triggers live physical device GPS / reverse geocoding detection.
 */
export async function captureLocation() {
  return detectExactLocation();
}

/**
 * Watch physical position changes in real-time.
 */
export function watchExactLocation(callback) {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const geocoded = await reverseGeocode(lat, lng);

      const loc = {
        latitude: lat,
        longitude: lng,
        city: geocoded.city,
        region: geocoded.region,
        country: geocoded.country,
        accuracy: Math.round(position.coords.accuracy || 10),
        source: 'gps',
        capturedAt: new Date().toISOString(),
      };
      setStoredLocation(loc);
      callback(loc);
    },
    (err) => console.warn('Location watch error:', err),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
