"use client";

import { useEffect, useRef, useState } from "react";
import type { Map, Polyline, CircleMarker, TileLayer } from "leaflet";

interface LatLon { lat: number; lon: number; }
interface Props { points: LatLon[]; current: LatLon | null; }

type MapStyle = "dark" | "light" | "satellite";

const TILES: Record<MapStyle, { url: string; attribution: string }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
  },
};

const STYLE_LABELS: Record<MapStyle, { icon: string; label: string }> = {
  dark:      { icon: "◗", label: "Dunkel" },
  light:     { icon: "○", label: "Hell" },
  satellite: { icon: "⊕", label: "Satellit" },
};

const ORDER: MapStyle[] = ["dark", "light", "satellite"];

export default function RouteMap({ points, current }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const polylineRef = useRef<Polyline | null>(null);
  const dotRef = useRef<CircleMarker | null>(null);
  const tileRef = useRef<TileLayer | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      if ((containerRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([48.1351, 11.582], 15);

      const tile = L.tileLayer(TILES.dark.url, { maxZoom: 19, subdomains: "abcd" }).addTo(map);
      tileRef.current = tile;

      L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);
      map.attributionControl?.setPrefix(TILES.dark.attribution);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      polylineRef.current = L.polyline([], {
        color: "#0a84ff", weight: 4, opacity: 0.9, lineJoin: "round",
      }).addTo(map);

      dotRef.current = L.circleMarker([48.1351, 11.582], {
        radius: 8, color: "#fff", weight: 2.5,
        fillColor: "#0a84ff", fillOpacity: 1,
      });

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        polylineRef.current = null;
        dotRef.current = null;
        tileRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch tile layer when style changes ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const oldTile = tileRef.current;
    if (!map || !oldTile) return;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      oldTile.remove();
      const newTile = L.tileLayer(TILES[mapStyle].url, { maxZoom: 19, subdomains: "abcd" }).addTo(map);
      // Keep route + dot on top
      polylineRef.current?.bringToFront();
      if (dotRef.current && map.hasLayer(dotRef.current)) dotRef.current.bringToFront();
      map.attributionControl?.setPrefix(TILES[mapStyle].attribution);
      tileRef.current = newTile;
    });
  }, [mapStyle]);

  // ── Update route polyline ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const poly = polylineRef.current;
    if (!map || !poly) return;
    const latlngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    poly.setLatLngs(latlngs);
    if (latlngs.length > 1) map.fitBounds(poly.getBounds(), { padding: [30, 30], animate: false });
  }, [points]);

  // ── Update live position dot ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const dot = dotRef.current;
    if (!map || !dot || !current) return;
    const pos: [number, number] = [current.lat, current.lon];
    dot.setLatLng(pos);
    if (!map.hasLayer(dot)) dot.addTo(map);
    if (points.length <= 2) map.setView(pos, 16, { animate: true });
  }, [current, points.length]);

  function cycleStyle() {
    setMapStyle((prev) => {
      const next = ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length];
      return next;
    });
  }

  const isDark = mapStyle === "dark" || mapStyle === "satellite";

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} style={{ width:"100%", height:"100%", background:"#0a0a0a" }}/>

      {/* Style switcher button */}
      <button
        onClick={cycleStyle}
        style={{
          position: "absolute",
          bottom: 54,
          right: 10,
          zIndex: 1000,
          background: isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.92)",
          border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
          color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          backdropFilter: "blur(10px)",
          fontFamily: "-apple-system,system-ui",
          letterSpacing: "0.02em",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 13 }}>{STYLE_LABELS[mapStyle].icon}</span>
        {STYLE_LABELS[mapStyle].label}
      </button>

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
          <p style={{ color:"rgba(255,255,255,0.15)", fontSize:11, letterSpacing:"0.1em", fontFamily:"-apple-system,system-ui" }}>
            ROUTE ERSCHEINT BEIM START
          </p>
        </div>
      )}
    </div>
  );
}
