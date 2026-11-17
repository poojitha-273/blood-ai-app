import { useState, useEffect, useCallback, useRef } from 'react';
import { LatLng, calculateDistanceKm, hasValidCoords } from '../lib/geo';
import { authAPI } from '../lib/api';

export type GpsStatus =
  | 'idle'
  | 'locating'
  | 'active'
  | 'paused'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface GpsState {
  coords: LatLng | null;
  accuracyMeters: number | null;
  isCoarseLocation: boolean;
  locationLabel: string | null;
  status: GpsStatus;
  source: 'browser-gps' | 'manual' | 'none';
  error: string | null;
  lastUpdated: string | null;
  consentEnabled: boolean;
  requestGps: () => void;
  pauseGps: () => void;
  setManualLocation: (coords: LatLng, label?: string) => void;
}

const CONSENT_STORAGE_KEY = 'lifelink_gps_consent';
const SESSION_COORDS_KEY = 'lifelink_gps_session';
const MANUAL_PIN_KEY = 'lifelink_gps_pinned';
const GPS_SYNC_EVENT = 'lifelink:gps-sync';

interface StoredGpsPayload {
  coords: LatLng;
  accuracyMeters: number | null;
  source: 'browser-gps' | 'manual';
  locationLabel?: string | null;
  savedAt: number;
}

function readStoredPin(): StoredGpsPayload | null {
  try {
    const raw = localStorage.getItem(MANUAL_PIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.coords && hasValidCoords(parsed.coords.lat, parsed.coords.lng)) {
      return {
        coords: parsed.coords,
        accuracyMeters: null,
        source: 'manual',
        locationLabel: parsed.locationLabel || null,
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      };
    }
  } catch {
    // Ignore storage read issues
  }
  return null;
}

function readCachedSessionCoords(): StoredGpsPayload | null {
  try {
    const raw = sessionStorage.getItem(SESSION_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.coords &&
      hasValidCoords(parsed.coords.lat, parsed.coords.lng) &&
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt < 10 * 60 * 1000
    ) {
      return {
        coords: parsed.coords,
        accuracyMeters: typeof parsed.accuracyMeters === 'number' ? parsed.accuracyMeters : null,
        source: 'browser-gps',
        locationLabel: parsed.locationLabel || null,
        savedAt: parsed.savedAt,
      };
    }
  } catch {
    // Ignore storage read issues
  }
  return null;
}

