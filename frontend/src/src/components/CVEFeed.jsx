import React, { useState, useEffect } from "react";
import { Shield, AlertTriangle, RefreshCw, Search, ExternalLink, Clock, ChevronDown, ChevronUp } from "lucide-react";

const SEVERITY_CONFIG = {
  CRITICAL: { color: "#ef4444", bg: "bg-red-950/30", border: "border-red-800/40", label: "CRITICAL" },
  HIGH:     { color: "#f97316", bg: "bg-orange-950/30", border: "border-orange-800/40", label: "HIGH" },
  MEDIUM:   { color: "#eab308", bg: "bg-yellow-950/30", border: "border-yellow-800/40", label: "MEDIUM" },
  LOW:      { color: "#10b981", bg: "bg-green-950/30", border: "border-green-800/40", label: "LOW" },
  UNKNOWN:  { color: "#64748b", bg: "bg-slate-950/30", border: "border-slate-700/40", label: "UNKNOWN" },
};

function getSeverity(cve) {
  try {
    const metrics = cve?.cve?.metrics;
    if (metrics?.cvssMetricV31?.[0]) return metrics.cvssMetricV31[0].cvssData.baseSeverity;
    if (metrics?.cvssMetricV30?.[0]) return metrics.cvssMetricV30[0].cvssData.baseSeverity;
    if (metrics?.cvssMetricV2?.[0]) {
      const score = metrics.cvssMetricV2[0].cvssData.baseScore;
      if (score >= 9) return "CRITICAL";
      if (score >= 7) return "HIGH";
      if (score >= 4) return "MEDIUM";
      return "LOW";
    }
  } catch {}
  return "UNKNOWN";
}

function getScore(cve) {
  try {
    const metrics = cve?.cve?.metrics;
    if (metrics?.cvssMetricV31?.[0]) return metrics.cvssMetricV31[0].cvssData.baseScore;
    if (metrics?.cvssMetricV30?.[0]) return metrics.cvssMetricV30[0].cvssData.baseScore;
    if (metrics?.cvssMetricV2?.[0]) return metrics.cvssMetricV2[0].cvssData.baseScore;
  } catch {}
  return null;
}

