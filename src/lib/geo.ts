export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calculateDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return 'Near';
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

export function estimateDrivingMinutes(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 4;
  return Math.max(3, Math.round(km * 2.4 + 2));
}

export function hasValidCoords(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001;
}

export function offsetLatLng(origin: LatLng, offsetLatDeg: number, offsetLngDeg: number): LatLng {
  return {
    lat: Number((origin.lat + offsetLatDeg).toFixed(6)),
    lng: Number((origin.lng + offsetLngDeg).toFixed(6)),
  };
}

export function interpolateLatLng(origin: LatLng, destination: LatLng, progress: number): LatLng {
  const t = Math.max(0, Math.min(1, progress));
  return {
    lat: Number((origin.lat + (destination.lat - origin.lat) * t).toFixed(6)),
    lng: Number((origin.lng + (destination.lng - origin.lng) * t).toFixed(6)),
  };
}

export function buildGoogleMapsDirectionsUrl(
  destination: LatLng | string,
  origin?: LatLng | null
): string {
  const params = new URLSearchParams({ api: '1', travelmode: 'driving' });
  if (typeof destination === 'string') {
    params.set('destination', destination);
  } else {
    params.set('destination', `${destination.lat},${destination.lng}`);
  }
  if (origin && hasValidCoords(origin.lat, origin.lng)) {
    params.set('origin', `${origin.lat},${origin.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsPointUrl(point: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}
