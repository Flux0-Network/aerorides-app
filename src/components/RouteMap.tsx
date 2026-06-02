"use client";

import { useEffect, useRef } from "react";
import type { Map, Polyline, CircleMarker } from "leaflet";

interface LatLon { lat: number; lon: number; }

interface Props {
  points: LatLon[];
  current: LatLon | null;
}

export default function RouteMap({ points, current }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const polylineRef = useRef<Polyline | null>(null);
  const dotRef = useRef<CircleMarker | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl: "", shadowUrl: "" });

      const map = L.map(containerRef.current!, {
        zoomControl: false,
        attributionControl: false,
      }).setView([48.1351, 11.582], 15);

      // Dark CartoDB tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      // Attribution bottom-right, subtle
      L.control.attribution({ prefix: false, position: "bottomright" })
        .addTo(map);
      map.attributionControl?.setPrefix("© CartoDB");

      L.control.zoom({ position: "bottomright" }).addTo(map);

      polylineRef.current = L.polyline([], {
        color: "#0a84ff",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
      }).addTo(map);

      dotRef.current = L.circleMarker([48.1351, 11.582], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#0a84ff",
        fillOpacity: 1,
      });

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      polylineRef.current = null;
      dotRef.current = null;
    };
  }, []);

  // Update polyline when points change
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current) return;
    const latlngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    polylineRef.current.setLatLngs(latlngs);
    if (latlngs.length > 1) {
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
    }
  }, [points]);

  // Update current position dot
  useEffect(() => {
    if (!mapRef.current || !dotRef.current || !current) return;
    const pos: [number, number] = [current.lat, current.lon];
    dotRef.current.setLatLng(pos);

    if (!mapRef.current.hasLayer(dotRef.current)) {
      dotRef.current.addTo(mapRef.current);
    }

    if (points.length <= 1) {
      mapRef.current.setView(pos, 16, { animate: true });
    }
  }, [current, points.length]);

  return (
    <div className="relative w-full h-full">
      {/* Leaflet CSS */}
      <style>{`
        .leaflet-container { background: #0a0a0a; }
        .leaflet-control-zoom a {
          background: rgba(28,28,30,0.9) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: rgba(255,255,255,0.7) !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-zoom a:hover { background: rgba(44,44,46,0.95) !important; }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.5) !important;
          color: rgba(255,255,255,0.2) !important;
          font-size: 9px !important;
          backdrop-filter: blur(4px);
        }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.3) !important; }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />
      {points.length === 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ gap: 8 }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="11" r="3" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none"/>
          </svg>
          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 11, letterSpacing: "0.1em", fontFamily: "-apple-system, system-ui" }}>
            ROUTE ERSCHEINT BEIM START
          </p>
        </div>
      )}
    </div>
  );
}
