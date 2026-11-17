import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Crosshair,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  Search,
  Loader2,
} from 'lucide-react';
import { GpsState } from '../hooks/useGpsLocation';
import { authAPI } from '../lib/api';
import {
  LatLng,
  hasValidCoords,
  formatDistanceKm,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPointUrl,
} from '../lib/geo';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'hospital' | 'blood_bank' | 'courier' | 'donor' | 'user';
  subtitle?: string;
  badge?: string;
  distanceKm?: number;
}

export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badge?: string;
  liveOnline?: boolean;
  source?: string;
  distanceKm?: number;
}

interface GoogleMapViewProps {
  markers?: MapMarker[];
  clusterPoints?: ClusterPoint[];
  center?: LatLng | null;
  gpsState?: GpsState;
  zoom?: number;
  height?: string;
  mapInstanceId?: string;
  showRoute?: boolean;
  origin?: { lat: number; lng: number; title?: string };
  destination?: { lat: number; lng: number; title?: string };
  courierPos?: { lat: number; lng: number; progress?: number };
  fitAllMarkers?: boolean;
  cameraKey?: string | number;
  legendMode?: 'all' | 'donors-only' | 'india-blood-banks';
}

function formatCoordLabel(coords: LatLng): string {
  const latDir = coords.lat >= 0 ? 'N' : 'S';
  const lngDir = coords.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(coords.lat).toFixed(4)}° ${latDir}, ${Math.abs(coords.lng).toFixed(4)}° ${lngDir}`;
}

export const GpsControlBanner: React.FC<{ gps: GpsState; portalLabel?: string }> = ({
  gps,
  portalLabel = 'Live GPS Radar',
}) => {
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState(gps.coords ? String(gps.coords.lat) : '');
  const [manualLng, setManualLng] = useState(gps.coords ? String(gps.coords.lng) : '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ label: string; fullName: string; city: string; state: string; lat: number; lng: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (gps.coords && !showManual) {
      setManualLat(String(gps.coords.lat));
      setManualLng(String(gps.coords.lng));
    }
  }, [gps.coords, showManual]);

  const handleApplyManual = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (hasValidCoords(lat, lng)) {
      gps.setManualLocation({ lat, lng });
      setShowManual(false);
    }
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError('');
    try {
      const results = await authAPI.geocode(q);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching address found. Try adding your city or pincode.');
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Address search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPlace = (place: { label: string; lat: number; lng: number }) => {
    gps.setManualLocation({ lat: place.lat, lng: place.lng }, place.label);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError('');
    setShowManual(false);
  };

  const accuracyText =
    gps.accuracyMeters !== null
      ? gps.accuracyMeters >= 1000
        ? `±${(gps.accuracyMeters / 1000).toFixed(1)} km IP estimate`
        : `±${gps.accuracyMeters}m`
      : '';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              gps.isCoarseLocation
                ? 'bg-amber-500 animate-pulse'
                : gps.status === 'active'
                ? 'bg-emerald-500 animate-pulse'
                : gps.status === 'locating'
                ? 'bg-amber-500 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{portalLabel}</span>
              {gps.status === 'active' && gps.coords && (
                <span
                  className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                    gps.isCoarseLocation
                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}
                >
                  {gps.source === 'manual' ? 'Pinned' : 'GPS'}
                  {gps.locationLabel ? `: ${gps.locationLabel} • ` : ': '}
                  {formatCoordLabel(gps.coords)}
                  {accuracyText ? ` (${accuracyText})` : ''}
                </span>
              )}
              {gps.status === 'locating' && (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Detecting device GPS coordinates...
                </span>
              )}
              {gps.status === 'paused' && (
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                  GPS Tracking Paused
                </span>
              )}
              {(gps.status === 'denied' || gps.status === 'unavailable' || gps.status === 'error') && (
                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                  {gps.status === 'denied' ? 'Location Permission Denied' : 'GPS Signal Unavailable'}
                </span>
              )}
            </div>
            {gps.isCoarseLocation && (
              <p className="text-[11px] text-amber-800 mt-1">
                Approximate network/IP estimate — enable Windows Location + Wi-Fi for exact GPS, search your area below, or click <strong>Pin on Map</strong> on the map.
              </p>
            )}
            {gps.error && <p className="text-[11px] text-rose-600 mt-0.5">{gps.error}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={gps.requestGps}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center gap-1 transition-colors"
            title="Clear pin and request a fresh live browser GPS reading"
          >
            <RefreshCw className={`w-3 h-3 ${gps.status === 'locating' ? 'animate-spin' : ''}`} />
            Refresh GPS
          </button>

          {gps.consentEnabled && gps.status !== 'paused' ? (
            <button
              type="button"
              onClick={gps.pauseGps}
              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl text-[11px] font-semibold text-slate-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
              title="Pause browser GPS location sharing"
            >
              <PauseCircle className="w-3 h-3" /> Pause GPS
            </button>
          ) : (
            <button
              type="button"
              onClick={gps.requestGps}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <PlayCircle className="w-3 h-3" /> Enable GPS
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className={`px-2.5 py-1.5 border rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors ${
              showManual
                ? 'bg-[#B71C1C] text-white border-[#B71C1C]'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <Search className="w-3 h-3" />
            {showManual ? 'Close Search' : 'Search / Set Location'}
          </button>
        </div>
      </div>

      {showManual && (
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
          <form onSubmit={handleSearchLocation} className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search city, area, hospital, or street (e.g. Madhapur, Hyderabad)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Find Address
            </button>
          </form>

          {searchError && <p className="text-[11px] text-rose-600">{searchError}</p>}

          {searchResults.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {searchResults.map((place, idx) => (
                <button
                  key={`${place.lat}-${place.lng}-${idx}`}
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  className="text-left p-2 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-lg transition-colors"
                >
                  <p className="text-xs font-bold text-slate-900 truncate">{place.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{place.fullName}</p>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleApplyManual} className="flex flex-wrap items-end gap-2 pt-1 border-t border-slate-200/70">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Latitude</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 17.3850"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-32 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Longitude</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 78.4867"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-32 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#B71C1C] hover:bg-red-800 text-white rounded-lg text-xs font-bold"
            >
              Center Map Here
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

const PIN_STYLES: Record<
  MapMarker['type'],
  { bg: string; border: string; glyph: string; label: string }
> = {
  hospital: { bg: '#B71C1C', border: '#7F1D1D', glyph: '#FFFFFF', label: 'Hospital' },
  blood_bank: { bg: '#059669', border: '#065F46', glyph: '#FFFFFF', label: 'Blood Bank' },
  courier: { bg: '#D97706', border: '#92400E', glyph: '#FFFFFF', label: 'Dispatch Unit' },
  donor: { bg: '#7C3AED', border: '#4C1D95', glyph: '#FFFFFF', label: 'Verified Donor' },
  user: { bg: '#2563EB', border: '#1E40AF', glyph: '#FFFFFF', label: 'Your GPS' },
};

const MarkerPinItem: React.FC<{
  markerData: MapMarker;
  userCenter: LatLng;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}> = ({ markerData, userCenter, isSelected, onSelect }) => {
  const [markerRef, markerInstance] = useAdvancedMarkerRef();
  const palette = PIN_STYLES[markerData.type] || PIN_STYLES.hospital;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: markerData.lat, lng: markerData.lng }}
        title={markerData.title}
        zIndex={markerData.type === 'user' || markerData.type === 'courier' ? 50 : 10}
        onClick={() => onSelect(markerData.id)}
      >
        {markerData.type === 'user' ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute w-7 h-7 rounded-full bg-blue-500/30 animate-ping" />
            <span className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
          </div>
        ) : markerData.type === 'courier' ? (
          <div className="px-2 py-1 rounded-full bg-amber-600 text-white border-2 border-white shadow-lg text-[10px] font-extrabold tracking-tight flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-200 animate-pulse" />
            TRK
          </div>
        ) : (
          <Pin background={palette.bg} borderColor={palette.border} glyphColor={palette.glyph} />
        )}
      </AdvancedMarker>

      {isSelected && markerInstance && (
        <InfoWindow anchor={markerInstance} onCloseClick={() => onSelect(null)}>
          <div className="p-1 min-w-[200px] max-w-[260px] text-slate-800">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: palette.bg }}
              >
                {markerData.badge || palette.label}
              </span>
              {typeof markerData.distanceKm === 'number' && (
                <span className="text-[11px] font-bold text-slate-600">
                  {formatDistanceKm(markerData.distanceKm)}
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm text-slate-900 leading-snug">{markerData.title}</h4>
            {markerData.subtitle && (
              <p className="text-xs text-slate-600 mt-0.5 leading-snug">{markerData.subtitle}</p>
            )}
            <p className="text-[10px] font-mono text-slate-400 mt-1.5">
              {markerData.lat.toFixed(5)}, {markerData.lng.toFixed(5)}
            </p>
            {markerData.type !== 'user' && (
              <a
                href={buildGoogleMapsDirectionsUrl(
                  { lat: markerData.lat, lng: markerData.lng },
                  userCenter
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#B71C1C] hover:underline"
              >
                <Navigation className="w-3 h-3" /> Directions in Google Maps
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapCameraManager: React.FC<{
  mapId: string;
  center: LatLng;
  zoom: number;
  points: LatLng[];
  fitAllMarkers: boolean;
  recenterSignal: number;
  cameraKey?: string | number;
}> = ({ mapId, center, zoom, points, fitAllMarkers, recenterSignal, cameraKey }) => {
  const map = useMap(mapId);
  const lastSignatureRef = useRef<string>('');
  const lastRecenterRef = useRef<number>(recenterSignal);

  useEffect(() => {
    if (!map) return;

    const forceRecenter = recenterSignal !== lastRecenterRef.current;
    lastRecenterRef.current = recenterSignal;

    const coordSig = `${cameraKey ?? ''}|${fitAllMarkers ? 'fit' : 'fixed'}|${center.lat.toFixed(4)},${center.lng.toFixed(4)}|${zoom}|${points.length}`;
    if (!forceRecenter && lastSignatureRef.current === coordSig) return;
    lastSignatureRef.current = coordSig;

    if (!forceRecenter && fitAllMarkers && points.length >= 2) {
      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      map.fitBounds(
        {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs),
        },
        48
      );

      const listener = map.addListener('idle', () => {
        listener.remove();
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 14) {
          map.setZoom(14);
        }
      });
      return () => listener.remove();
    }

    map.panTo(center);
    if (forceRecenter) {
      map.setZoom(Math.max(zoom, 13));
    } else if (!fitAllMarkers) {
      map.setZoom(zoom);
    }
  }, [map, center, zoom, points, fitAllMarkers, recenterSignal, cameraKey]);

  return null;
};

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ClusteredPointsLayer: React.FC<{
  mapId: string;
  points: ClusterPoint[];
  userCenter: LatLng;
}> = ({ mapId, points, userCenter }) => {
  const map = useMap(mapId);
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    const gmaps = (window as any).google?.maps;
    if (!map || !mapsLib || !gmaps || points.length === 0) return;

    let activeMarkers: any[] = [];
    const infoWindow = new gmaps.InfoWindow();

    const clearMarkers = () => {
      for (const m of activeMarkers) {
        gmaps.event.clearInstanceListeners(m);
        m.setMap(null);
      }
      activeMarkers = [];
    };

    const renderVisible = () => {
      clearMarkers();
      const bounds = map.getBounds();
      const currentZoom = map.getZoom() ?? 5;

      let inView = points;
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const latPad = Math.max(0.2, (ne.lat() - sw.lat()) * 0.2);
        const lngPad = Math.max(0.2, (ne.lng() - sw.lng()) * 0.2);
        inView = points.filter(
          (p) =>
            p.lat >= sw.lat() - latPad &&
            p.lat <= ne.lat() + latPad &&
            p.lng >= sw.lng() - lngPad &&
            p.lng <= ne.lng() + lngPad
        );
      }

      if (inView.length === 0) return;

      // Grid spatial clustering at wide zooms to keep thousands of pan-India centers responsive
      if (currentZoom <= 9 && inView.length > 90) {
        const cellDeg = (180 / Math.pow(2, currentZoom)) * 0.65;
        const cells = new Map<
          string,
          { sumLat: number; sumLng: number; count: number; liveCount: number; first: ClusterPoint }
        >();

        for (const p of inView) {
          const gx = Math.floor((p.lng + 180) / cellDeg);
          const gy = Math.floor((p.lat + 90) / cellDeg);
          const key = `${gx}:${gy}`;
          const existing = cells.get(key);
          if (existing) {
            existing.sumLat += p.lat;
            existing.sumLng += p.lng;
            existing.count += 1;
            if (p.liveOnline) existing.liveCount += 1;
          } else {
            cells.set(key, {
              sumLat: p.lat,
              sumLng: p.lng,
              count: 1,
              liveCount: p.liveOnline ? 1 : 0,
              first: p,
            });
          }
        }

        for (const cell of cells.values()) {
          const lat = cell.sumLat / cell.count;
          const lng = cell.sumLng / cell.count;

          if (cell.count === 1) {
            const p = cell.first;
            const color = p.liveOnline ? '#059669' : '#B71C1C';
            const marker = new gmaps.Marker({
              position: { lat: p.lat, lng: p.lng },
              map,
              title: p.title,
              icon: {
                path: gmaps.SymbolPath.CIRCLE,
                scale: 6.5,
                fillColor: color,
                fillOpacity: 0.95,
                strokeColor: '#FFFFFF',
                strokeWeight: 1.8,
              },
            });
            marker.addListener('click', () => {
              const dirUrl = buildGoogleMapsDirectionsUrl({ lat: p.lat, lng: p.lng }, userCenter);
              const badgeBg = p.liveOnline ? '#059669' : '#B71C1C';
              const badgeTxt = escapeHtml(p.badge || (p.liveOnline ? 'e-RaktKosh Live Online' : 'India Blood Bank'));
              infoWindow.setContent(
                `<div style="padding:4px;max-width:250px;font-family:system-ui,sans-serif;">
                  <span style="display:inline-block;background:${badgeBg};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-bottom:4px;">${badgeTxt}</span>
                  <div style="font-weight:700;font-size:13px;color:#0f172a;line-height:1.3;">${escapeHtml(p.title)}</div>
                  ${p.subtitle ? `<div style="font-size:11px;color:#475569;margin-top:3px;">${escapeHtml(p.subtitle)}</div>` : ''}
                  <div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:4px;">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>
                  <a href="${escapeHtml(dirUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#B71C1C;text-decoration:none;">Directions in Google Maps &rarr;</a>
                </div>`
              );
              infoWindow.open({ anchor: marker, map });
            });
            activeMarkers.push(marker);
            continue;
          }

          const radius = cell.count >= 250 ? 22 : cell.count >= 60 ? 18 : 15;
          const fill = cell.liveCount > cell.count * 0.5 ? '#059669' : '#B71C1C';
          const clusterMarker = new gmaps.Marker({
            position: { lat, lng },
            map,
            title: `${cell.count} blood banks (${cell.liveCount} live online)`,
            label: {
              text: String(cell.count),
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '700',
            },
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: radius,
              fillColor: fill,
              fillOpacity: 0.9,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.2,
            },
            zIndex: 25,
          });
          clusterMarker.addListener('click', () => {
            map.panTo({ lat, lng });
            map.setZoom(Math.min(currentZoom + 3, 12));
          });
          activeMarkers.push(clusterMarker);
        }
        return;
      }

      // Detailed individual blood bank markers inside city/regional zoom
      const centerNow = map.getCenter();
      const cLat = centerNow ? centerNow.lat() : userCenter.lat;
      const cLng = centerNow ? centerNow.lng() : userCenter.lng;
      const sorted =
        inView.length > 350
          ? [...inView]
              .sort(
                (a, b) =>
                  (a.lat - cLat) ** 2 + (a.lng - cLng) ** 2 - ((b.lat - cLat) ** 2 + (b.lng - cLng) ** 2)
              )
              .slice(0, 350)
          : inView;

      for (const p of sorted) {
        const color = p.liveOnline ? '#059669' : '#B71C1C';
        const marker = new gmaps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.title,
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: color,
            fillOpacity: 0.95,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          zIndex: p.liveOnline ? 15 : 10,
        });
        marker.addListener('click', () => {
          const dirUrl = buildGoogleMapsDirectionsUrl({ lat: p.lat, lng: p.lng }, userCenter);
          const badgeBg = p.liveOnline ? '#059669' : '#B71C1C';
          const badgeTxt = escapeHtml(p.badge || (p.liveOnline ? 'e-RaktKosh Live Online' : 'India Blood Bank'));
          const distHtml =
            typeof p.distanceKm === 'number'
              ? `<span style="float:right;font-size:11px;font-weight:700;color:#334155;">${escapeHtml(formatDistanceKm(p.distanceKm))}</span>`
              : '';
          infoWindow.setContent(
            `<div style="padding:4px;max-width:260px;font-family:system-ui,sans-serif;">
              <div><span style="display:inline-block;background:${badgeBg};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-bottom:4px;">${badgeTxt}</span>${distHtml}</div>
              <div style="font-weight:700;font-size:13px;color:#0f172a;line-height:1.3;">${escapeHtml(p.title)}</div>
              ${p.subtitle ? `<div style="font-size:11px;color:#475569;margin-top:3px;">${escapeHtml(p.subtitle)}</div>` : ''}
              <div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:4px;">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>
              <a href="${escapeHtml(dirUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#B71C1C;text-decoration:none;">Directions in Google Maps &rarr;</a>
            </div>`
          );
          infoWindow.open({ anchor: marker, map });
        });
        activeMarkers.push(marker);
      }
    };

    renderVisible();
    const idleListener = map.addListener('idle', renderVisible);
    return () => {
      idleListener.remove();
      infoWindow.close();
      clearMarkers();
    };
  }, [map, mapsLib, points, userCenter]);

  return null;
};

const RoutePolylineOverlay: React.FC<{
  mapId: string;
  origin: LatLng;
  destination: LatLng;
  courierPos?: LatLng;
}> = ({ mapId, origin, destination, courierPos }) => {
  const map = useMap(mapId);
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib) return;

    const fullPath = courierPos ? [origin, courierPos, destination] : [origin, destination];

    const haloLine = new mapsLib.Polyline({
      path: fullPath,
      geodesic: true,
      strokeColor: '#FCA5A5',
      strokeOpacity: 0.65,
      strokeWeight: 8,
      map,
    });

    const routeLine = new mapsLib.Polyline({
      path: fullPath,
      geodesic: true,
      strokeColor: '#B71C1C',
      strokeOpacity: 0.95,
      strokeWeight: 4,
      map,
    });

    return () => {
      haloLine.setMap(null);
      routeLine.setMap(null);
    };
  }, [map, mapsLib, origin, destination, courierPos]);

  return null;
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  markers = [],
  clusterPoints = [],
  center,
  gpsState,
  zoom = 13,
  height = '380px',
  mapInstanceId = 'lifelink-google-map',
  showRoute = false,
  origin,
  destination,
  courierPos,
  fitAllMarkers = true,
  cameraKey,
  legendMode = 'all',
}) => {
  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const apiStatus = useApiLoadingStatus();

  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [pickMode, setPickMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const validMarkers = useMemo(
    () => markers.filter((m) => hasValidCoords(m.lat, m.lng)),
    [markers]
  );

  const validClusterPoints = useMemo(
    () => clusterPoints.filter((p) => hasValidCoords(p.lat, p.lng)),
    [clusterPoints]
  );

  const effectiveCenter: LatLng | null = useMemo(() => {
    if (center && hasValidCoords(center.lat, center.lng)) return center;
    if (gpsState?.coords && hasValidCoords(gpsState.coords.lat, gpsState.coords.lng)) {
      return gpsState.coords;
    }
    if (origin && hasValidCoords(origin.lat, origin.lng)) {
      return { lat: origin.lat, lng: origin.lng };
    }
    if (validMarkers.length > 0) {
      return { lat: validMarkers[0].lat, lng: validMarkers[0].lng };
    }
    if (validClusterPoints.length > 0) {
      return { lat: 22.5937, lng: 78.9629 };
    }
    return null;
  }, [center, gpsState?.coords, origin, validMarkers, validClusterPoints]);

  const pointsForBounds = useMemo(() => {
    const pts: LatLng[] = validMarkers.map((m) => ({ lat: m.lat, lng: m.lng }));
    if (origin && hasValidCoords(origin.lat, origin.lng)) pts.push({ lat: origin.lat, lng: origin.lng });
    if (destination && hasValidCoords(destination.lat, destination.lng)) {
      pts.push({ lat: destination.lat, lng: destination.lng });
    }
    if (courierPos && hasValidCoords(courierPos.lat, courierPos.lng)) {
      pts.push({ lat: courierPos.lat, lng: courierPos.lng });
    }
    return pts;
  }, [validMarkers, origin, destination, courierPos]);

  const handleManualCenterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (gpsState && hasValidCoords(lat, lng)) {
      gpsState.setManualLocation({ lat, lng });
    }
  };

  if (!effectiveCenter) {
    return (
      <div
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
        style={{ height }}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#B71C1C] flex items-center justify-center mb-3">
          {gpsState?.status === 'locating' ? (
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-red-200 border-t-[#B71C1C]" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>
        <h4 className="text-sm font-bold text-slate-900">
          {gpsState?.status === 'locating'
            ? 'Acquiring Your Browser GPS Location...'
            : 'Enable GPS or Set Location Coordinates'}
        </h4>
        <p className="text-xs text-slate-600 max-w-md mt-1">
          {gpsState?.error ||
            'Allow location access in your browser prompt so LifeLink centers the Google Map on your exact GPS position.'}
        </p>

        {gpsState && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={gpsState.requestGps}
              className="px-4 py-2 bg-[#B71C1C] hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" /> Detect My GPS Location
            </button>

            <form onSubmit={handleManualCenterSubmit} className="flex flex-wrap items-center justify-center gap-2">
              <input
                type="number"
                step="any"
                required
                placeholder="Lat (e.g. 17.385)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-32 font-mono"
              />
              <input
                type="number"
                step="any"
                required
                placeholder="Lng (e.g. 78.486)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-32 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Use Coordinates
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const mapsExternalUrl =
    showRoute && origin && destination
      ? buildGoogleMapsDirectionsUrl(destination, origin)
      : buildGoogleMapsPointUrl(effectiveCenter);

  if (!API_KEY || apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div
        className="w-full rounded-2xl border border-amber-200 bg-amber-50/50 p-5 flex flex-col justify-between"
        style={{ height }}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#B71C1C]" />
              GPS Coordinates Active ({formatCoordLabel(effectiveCenter)})
            </h4>
            <a
              href={mapsExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#B71C1C] text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              Open in Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            {!API_KEY
              ? 'VITE_GOOGLE_MAPS_API_KEY is not configured.'
              : 'Embedded Google Maps SDK reported an authorization or network error.'}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 overflow-y-auto">
          {validMarkers.map((m) => (
            <div key={m.id} className="p-2.5 bg-white rounded-xl border border-amber-200 text-xs">
              <p className="font-bold text-slate-900">{m.title}</p>
              <p className="text-slate-500 text-[11px]">{m.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white relative">
      <div className="relative w-full" style={{ height }}>
        {apiStatus === APILoadingStatus.LOADING && (
          <div className="absolute inset-0 bg-slate-100/90 z-10 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-9 w-9 border-4 border-red-200 border-t-[#B71C1C]" />
            <p className="text-xs font-semibold text-gray-600 mt-2">Loading Google Maps...</p>
          </div>
        )}

        <GoogleMap
          id={mapInstanceId}
          mapId="DEMO_MAP_ID"
          defaultCenter={effectiveCenter}
          defaultZoom={zoom}
          gestureHandling="greedy"
          streetViewControl={false}
          fullscreenControl={true}
          mapTypeControl={true}
          internalUsageAttributionIds={['gmp_git_agentskills_v1']}
          className={`w-full h-full ${pickMode ? 'cursor-crosshair' : ''}`}
          onClick={(e) => {
            if (!pickMode || !gpsState || !e.detail?.latLng) return;
            gpsState.setManualLocation({
              lat: e.detail.latLng.lat,
              lng: e.detail.latLng.lng,
            });
            setPickMode(false);
            setRecenterSignal((s) => s + 1);
          }}
        >
          <MapCameraManager
            mapId={mapInstanceId}
            center={effectiveCenter}
            zoom={zoom}
            points={pointsForBounds}
            fitAllMarkers={fitAllMarkers}
            recenterSignal={recenterSignal}
            cameraKey={cameraKey}
          />

          {showRoute && origin && destination && (
            <RoutePolylineOverlay
              mapId={mapInstanceId}
              origin={origin}
              destination={destination}
              courierPos={courierPos}
            />
          )}

          {validClusterPoints.length > 0 && (
            <ClusteredPointsLayer
              mapId={mapInstanceId}
              points={validClusterPoints}
              userCenter={effectiveCenter}
            />
          )}

          {validMarkers.map((m) => (
            <MarkerPinItem
              key={m.id}
              markerData={m}
              userCenter={effectiveCenter}
              isSelected={selectedMarkerId === m.id}
              onSelect={setSelectedMarkerId}
            />
          ))}
        </GoogleMap>

        {pickMode && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-slate-900/95 text-white rounded-full shadow-lg text-xs font-bold flex items-center gap-3">
            <span>Click anywhere on the map to pin your exact live location</span>
            <button
              type="button"
              onClick={() => setPickMode(false)}
              className="px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded-full text-[11px]"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="absolute top-2.5 right-14 z-10 flex items-center gap-1.5">
          {gpsState && (
            <button
              type="button"
              onClick={() => setPickMode((v) => !v)}
              className={`px-3 py-2 border rounded-lg shadow-sm text-xs font-bold flex items-center gap-1.5 transition-all ${
                pickMode
                  ? 'bg-[#B71C1C] text-white border-[#B71C1C]'
                  : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200'
              }`}
              title="Click on the map to manually set your exact pin"
            >
              <MapPin className="w-3.5 h-3.5" />
              {pickMode ? 'Click Map...' : 'Pin on Map'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setRecenterSignal((s) => s + 1)}
            className="px-3 py-2 bg-white/95 hover:bg-white text-slate-800 border border-slate-200 rounded-lg shadow-sm text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Re-center map on GPS coordinates"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#B71C1C]" />
            Re-center GPS
          </button>
        </div>
      </div>

      {/* Bottom Legend Bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-gray-600 font-medium">
          {legendMode === 'donors-only' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Registered Donor Location (Donor Portal)
            </span>
          ) : legendMode === 'india-blood-banks' ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Your Blood Bank GPS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Live e-RaktKosh Online (India)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B71C1C]" /> Registered Blood Bank (India)
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Your GPS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B71C1C]" /> Hospital
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Blood Bank
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Ambulance / Courier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Donor
              </span>
            </>
          )}
        </div>

        <a
          href={mapsExternalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1"
        >
          <MapPin className="w-3.5 h-3.5" /> Open in Google Maps
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