export function useGpsLocation(options?: { syncBackend?: boolean; watch?: boolean }): GpsState {
  const syncBackend = options?.syncBackend ?? true;
  const watch = options?.watch ?? true;

  const initialConsent = (() => {
    try {
      return localStorage.getItem(CONSENT_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  })();

  const initialPinned = readStoredPin();
  const initialCached = initialPinned || readCachedSessionCoords();

  const [consentEnabled, setConsentEnabled] = useState<boolean>(initialConsent);
  const [coords, setCoords] = useState<LatLng | null>(initialCached?.coords || null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(
    initialCached?.accuracyMeters ?? null
  );
  const [locationLabel, setLocationLabel] = useState<string | null>(
    initialCached?.locationLabel ?? null
  );
  const [status, setStatus] = useState<GpsStatus>(
    initialPinned
      ? 'active'
      : !initialConsent
      ? 'paused'
      : initialCached?.coords
      ? 'active'
      : 'locating'
  );
  const [source, setSource] = useState<'browser-gps' | 'manual' | 'none'>(
    initialCached ? initialCached.source : 'none'
  );
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(
    initialCached?.savedAt ? new Date(initialCached.savedAt).toISOString() : null
  );

  const watchIdRef = useRef<number | null>(null);
  const lastSyncedRef = useRef<LatLng | null>(null);
  const lastGeocodedRef = useRef<LatLng | null>(null);
  const sourceRef = useRef<'browser-gps' | 'manual' | 'none'>(
    initialCached ? initialCached.source : 'none'
  );
  const accuracyRef = useRef<number | null>(initialCached?.accuracyMeters ?? null);

  const clearWatcher = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const syncCoordsToProfile = useCallback(
    async (next: LatLng, city?: string, state?: string) => {
      if (!syncBackend) return;
      const token = localStorage.getItem('token');
      if (!token) return;
      if (lastSyncedRef.current && calculateDistanceKm(lastSyncedRef.current, next) < 0.1 && !city) {
        return;
      }
      lastSyncedRef.current = next;
      try {
        await authAPI.updateLocation(next.lat, next.lng, city, state);
      } catch {
        // Non-blocking profile location sync
      }
    },
    [syncBackend]
  );

  const resolveLabelAndSync = useCallback(
    async (next: LatLng, explicitLabel?: string) => {
      if (explicitLabel) {
        setLocationLabel(explicitLabel);
        syncCoordsToProfile(next);
        return;
      }
      if (lastGeocodedRef.current && calculateDistanceKm(lastGeocodedRef.current, next) < 0.25) {
        syncCoordsToProfile(next);
        return;
      }
      lastGeocodedRef.current = next;
      try {
        const place = await authAPI.reverseGeocode(next.lat, next.lng);
        if (place?.label) {
          setLocationLabel(place.label);
        }
        syncCoordsToProfile(next, place?.city, place?.state);
      } catch {
        syncCoordsToProfile(next);
      }
    },
    [syncCoordsToProfile]
  );

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      // Never let background browser geolocation override a user's explicit pinned/searched spot
      if (sourceRef.current === 'manual') return;

      const next: LatLng = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
      };
      const accuracy = typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null;

      // Ignore coarse IP drift when a high-precision fix is already locked
      if (
        accuracyRef.current !== null &&
        accuracyRef.current <= 250 &&
        accuracy !== null &&
        accuracy > 2000
      ) {
        return;
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      sourceRef.current = 'browser-gps';
      accuracyRef.current = accuracy;
      setCoords(next);
      setAccuracyMeters(accuracy);
      setStatus('active');
      setSource('browser-gps');
      setError(null);
      setLastUpdated(nowIso);

      try {
        sessionStorage.setItem(
          SESSION_COORDS_KEY,
          JSON.stringify({ coords: next, accuracyMeters: accuracy, source: 'browser-gps', savedAt: now })
        );
      } catch {
        // Ignore storage write issues
      }

      resolveLabelAndSync(next);
    },
    [resolveLabelAndSync]
  );

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    if (sourceRef.current === 'manual') return;
    if (err.code === err.PERMISSION_DENIED) {
      setStatus('denied');
      setError('Location permission denied. Allow browser location or search/pin your location on the map.');
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setStatus('unavailable');
      setError('GPS signal unavailable on this device. Search your area or click Pin on Map below.');
    } else {
      setStatus('error');
      setError('GPS lock timed out. Click Refresh GPS or search/pin your location on the map.');
    }
  }, []);

  const startTracking = useCallback(
    (forceFresh = false) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setStatus('unavailable');
        setError('Browser Geolocation API is not supported on this device.');
        return;
      }

      clearWatcher();
      setStatus((prev) => (!forceFresh && prev === 'active' && coords ? 'active' : 'locating'));
      setError(null);

      navigator.geolocation.getCurrentPosition(handlePosition, handleGeoError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      if (watch) {
        watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleGeoError, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        });
      }
    },
    [clearWatcher, coords, handleGeoError, handlePosition, watch]
  );

  const requestGps = useCallback(() => {
    sourceRef.current = 'none';
    accuracyRef.current = null;
    lastGeocodedRef.current = null;
    setSource('none');
    setLocationLabel(null);
    setConsentEnabled(true);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
      localStorage.removeItem(MANUAL_PIN_KEY);
      sessionStorage.removeItem(SESSION_COORDS_KEY);
    } catch {
      // Ignore storage write issues
    }
    startTracking(true);
  }, [startTracking]);

  const pauseGps = useCallback(() => {
    clearWatcher();
    setConsentEnabled(false);
    setStatus('paused');
    setError(null);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'false');
    } catch {
      // Ignore storage write issues
    }
  }, [clearWatcher]);

  const setManualLocation = useCallback(
    (manual: LatLng, customLabel?: string) => {
      if (!hasValidCoords(manual.lat, manual.lng)) return;
      clearWatcher();

      const next: LatLng = {
        lat: Number(manual.lat.toFixed(6)),
        lng: Number(manual.lng.toFixed(6)),
      };
      const savedAt = Date.now();

      sourceRef.current = 'manual';
      accuracyRef.current = null;
      lastGeocodedRef.current = null;
      setCoords(next);
      setAccuracyMeters(null);
      setStatus('active');
      setSource('manual');
      setError(null);
      setLastUpdated(new Date(savedAt).toISOString());

      const payload: StoredGpsPayload = {
        coords: next,
        accuracyMeters: null,
        source: 'manual',
        locationLabel: customLabel || null,
        savedAt,
      };

      try {
        localStorage.setItem(MANUAL_PIN_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent(GPS_SYNC_EVENT, { detail: payload }));
      } catch {
        // Ignore storage write issues
      }

      resolveLabelAndSync(next, customLabel);
    },
    [clearWatcher, resolveLabelAndSync]
  );

  useEffect(() => {
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<StoredGpsPayload>).detail;
      if (!detail?.coords || !hasValidCoords(detail.coords.lat, detail.coords.lng)) return;
      if (detail.source === 'manual') {
        clearWatcher();
        sourceRef.current = 'manual';
        accuracyRef.current = null;
        setCoords(detail.coords);
        setAccuracyMeters(null);
        setSource('manual');
        setStatus('active');
        setError(null);
        if (detail.locationLabel) setLocationLabel(detail.locationLabel);
      }
    };
    window.addEventListener(GPS_SYNC_EVENT, onSync);
    return () => window.removeEventListener(GPS_SYNC_EVENT, onSync);
  }, [clearWatcher]);

  useEffect(() => {
    // Keep existing pinned location active unless user clicks Refresh GPS
    if (sourceRef.current === 'manual' && coords) {
      if (!locationLabel) {
        resolveLabelAndSync(coords);
      }
      return;
    }

    if (consentEnabled) {
      startTracking(false);
    } else {
      clearWatcher();
    }
    return () => {
      clearWatcher();
    };
    // Only run on consent toggle / initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentEnabled]);

  const isCoarseLocation =
    source === 'browser-gps' && accuracyMeters !== null && accuracyMeters > 1000;

  return {
    coords,
    accuracyMeters,
    isCoarseLocation,
    locationLabel,
    status,
    source,
    error,
    lastUpdated,
    consentEnabled,
    requestGps,
    pauseGps,
    setManualLocation,
  };
}