function CVECard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const cveId = item.cve?.id || "Unknown";
  const desc = item.cve?.descriptions?.find(d => d.lang === "en")?.value || "No description available.";
  const severity = getSeverity(item);
  const score = getScore(item);
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.UNKNOWN;
  const published = item.cve?.published ? new Date(item.cve.published).toLocaleDateString() : "N/A";
  const refs = item.cve?.references?.slice(0, 3) || [];

  return (
    <div className={`border rounded-xl p-5 space-y-3 transition-all duration-200 hover:shadow-lg ${cfg.bg} ${cfg.border}`}
      style={{ borderColor: cfg.color + "40" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold text-sm" style={{ color: cfg.color }}>{cveId}</span>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${cfg.bg} ${cfg.border}`}
            style={{ color: cfg.color, borderColor: cfg.color + "60" }}>
            {cfg.label}
          </span>
          {score && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700"
              style={{ color: cfg.color }}>
              CVSS {score}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Clock className="h-3 w-3 text-gray-500" />
          <span className="text-xs text-gray-500 font-mono">{published}</span>
        </div>
      </div>

      <p className={`text-sm text-gray-300 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>
        {desc}
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-cyber-primary hover:underline cursor-pointer"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Show less" : "Read more"}
        </button>
        {refs.length > 0 && (
          <a href={refs[0].url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyber-primary transition-colors">
            <ExternalLink className="h-3 w-3" />
            Reference
          </a>
        )}
      </div>
    </div>
  );
}

export default function CVEFeed({ token }) {
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const fetchCVEs = async () => {
    setError("");
    try {
      // Construct a dynamic date range for the latest 15 days (NVD API v2 requires ISO 8601: YYYY-MM-DDTHH:mm:ss.SSS)
      const now = new Date();
      const past = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const formatNVDDate = (d) => d.toISOString().split('.')[0] + '.000';
      const pubStartDate = formatNVDDate(past);
      const pubEndDate = formatNVDDate(now);

      const res = await fetch(
        `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${pubStartDate}&pubEndDate=${pubEndDate}&resultsPerPage=40`,
        { headers: { "Accept": "application/json" } }
      );
      if (!res.ok) throw new Error("NVD API error");
      const data = await res.json();
      
      const vulnerabilities = data.vulnerabilities || [];
      if (vulnerabilities.length === 0) {
        throw new Error("No recent CVEs in NVD date window");
      }

      // Sort descending by publication date
      const sorted = vulnerabilities.sort((a, b) => {
        const dateA = new Date(a.cve?.published || 0);
        const dateB = new Date(b.cve?.published || 0);
        return dateB - dateA;
      });
      setCves(sorted);
    } catch (e) {
      console.warn("NVD API failed, falling back to CIRCL feed:", e);
      // Fallback to CIRCL CVE API
      try {
        const res2 = await fetch("https://cve.circl.lu/api/last/40");
        if (!res2.ok) throw new Error();
        const data2 = await res2.json();
        // Normalize CIRCL format to match NVD structure
        const normalized = data2.map(c => ({
          cve: {
            id: c.id || c.cveMetadata?.cveId,
            published: c.cveMetadata?.datePublished || c.Published,
            descriptions: [{ lang: "en", value: c.containers?.cna?.descriptions?.[0]?.value || c.summary || "No description." }],
            metrics: {
              cvssMetricV2: c.cvss ? [{ cvssData: { baseScore: parseFloat(c.cvss) } }] : []
            },
            references: (c.containers?.cna?.references || []).slice(0, 3)
          }
        }));
        // Sort descending by publication date
        const sortedNormalized = normalized.sort((a, b) => {
          const dateA = new Date(a.cve?.published || 0);
          const dateB = new Date(b.cve?.published || 0);
          return dateB - dateA;
        });
        setCves(sortedNormalized);
      } catch {
        setError("Failed to load CVE feed. Check your internet connection.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCVEs(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchCVEs(); };

  const filtered = cves.filter(item => {
    const sev = getSeverity(item);
    const cveId = item.cve?.id || "";
    const desc = item.cve?.descriptions?.find(d => d.lang === "en")?.value || "";
    const matchSearch = search === "" || cveId.toLowerCase().includes(search.toLowerCase()) || desc.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "ALL" || sev === filter;
    return matchSearch && matchFilter;
  });

  const counts = { ALL: cves.length };
  ["CRITICAL", "HIGH", "MEDIUM", "LOW"].forEach(s => {
    counts[s] = cves.filter(c => getSeverity(c) === s).length;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-cyber-primary" />
            <span>Live CVE Intelligence Feed</span>
          </h1>
          <p className="mt-1 text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Real-time vulnerability disclosures from the National Vulnerability Database (NVD)
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-cyber-primary" : ""}`} />
          Refresh Feed
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { key: "ALL", label: "Total", color: "#00f0ff" },
          { key: "CRITICAL", label: "Critical", color: "#ef4444" },
          { key: "HIGH", label: "High", color: "#f97316" },
          { key: "MEDIUM", label: "Medium", color: "#eab308" },
          { key: "LOW", label: "Low", color: "#10b981" },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${filter === key ? "ring-2" : ""}`}
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: filter === key ? color : "var(--border-color)",
              ringColor: color
            }}
          >
            <p className="text-xl font-extrabold" style={{ color }}>{counts[key] || 0}</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search CVE ID or keyword (e.g. Apache, Windows, RCE)..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyber-primary transition-all"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw className="h-10 w-10 text-cyber-primary animate-spin" />
          <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>Fetching latest CVE intelligence...</p>
        </div>
      ) : error ? (
        <div className="bg-red-950/20 border border-cyber-danger/50 text-cyber-danger p-6 rounded-xl font-mono text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Showing {filtered.length} of {cves.length} vulnerabilities
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-16 font-mono text-sm" style={{ color: "var(--text-muted)" }}>
              No CVEs match your search criteria.
            </div>
          ) : (
            filtered.map((item, i) => <CVECard key={item.cve?.id || i} item={item} />)
          )}
        </div>
      )}
    </div>
  );
}
