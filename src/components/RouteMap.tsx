"use client";

import { useEffect, useRef } from "react";
import type { Map, Polyline, CircleMarker } from "leaflet";

interface LatLon { lat: number; lon: number; }
interface Props { points: LatLon[]; current: LatLon | null; }

export default function RouteMap({ points, current }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const polylineRef = useRef<Polyline | null>(null);
  const dotRef = useRef<CircleMarker | null>(null);

  // ── Init map once, safe against StrictMode double-invoke ──────────────────
  useEffect(() => {
    // Already initialized — happens on StrictMode second run
    if (mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      // Async completed after cleanup (StrictMode unmount) → bail out
      if (cancelled || !containerRef.current) return;
      // DOM node already got a Leaflet instance somehow → bail out
      if ((containerRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([48.1351, 11.582], 15);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);
      map.attributionControl?.setPrefix("© CartoDB");
      L.control.zoom({ position: "bottomright" }).addTo(map);

      polylineRef.current = L.polyline([], {
        color: "#0a84ff", weight: 4, opacity: 0.9, lineJoin: "round",
      }).addTo(map);

      dotRef.current = L.circleMarker([48.1351, 11.582], {
        radius: 8, color: "#fff", weight: 2.5,
        fillColor: "#0a84ff", fillOpacity: 1,
      });

      mapRef.current = map;

      // Make sure tiles fill the container after first paint
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      // Only destroy if init completed (mapRef was set)
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        polylineRef.current = null;
        dotRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update route polyline ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const poly = polylineRef.current;
    if (!map || !poly) return;

    const latlngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    poly.setLatLngs(latlngs);

    if (latlngs.length > 1) {
      map.fitBounds(poly.getBounds(), { padding: [30, 30], animate: false });
    }
  }, [points]);

  // ── Update live position dot ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const dot = dotRef.current;
    if (!map || !dot || !current) return;

    const pos: [number, number] = [current.lat, current.lon];
    dot.setLatLng(pos);

    if (!map.hasLayer(dot)) dot.addTo(map);

    // Only follow if we don't have a route yet (pan smoothly once tracking starts)
    if (points.length <= 2) map.setView(pos, 16, { animate: true });
  }, [current, points.length]);

  return (
    <div className="relative w-full h-full">
      {/* Map container — must have explicit dimensions for Leaflet */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#0a0a0a" }} />

      {/* Dark theme overrides */}
      <style>{`
        .leaflet-container { background: #0a0a0a !important; }
        .leaflet-control-zoom a {
          background: rgba(28,28,30,0.92) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: rgba(255,255,255,0.6) !important;
        }
        .leaflet-control-zoom a:hover { background: rgba(50,50,52,0.95) !important; }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.55) !important;
          color: rgba(255,255,255,0.2) !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.25) !important; }
      `}</style>

      {/* Empty state */}
      {points.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ gap: 8 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="11" r="3" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none"/>
          </svg>
          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 11, letterSpacing: "0.1em", fontFamily: "-apple-system,system-ui" }}>
            ROUTE ERSCHEINT BEIM START
          </p>
        </div>
      )}
    </div>
  );
}
