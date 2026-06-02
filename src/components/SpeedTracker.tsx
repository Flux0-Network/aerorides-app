"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
}

function haversineDistance(a: TrackPoint, b: TrackPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Apple-style speedometer ──────────────────────────────────────────────────
function Speedometer({ speed, max = 240 }: { speed: number; max?: number }) {
  const clamped = Math.min(speed, max);
  const pct = clamped / max;

  // arc: 220° sweep, starts at 160° (bottom-left)
  const START = 160;
  const SWEEP = 220;
  const R = 88;
  const CX = 110;
  const CY = 110;

  function arcPath(r: number, startDeg: number, sweepDeg: number) {
    const s = ((startDeg - 90) * Math.PI) / 180;
    const e = ((startDeg + sweepDeg - 90) * Math.PI) / 180;
    const x1 = CX + r * Math.cos(s);
    const y1 = CY + r * Math.sin(s);
    const x2 = CX + r * Math.cos(e);
    const y2 = CY + r * Math.sin(e);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const trackPath = arcPath(R, START, SWEEP);
  const fillPath = arcPath(R, START, SWEEP * pct);

  // needle angle
  const needleDeg = START + SWEEP * pct - 90;
  const nRad = (needleDeg * Math.PI) / 180;
  const nx = CX + 70 * Math.cos(nRad);
  const ny = CY + 70 * Math.sin(nRad);

  const speedColor =
    speed > 160 ? "#ff453a" : speed > 100 ? "#ff9f0a" : "#0a84ff";

  return (
    <svg viewBox="0 0 220 220" className="w-full h-full">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0a84ff" />
          <stop offset="60%" stopColor="#ff9f0a" />
          <stop offset="100%" stopColor="#ff453a" />
        </linearGradient>
      </defs>

      {/* Outer ring */}
      <circle cx={CX} cy={CY} r="105" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

      {/* Track arc */}
      <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />

      {/* Filled arc */}
      {pct > 0 && (
        <path
          d={fillPath}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#glow)"
          style={{ transition: "stroke-dasharray 0.2s" }}
        />
      )}

      {/* Tick marks */}
      {Array.from({ length: 25 }, (_, i) => {
        const deg = START + (SWEEP / 24) * i - 90;
        const rad = (deg * Math.PI) / 180;
        const isMajor = i % 4 === 0;
        const inner = isMajor ? 72 : 78;
        const outer = 85;
        return (
          <line
            key={i}
            x1={CX + inner * Math.cos(rad)}
            y1={CY + inner * Math.sin(rad)}
            x2={CX + outer * Math.cos(rad)}
            y2={CY + outer * Math.sin(rad)}
            stroke={isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"}
            strokeWidth={isMajor ? 1.5 : 1}
          />
        );
      })}

      {/* Speed labels */}
      {[0, 60, 120, 180, 240].map((val) => {
        const deg = START + (SWEEP * (val / max)) - 90;
        const rad = (deg * Math.PI) / 180;
        const lr = 62;
        return (
          <text
            key={val}
            x={CX + lr * Math.cos(rad)}
            y={CY + lr * Math.sin(rad)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            fontFamily="-apple-system, SF Pro Display, system-ui"
          >
            {val}
          </text>
        );
      })}

      {/* Needle */}
      <line
        x1={CX}
        y1={CY}
        x2={nx}
        y2={ny}
        stroke={speedColor}
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#glow)"
        style={{ transition: "all 0.2s" }}
      />
      <circle cx={CX} cy={CY} r="6" fill="#1c1c1e" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <circle cx={CX} cy={CY} r="3" fill={speedColor} style={{ transition: "fill 0.2s" }} />

      {/* Speed number */}
      <text
        x={CX}
        y={CY + 20}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="42"
        fontWeight="200"
        fontFamily="-apple-system, SF Pro Display, system-ui"
        letterSpacing="-2"
      >
        {Math.round(speed)}
      </text>
      <text
        x={CX}
        y={CY + 44}
        textAnchor="middle"
        fill="rgba(255,255,255,0.4)"
        fontSize="11"
        fontFamily="-apple-system, SF Pro Display, system-ui"
        letterSpacing="2"
      >
        KM/H
      </text>
    </svg>
  );
}

// ─── Nav stat card ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl p-4 bg-white/5 border border-white/8 backdrop-blur-sm">
      <p
        style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: "0.1em", fontFamily: "-apple-system, system-ui" }}
        className="uppercase"
      >
        {label}
      </p>
      <div>
        <p
          style={{
            color: accent ?? "white",
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: "-1px",
            fontFamily: "-apple-system, SF Pro Display, system-ui",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        {sub && (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 3, fontFamily: "-apple-system, system-ui" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SpeedTracker() {
  const [tracking, setTracking] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const watchId = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number | null>(null);
  const lastPoint = useRef<TrackPoint | null>(null);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timerRef.current) clearInterval(timerRef.current);
    watchId.current = null;
    timerRef.current = null;
    setTracking(false);
    setSpeed(0);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { setError("GPS nicht verfügbar."); return; }
    setError(null);
    lastPoint.current = null;
    startTime.current = Date.now();
    setDistance(0); setElapsed(0); setMaxSpeed(0); setSpeed(0);
    setTracking(true);

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current!) / 1000));
    }, 1000);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: TrackPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude, timestamp: pos.timestamp };
        if (lastPoint.current) {
          const d = haversineDistance(lastPoint.current, pt);
          const dt = (pt.timestamp - lastPoint.current.timestamp) / 1000;
          if (dt > 0 && d < 500) {
            const kmh = (d / dt) * 3.6;
            setSpeed(kmh);
            setMaxSpeed((p) => Math.max(p, kmh));
            setDistance((p) => p + d);
          }
        }
        lastPoint.current = pt;
      },
      (e) => { setError(`GPS: ${e.message}`); stopTracking(); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, [stopTracking]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const avg = elapsed > 0 ? (distance / elapsed) * 3.6 : 0;

  function fmt(sec: number) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

  function fmtDist(m: number) {
    return m >= 1000 ? `${(m / 1000).toFixed(2)}` : `${Math.round(m)}`;
  }
  function distUnit(m: number) { return m >= 1000 ? "km" : "m"; }

  return (
    <div
      className="w-screen h-screen flex overflow-hidden"
      style={{ background: "#000", fontFamily: "-apple-system, SF Pro Display, system-ui" }}
    >
      {/* ── LEFT: Speedometer ── */}
      <div className="relative flex flex-col items-center justify-center"
        style={{ width: "45%", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Ambient glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 280, height: 280,
            background: tracking
              ? "radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
            transition: "background 1s",
          }}
        />
        <div style={{ width: "min(75%, 260px)", aspectRatio: "1" }}>
          <Speedometer speed={speed} />
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-2 mt-4">
          <div
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: tracking ? "#30d158" : "rgba(255,255,255,0.2)",
              boxShadow: tracking ? "0 0 6px #30d158" : "none",
              transition: "all 0.4s",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.08em" }}>
            {tracking ? "GPS AKTIV" : "BEREIT"}
          </span>
        </div>
      </div>

      {/* ── RIGHT: Nav panel ── */}
      <div className="flex flex-col justify-between" style={{ width: "55%", padding: "24px 20px" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ color: "white", fontSize: 18, fontWeight: 600, letterSpacing: "-0.5px" }}>
              Aerorides
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Strecken-Tracker</p>
          </div>
          {/* Start / Stop */}
          <button
            onClick={tracking ? stopTracking : startTracking}
            style={{
              background: tracking ? "rgba(255,69,58,0.15)" : "rgba(10,132,255,0.15)",
              border: `1px solid ${tracking ? "rgba(255,69,58,0.4)" : "rgba(10,132,255,0.4)"}`,
              color: tracking ? "#ff453a" : "#0a84ff",
              borderRadius: 20,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.02em",
              transition: "all 0.2s",
            }}
          >
            {tracking ? "Stop" : "Start"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)",
            borderRadius: 12, padding: "10px 14px", color: "#ff453a", fontSize: 12, marginBottom: 10,
          }}>
            {error}
          </div>
        )}

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          <StatCard
            label="Strecke"
            value={fmtDist(distance)}
            sub={distUnit(distance)}
            accent="white"
          />
          <StatCard
            label="Fahrzeit"
            value={fmt(elapsed)}
          />
          <StatCard
            label="Ø Geschw."
            value={avg.toFixed(1)}
            sub="km/h"
            accent="#0a84ff"
          />
          <StatCard
            label="Spitze"
            value={maxSpeed.toFixed(1)}
            sub="km/h"
            accent={maxSpeed > 160 ? "#ff453a" : maxSpeed > 100 ? "#ff9f0a" : "#30d158"}
          />
        </div>

        {/* Speed bar */}
        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, letterSpacing: "0.1em" }}>
              AKTUELLE GESCHWINDIGKEIT
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              {Math.round(speed)} km/h
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(speed / 240) * 100}%`,
                background: speed > 160 ? "#ff453a" : speed > 100 ? "#ff9f0a" : "#0a84ff",
                borderRadius: 2,
                transition: "width 0.2s, background 0.2s",
                boxShadow: `0 0 6px ${speed > 160 ? "#ff453a" : "#0a84ff"}`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
