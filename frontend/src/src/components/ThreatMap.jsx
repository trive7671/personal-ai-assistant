import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Globe, RefreshCw, AlertTriangle, Shield, Zap } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";

// Fix Leaflet icon issue in React
import L from "leaflet";
delete L.Icon.Default.prototype._getIconUrl;

const RISK_COLORS = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#10b981",
};

const MAP_THEMES = {
  dark: {
    name: "Cyber Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  },
  blue: {
    name: "Cyberpunk Blue",
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  },
  light: {
    name: "Sleek Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  },
};

// Custom glowing and pulsing radar icon for map targets
const customRadarIcon = (color) => {
  return L.divIcon({
    className: "custom-radar-icon",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;">
        <div class="animate-ping" style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background-color: ${color}; opacity: 0.4;"></div>
        <div style="position: absolute; width: 14px; height: 14px; border-radius: 50%; background-color: ${color}; opacity: 0.2; border: 2px solid ${color};"></div>
        <div style="position: relative; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; border: 1.5px solid #ffffff; box-shadow: 0 0 8px ${color};"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Fetch geolocation for an IP/domain
async function geolocate(url) {
  try {
    const hostname = new URL(url).hostname;
    // Skip localhost / private IPs
    if (hostname === "localhost" || hostname.startsWith("192.") || hostname.startsWith("127.")) {
      return null;
    }
    const res = await fetch(`https://ip-api.com/json/${hostname}?fields=status,country,city,lat,lon,isp,query`);
    const data = await res.json();
    if (data.status === "success") return data;
  } catch {}
  return null;
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { 
    if (center) {
      map.flyTo(center, 4, { duration: 1.5 }); 
    }
  }, [center, map]);
  return null;
}

export default function ThreatMap({ token }) {
  const [scans, setScans] = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ total: 0, high: 0, countries: 0 });
  const [mapTheme, setMapTheme] = useState("dark");

  const fetchAndGeocode = async () => {
    setLoading(true);
    setGeoLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/scanner/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const history = res.data || [];
      setScans(history);

      // Geolocate each URL (limit to 20 to avoid rate limits)
      const points = [];
      const seen = new Set();

      for (const scan of history.slice(0, 20)) {
        try {
          const hostname = new URL(scan.url).hostname;
          if (seen.has(hostname)) {
            // Reuse cached geolocation with slight jitter
            const cached = points.find(p => p.hostname === hostname);
            if (cached) {
              points.push({
                ...cached,
                ...scan,
                lat: cached.lat + (Math.random() - 0.5) * 0.5,
                lon: cached.lon + (Math.random() - 0.5) * 0.5,
              });
            }
            continue;
          }
          seen.add(hostname);
          const geo = await geolocate(scan.url);
          if (geo) {
            points.push({
              ...scan,
              hostname,
              lat: geo.lat,
              lon: geo.lon,
              country: geo.country,
              city: geo.city,
              isp: geo.isp,
            });
          }
        } catch {}
      }

      setMapPoints(points);

      // Stats
      const countries = new Set(points.map(p => p.country).filter(Boolean));
      const highRisk = history.filter(s => s.risk === "HIGH" || s.risk === "CRITICAL").length;
      setStats({ total: history.length, high: highRisk, countries: countries.size });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setGeoLoading(false);
    }
  };

  useEffect(() => { fetchAndGeocode(); }, [token]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Globe className="h-8 w-8 text-cyber-primary" />
            <span>Real-Time Threat Intelligence Map</span>
          </h1>
          <p className="mt-1 text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Geolocation of all scanned targets — visualized on a live world map
          </p>
        </div>
        <button
          onClick={fetchAndGeocode}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyber-primary" : ""}`} />
          Refresh Map
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Globe, label: "Total Scans", value: stats.total, color: "#00f0ff" },
          { icon: AlertTriangle, label: "High / Critical", value: stats.high, color: "#ef4444" },
          { icon: Shield, label: "Countries Detected", value: stats.countries, color: "#10b981" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border p-4 flex items-center gap-4"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <Icon className="h-8 w-8 shrink-0" style={{ color }} />
            <div>
              <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
              <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-gray-400">MAP STYLE:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-0.5">
            {Object.entries(MAP_THEMES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setMapTheme(key)}
                className={`px-3 py-1 text-xs font-mono font-semibold transition-all rounded-md cursor-pointer ${
                  mapTheme === key ? "bg-cyber-primary text-slate-950 font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                {cfg.name}
              </button>
            ))}
          </div>
        </div>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-xs font-mono text-cyber-danger hover:underline cursor-pointer flex items-center gap-1"
          >
            Clear Selected Target
          </button>
        )}
      </div>

      {/* Map & SOC Overlay Container */}
      <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border-color)", height: "500px" }}>
        {loading && mapPoints.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4"
            style={{ backgroundColor: "var(--bg-card)" }}>
            <RefreshCw className="h-10 w-10 text-cyber-primary animate-spin" />
            <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
              {geoLoading ? "Geolocating scan targets..." : "Loading threat map..."}
            </p>
          </div>
        ) : (
          <>
            <MapContainer
              center={[20, 0]}
              zoom={2}
              style={{ height: "100%", width: "100%", background: "#0b0f19" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url={MAP_THEMES[mapTheme].url}
              />
              {selected && <MapRecenter center={[selected.lat, selected.lon]} />}
              {mapPoints.map((point, i) => {
                const color = RISK_COLORS[point.risk] || "#64748b";
                return (
                  <Marker
                    key={i}
                    position={[point.lat, point.lon]}
                    icon={customRadarIcon(color)}
                    eventHandlers={{
                      click: () => {
                        setSelected(point);
                      },
                    }}
                  />
                );
              })}
            </MapContainer>

            {/* Dynamic Glassmorphic SOC Details Panel Overlay */}
            {selected && (
              <div className="absolute right-4 top-4 z-[1000] w-80 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-5 text-gray-200 shadow-2xl space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-cyber-primary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyber-primary animate-pulse" />
                    TARGET CORRELATION
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-500 hover:text-white cursor-pointer text-sm font-bold w-5 h-5 flex items-center justify-center rounded bg-slate-900 border border-slate-800"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-500 block mb-0.5">TARGET URL/DOMAIN:</span>
                    <p className="text-sm font-bold text-white break-all">{selected.url}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-2.5 rounded border border-slate-800/40">
                    <div>
                      <span className="text-gray-500 block mb-0.5">RISK PROFILE:</span>
                      <span
                        className="font-extrabold text-[11px] px-2 py-0.5 rounded border"
                        style={{
                          color: RISK_COLORS[selected.risk],
                          borderColor: RISK_COLORS[selected.risk] + "40",
                          backgroundColor: RISK_COLORS[selected.risk] + "15",
                        }}
                      >
                        {selected.risk}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">SCORE:</span>
                      <p className="font-bold text-lg text-white" style={{ color: RISK_COLORS[selected.risk] }}>
                        {selected.score}/100
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-gray-500 block">CITY/COUNTRY:</span>
                      <p className="text-white font-medium">📍 {selected.city || "Unknown"}, {selected.country || "Unknown"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block">COORDINATES:</span>
                      <p className="text-white text-[11px] font-mono">{selected.lat?.toFixed(4)}, {selected.lon?.toFixed(4)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block">ISP/CARRIER:</span>
                      <p className="text-white font-medium truncate">{selected.isp || "Unknown ISP"}</p>
                    </div>
                    {selected.scan_date && (
                      <div>
                        <span className="text-gray-500 block">LAST CORRELATION:</span>
                        <p className="text-white">{new Date(selected.scan_date).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Risk Legend:</span>
        {Object.entries(RISK_COLORS).map(([risk, color]) => (
          <div key={risk} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-mono font-bold" style={{ color }}>{risk}</span>
          </div>
        ))}
        <span className="text-xs font-mono ml-auto" style={{ color: "var(--text-muted)" }}>
          Showing {mapPoints.length} of {scans.length} targets (geolocation available)
        </span>
      </div>

      {/* Scan list below map */}
      {mapPoints.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border-color)" }}>
            <Zap className="h-4 w-4 text-cyber-primary" />
            <h2 className="font-bold text-sm">Mapped Threat Targets</h2>
          </div>
          <div className="divide-y" style={{ divideColor: "var(--border-color)", borderColor: "var(--border-color)" }}>
            {mapPoints.map((p, i) => {
              const color = RISK_COLORS[p.risk] || "#64748b";
              const isSelected = selected?.url === p.url;
              return (
                <div
                  key={i}
                  onClick={() => setSelected(p)}
                  className={`flex items-center justify-between p-4 hover:bg-slate-900/35 transition-all cursor-pointer ${
                    isSelected ? "bg-slate-900/60 border-l-2 border-cyber-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: color }} />
                    <span className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{p.url}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      📍 {p.city}, {p.country}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}>
                      {p.risk}
                    </span>
                    <span className="text-xs font-mono font-bold" style={{ color }}>{p.score}/100</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && mapPoints.length === 0 && scans.length === 0 && (
        <div className="text-center py-16 rounded-xl border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <Globe className="h-16 w-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            No scan data yet. Scan URLs in the Scanner tab to populate the threat map.
          </p>
        </div>
      )}
    </div>
  );
}
