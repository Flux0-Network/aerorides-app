"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
}

function haversineDistance(a: TrackPoint, b: TrackPoint): number {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function SpeedometerNeedle({ speedKmh, maxKmh = 240 }: { speedKmh: number; maxKmh?: number }) {
  const clampedSpeed = Math.min(speedKmh, maxKmh);
  // Needle goes from -135° to +135° (270° arc)
  const angle = -135 + (clampedSpeed / maxKmh) * 270;

  const ticks = Array.from({ length: 13 }, (_, i) => i); // 0..12 → 0..240 in steps of 20
  const minorTicks = Array.from({ length: 48 }, (_, i) => i);

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-xs mx-auto drop-shadow-xl">
      {/* Background circle */}
      <circle cx="100" cy="100" r="95" fill="#111827" stroke="#374151" strokeWidth="2" />
      {/* Arc track */}
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="#1f2937"
        strokeWidth="14"
        strokeDasharray="353 502"
        strokeDashoffset="-62"
        strokeLinecap="round"
      />
      {/* Speed arc (colored fill) */}
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke={speedKmh > 160 ? "#ef4444" : speedKmh > 100 ? "#f59e0b" : "#22d3ee"}
        strokeWidth="14"
        strokeDasharray={`${(clampedSpeed / maxKmh) * 353} 502`}
        strokeDashoffset="-62"
        strokeLinecap="round"
        className="transition-all duration-200"
      />

      {/* Minor tick marks */}
      {minorTicks.map((i) => {
        const tickAngle = -135 + (i / 48) * 270;
        const rad = (tickAngle * Math.PI) / 180;
        const inner = 68;
        const outer = 74;
        return (
          <line
            key={i}
            x1={100 + inner * Math.cos(rad)}
            y1={100 + inner * Math.sin(rad)}
            x2={100 + outer * Math.cos(rad)}
            y2={100 + outer * Math.sin(rad)}
            stroke="#4b5563"
            strokeWidth="1"
          />
        );
      })}

      {/* Major tick marks + labels */}
      {ticks.map((i) => {
        const val = i * 20;
        const tickAngle = -135 + (val / maxKmh) * 270;
        const rad = (tickAngle * Math.PI) / 180;
        const inner = 63;
        const outer = 76;
        const labelR = 55;
        return (
          <g key={i}>
            <line
              x1={100 + inner * Math.cos(rad)}
              y1={100 + inner * Math.sin(rad)}
              x2={100 + outer * Math.cos(rad)}
              y2={100 + outer * Math.sin(rad)}
              stroke="#9ca3af"
              strokeWidth="2"
            />
            {i % 2 === 0 && (
              <text
                x={100 + labelR * Math.cos(rad)}
                y={100 + labelR * Math.sin(rad)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#d1d5db"
                fontSize="8"
                fontFamily="monospace"
              >
                {val}
              </text>
            )}
          </g>
        );
      })}

      {/* Needle */}
      <g
        transform={`rotate(${angle} 100 100)`}
        className="transition-transform duration-200"
      >
        <polygon points="100,28 97,98 103,98" fill="#f87171" />
        <polygon points="100,108 97,102 103,102" fill="#6b7280" />
      </g>

      {/* Center hub */}
      <circle cx="100" cy="100" r="7" fill="#374151" stroke="#6b7280" strokeWidth="2" />
      <circle cx="100" cy="100" r="3" fill="#f87171" />

      {/* Speed text */}
      <text x="100" y="130" textAnchor="middle" fill="white" fontSize="22" fontFamily="monospace" fontWeight="bold">
        {Math.round(speedKmh)}
      </text>
      <text x="100" y="142" textAnchor="middle" fill="#9ca3af" fontSize="8" fontFamily="monospace">
        km/h
      </text>
    </svg>
  );
}

export default function SpeedTracker() {
  const [tracking, setTracking] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [maxSpeedKmh, setMaxSpeedKmh] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const trackPoints = useRef<TrackPoint[]>([]);
  const watchId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<TrackPoint | null>(null);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTracking(false);
    setSpeedKmh(0);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }
    setError(null);
    trackPoints.current = [];
    lastPoint.current = null;
    startTime.current = Date.now();
    setDistanceM(0);
    setElapsedSec(0);
    setMaxSpeedKmh(0);
    setSpeedKmh(0);
    setTracking(true);

    timerRef.current = setInterval(() => {
      if (startTime.current) {
        setElapsedSec(Math.floor((Date.now() - startTime.current) / 1000));
      }
    }, 1000);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timestamp: pos.timestamp,
        };

        if (lastPoint.current) {
          const dist = haversineDistance(lastPoint.current, point);
          const dtSec = (point.timestamp - lastPoint.current.timestamp) / 1000;
          if (dtSec > 0 && dist < 500) {
            const kmhNow = (dist / dtSec) * 3.6;
            setSpeedKmh(kmhNow);
            setMaxSpeedKmh((prev) => Math.max(prev, kmhNow));
            setDistanceM((prev) => prev + dist);
          }
        }

        lastPoint.current = point;
        trackPoints.current.push(point);
      },
      (err) => {
        setError(`GPS-Fehler: ${err.message}`);
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, [stopTracking]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const avgSpeedKmh =
    elapsedSec > 0 ? (distanceM / elapsedSec) * 3.6 : 0;

  function formatDuration(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

  function formatDistance(m: number) {
    return m >= 1000
      ? `${(m / 1000).toFixed(2)} km`
      : `${Math.round(m)} m`;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start py-8 px-4">
      <h1 className="text-2xl font-bold tracking-widest mb-1 text-cyan-400 font-mono">
        AERORIDES
      </h1>
      <p className="text-gray-500 text-sm mb-6 font-mono">GPS Strecken-Tracker</p>

      {/* Speedometer */}
      <div className="w-64">
        <SpeedometerNeedle speedKmh={speedKmh} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-4">
        {[
          { label: "Strecke", value: formatDistance(distanceM) },
          { label: "Ø Geschw.", value: `${avgSpeedKmh.toFixed(1)} km/h` },
          { label: "Max Speed", value: `${maxSpeedKmh.toFixed(1)} km/h` },
          { label: "Zeit", value: formatDuration(elapsedSec) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center"
          >
            <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">{label}</p>
            <p className="text-white font-mono text-lg font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm font-mono max-w-xs text-center">
          {error}
        </div>
      )}

      {/* Control button */}
      <button
        onClick={tracking ? stopTracking : startTracking}
        className={`mt-6 w-full max-w-xs py-4 rounded-2xl font-bold text-lg font-mono tracking-widest transition-all duration-200 shadow-lg ${
          tracking
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-cyan-500 hover:bg-cyan-400 text-gray-950"
        }`}
      >
        {tracking ? "■  STOP" : "▶  START"}
      </button>

      {tracking && (
        <p className="mt-3 text-gray-600 text-xs font-mono animate-pulse">
          GPS aktiv – bewege dich für Messung...
        </p>
      )}
    </div>
  );
}
