"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });

interface TrackPoint { lat: number; lon: number; timestamp: number; }
interface LatLon { lat: number; lon: number; }

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

// ─── Speedometer ─────────────────────────────────────────────────────────────
function Speedometer({ speed, max = 240 }: { speed: number; max?: number }) {
  const clamped = Math.min(speed, max);
  const pct = clamped / max;
  const START = 160, SWEEP = 220, R = 88, CX = 110, CY = 110;

  function arcPath(r: number, startDeg: number, sweepDeg: number) {
    const s = ((startDeg - 90) * Math.PI) / 180;
    const e = ((startDeg + sweepDeg - 90) * Math.PI) / 180;
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${CX + r * Math.cos(s)} ${CY + r * Math.sin(s)} A ${r} ${r} 0 ${large} 1 ${CX + r * Math.cos(e)} ${CY + r * Math.sin(e)}`;
  }

  const needleDeg = START + SWEEP * pct - 90;
  const nRad = (needleDeg * Math.PI) / 180;
  const speedColor = speed > 160 ? "#ff453a" : speed > 100 ? "#ff9f0a" : "#0a84ff";

  return (
    <svg viewBox="0 0 220 220" className="w-full h-full">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0a84ff"/>
          <stop offset="60%" stopColor="#ff9f0a"/>
          <stop offset="100%" stopColor="#ff453a"/>
        </linearGradient>
      </defs>
      <circle cx={CX} cy={CY} r="105" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
      <path d={arcPath(R, START, SWEEP)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round"/>
      {pct > 0 && <path d={arcPath(R, START, SWEEP * pct)} fill="none" stroke="url(#ag)" strokeWidth="12" strokeLinecap="round" filter="url(#glow)" style={{transition:"all 0.2s"}}/>}
      {Array.from({length:25},(_,i) => {
        const deg = START+(SWEEP/24)*i-90, rad=(deg*Math.PI)/180, maj=i%4===0;
        return <line key={i} x1={CX+(maj?72:79)*Math.cos(rad)} y1={CY+(maj?72:79)*Math.sin(rad)} x2={CX+86*Math.cos(rad)} y2={CY+86*Math.sin(rad)} stroke={maj?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.12)"} strokeWidth={maj?1.5:1}/>;
      })}
      {[0,60,120,180,240].map(val => {
        const deg = START+(SWEEP*(val/max))-90, rad=(deg*Math.PI)/180;
        return <text key={val} x={CX+62*Math.cos(rad)} y={CY+62*Math.sin(rad)} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="-apple-system,system-ui">{val}</text>;
      })}
      <line x1={CX} y1={CY} x2={CX+70*Math.cos(nRad)} y2={CY+70*Math.sin(nRad)} stroke={speedColor} strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)" style={{transition:"all 0.2s"}}/>
      <circle cx={CX} cy={CY} r="7" fill="#1c1c1e" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
      <circle cx={CX} cy={CY} r="3.5" fill={speedColor} style={{transition:"fill 0.2s"}}/>
      <text x={CX} y={CY+18} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="46" fontWeight="200" fontFamily="-apple-system,SF Pro Display,system-ui" letterSpacing="-2">{Math.round(speed)}</text>
      <text x={CX} y={CY+44} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="-apple-system,system-ui" letterSpacing="3">KM/H</text>
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"10px 12px" }}>
      <p style={{ color:"rgba(255,255,255,0.32)", fontSize:9, letterSpacing:"0.09em", marginBottom:5 }}>{label}</p>
      <p style={{ color:accent??"white", fontSize:20, fontWeight:300, letterSpacing:"-0.8px", lineHeight:1 }}>{value}</p>
    </div>
  );
}

// ─── Map badge ────────────────────────────────────────────────────────────────
function MapBadge({ count }: { count: number }) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none" style={{ background:"rgba(0,0,0,0.65)", borderRadius:10, padding:"5px 10px", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:"#0a84ff", boxShadow:"0 0 5px #0a84ff" }}/>
      <span style={{ color:"rgba(255,255,255,0.55)", fontSize:11, letterSpacing:"0.06em" }}>ROUTE</span>
      {count > 0 && <span style={{ color:"rgba(255,255,255,0.28)", fontSize:10 }}>{count} Pkt.</span>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SpeedTracker() {
  const [landscape, setLandscape] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<LatLon[]>([]);
  const [currentPos, setCurrentPos] = useState<LatLon | null>(null);

  const watchId = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number | null>(null);
  const lastPoint = useRef<TrackPoint | null>(null);

  // Detect orientation
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    setLandscape(mq.matches);
    const handler = (e: MediaQueryListEvent) => setLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timerRef.current) clearInterval(timerRef.current);
    watchId.current = null; timerRef.current = null;
    setTracking(false); setSpeed(0);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { setError("GPS nicht verfügbar."); return; }
    setError(null); lastPoint.current = null;
    startTime.current = Date.now();
    setDistance(0); setElapsed(0); setMaxSpeed(0); setSpeed(0);
    setRoutePoints([]); setCurrentPos(null);
    setTracking(true);

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current!) / 1000));
    }, 1000);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: TrackPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude, timestamp: pos.timestamp };
        setCurrentPos({ lat: pt.lat, lon: pt.lon });
        setRoutePoints((prev) => [...prev, { lat: pt.lat, lon: pt.lon }]);
        if (lastPoint.current) {
          const d = haversineDistance(lastPoint.current, pt);
          const dt = (pt.timestamp - lastPoint.current.timestamp) / 1000;
          if (dt > 0 && d < 500) {
            const kmh = (d / dt) * 3.6;
            setSpeed(kmh); setMaxSpeed((p) => Math.max(p, kmh)); setDistance((p) => p + d);
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
  const fmt = (s: number) => [Math.floor(s/3600), Math.floor((s%3600)/60), s%60].map(v => String(v).padStart(2,"0")).join(":");
  const fmtDist = (m: number) => m >= 1000 ? `${(m/1000).toFixed(2)} km` : `${Math.round(m)} m`;

  const stats = [
    { label:"STRECKE",  value: fmtDist(distance) },
    { label:"ZEIT",     value: fmt(elapsed) },
    { label:"Ø KM/H",  value: avg.toFixed(1),      accent:"#0a84ff" },
    { label:"MAX",      value: maxSpeed.toFixed(1), accent: maxSpeed>160?"#ff453a":maxSpeed>100?"#ff9f0a":"#30d158" },
  ];

  const header = (
    <div className="flex items-center justify-between w-full shrink-0" style={{ padding: landscape ? "16px 14px 0" : "14px 20px 0" }}>
      <div>
        <p style={{ color:"white", fontSize: landscape ? 15 : 17, fontWeight:600, letterSpacing:"-0.3px" }}>Aerorides</p>
        <div className="flex items-center gap-1.5" style={{ marginTop:2 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:tracking?"#30d158":"rgba(255,255,255,0.18)", boxShadow:tracking?"0 0 5px #30d158":"none", transition:"all 0.4s" }}/>
          <p style={{ color:"rgba(255,255,255,0.28)", fontSize:10, letterSpacing:"0.07em" }}>{tracking?"GPS AKTIV":"BEREIT"}</p>
        </div>
      </div>
      <button
        onClick={tracking ? stopTracking : startTracking}
        style={{ background:tracking?"rgba(255,69,58,0.15)":"rgba(10,132,255,0.15)", border:`1px solid ${tracking?"rgba(255,69,58,0.35)":"rgba(10,132,255,0.35)"}`, color:tracking?"#ff453a":"#0a84ff", borderRadius:22, padding: landscape ? "7px 16px" : "9px 22px", fontSize: landscape ? 12 : 14, fontWeight:500, cursor:"pointer", transition:"all 0.2s" }}
      >
        {tracking ? "Stop" : "Start"}
      </button>
    </div>
  );

  const tacho = (
    <div className="relative flex items-center justify-center" style={{ flex:1, width:"100%" }}>
      <div className="absolute rounded-full" style={{ width:220, height:220, background:tracking?"radial-gradient(circle,rgba(10,132,255,0.13) 0%,transparent 68%)":"radial-gradient(circle,rgba(255,255,255,0.03) 0%,transparent 68%)", transition:"background 1s" }}/>
      <div style={{ width: landscape ? "min(100%,180px)" : "min(100%,210px)", aspectRatio:"1" }}>
        <Speedometer speed={speed}/>
      </div>
    </div>
  );

  const statsGrid = (
    <div className="grid grid-cols-4 w-full shrink-0" style={{ gap:7, padding: landscape ? "0 14px 14px" : "0 14px" }}>
      {stats.map(({ label, value, accent }) => (
        <Stat key={label} label={label} value={value} accent={accent}/>
      ))}
    </div>
  );

  const map = (
    <div className="relative" style={
      landscape
        ? { flex:1, height:"100%" }
        : { flex:1, margin:"10px 14px 14px", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)" }
    }>
      <RouteMap points={routePoints} current={currentPos}/>
      <MapBadge count={routePoints.length}/>
    </div>
  );

  // ── PORTRAIT ──────────────────────────────────────────────────────────────
  if (!landscape) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ width:"100dvw", height:"100dvh", background:"#000", fontFamily:"-apple-system,SF Pro Display,system-ui" }}>
        {header}
        {tacho}
        {statsGrid}
        {error && <div style={{ margin:"0 14px", background:"rgba(255,69,58,0.1)", border:"1px solid rgba(255,69,58,0.3)", borderRadius:12, padding:"8px 12px", color:"#ff453a", fontSize:11 }}>{error}</div>}
        {map}
      </div>
    );
  }

  // ── LANDSCAPE ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-row overflow-hidden" style={{ width:"100dvw", height:"100dvh", background:"#000", fontFamily:"-apple-system,SF Pro Display,system-ui" }}>
      {/* Left: tacho + stats */}
      <div className="flex flex-col items-center shrink-0" style={{ width:"42%", height:"100%", borderRight:"1px solid rgba(255,255,255,0.07)" }}>
        {header}
        {tacho}
        {statsGrid}
        {error && <div style={{ margin:"0 14px 10px", width:"calc(100% - 28px)", background:"rgba(255,69,58,0.1)", border:"1px solid rgba(255,69,58,0.3)", borderRadius:12, padding:"8px 12px", color:"#ff453a", fontSize:11 }}>{error}</div>}
      </div>
      {/* Right: map */}
      {map}
    </div>
  );
}
