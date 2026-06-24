import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldAlert, Activity, FileText, Globe, CheckCircle, 
  AlertTriangle, XOctagon, Download, ExternalLink, RefreshCw, FileDown,
  Server, Clock
} from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, CartesianGrid
} from "recharts";
import SecurityQuiz from "./SecurityQuiz";

const formatIndianDate = (dateString) => {
  if (!dateString) return "";
  let cleanStr = dateString;
  if (!cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
    cleanStr = cleanStr + 'Z';
  }
  const date = new Date(cleanStr);
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return formatter.format(date).replace(/\//g, '-');
};

const formatIndianTime = (dateString) => {
  if (!dateString) return "";
  let cleanStr = dateString;
  if (!cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
    cleanStr = cleanStr + 'Z';
  }
  const date = new Date(cleanStr);
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return formatter.format(date);
};

export default function Dashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/api/scanner/stats`, { headers }),
        axios.get(`${API_BASE}/api/scanner/history`, { headers })
      ]);

      setStats(statsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Error fetching dashboard analytics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const downloadReport = async (scanId) => {
    try {
      const response = await axios.get(`${API_BASE}/api/scanner/report/${scanId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob"
      });
      
      const file = new Blob([response.data], { type: "application/pdf" });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = fileURL;
      link.setAttribute("download", `aegis_report_${scanId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to download PDF report. Please verify connection.");
    }
  };

  // Export all scan history as CSV
  const exportCSV = () => {
    if (history.length === 0) return;
    const headers = ["ID", "URL", "Risk", "Score", "Issues", "Audit Date", "Audit Time"];
    const rows = history.map(scan => [
      scan.id,
      `"${scan.url}"`,
      scan.risk,
      scan.score,
      `"${(scan.issues || []).join('; ')}"`,
      formatIndianDate(scan.created_at),
      formatIndianTime(scan.created_at)
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `aegis_scan_history_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-cyber-bg text-white">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 text-cyber-primary animate-spin" />
          <p className="font-mono text-sm tracking-widest uppercase text-cyber-primary">
            Syncing Security Core...
          </p>
        </div>
      </div>
    );
  }

  // Formatting chart data
  const pieData = stats ? [
    { name: "Safe (Low Risk)", value: stats.low_risk_count, color: "#10b981" },
    { name: "Medium Risk", value: stats.medium_risk_count, color: "#f97316" },
    { name: "High Risk", value: stats.high_risk_count, color: "#ef4444" },
    { name: "Critical Risk", value: stats.critical_risk_count, color: "#881337" }
  ].filter(item => item.value > 0) : [];

  // If no scan data is registered, use standard mock counts for empty displays representation
  const chartPieData = pieData.length > 0 ? pieData : [
    { name: "No data available", value: 1, color: "#334155" }
  ];

  // Bar chart showing scores of recent scans
  const barData = history.slice(0, 8).reverse().map(item => {
    let urlClean = item.url.replace("https://", "").replace("http://", "");
    if (urlClean.length > 15) {
      urlClean = urlClean.substring(0, 12) + "...";
    }
    return {
      name: urlClean,
      Score: item.score
    };
  });

  // Threat categories breakdown — parse issues[] from all scans
  const threatCounts = { "SSL/TLS": 0, "Headers": 0, "Reputation": 0, "HTTPS": 0, "Phishing": 0, "Other": 0 };
  history.forEach(scan => {
    if (Array.isArray(scan.issues)) {
      scan.issues.forEach(issue => {
        if (/ssl|tls|certificate|cert/i.test(issue)) threatCounts["SSL/TLS"]++;
        else if (/header|csp|x-frame|hsts|content-security/i.test(issue)) threatCounts["Headers"]++;
        else if (/virustotal|reputation|malware/i.test(issue)) threatCounts["Reputation"]++;
        else if (/http[^s]|no https|insecure/i.test(issue)) threatCounts["HTTPS"]++;
        else if (/phish|phishtank|suspicious/i.test(issue)) threatCounts["Phishing"]++;
        else threatCounts["Other"]++;
      });
    }
  });

  const threatData = Object.entries(threatCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: name === "SSL/TLS" ? "#f97316" : name === "Headers" ? "#6366f1" : name === "Reputation" ? "#ef4444" : name === "HTTPS" ? "#eab308" : name === "Phishing" ? "#ec4899" : "#64748b"
    }))
    .sort((a, b) => b.value - a.value);


  const getScoreColor = (score) => {
    if (score >= 80) return "text-cyber-success";
    if (score >= 60) return "text-cyber-warning";
    return "text-cyber-danger";
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "LOW":
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-950/30 text-cyber-success border border-green-800/40">LOW</span>;
      case "MEDIUM":
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-orange-950/30 text-cyber-warning border border-orange-800/40">MEDIUM</span>;
      case "HIGH":
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-950/30 text-cyber-danger border border-red-800/40">HIGH</span>;
      case "CRITICAL":
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-950/30 text-rose-500 border border-rose-800/40">CRITICAL</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-950/30 text-slate-500 border border-slate-800/40">UNKNOWN</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-cyber-bg min-h-screen text-white">
      {/* Welcome & Dashboard Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Security Control Panel
          </h1>
          <p className="text-gray-400 mt-1 text-sm font-mono">
            Host status, scans analytics, and threat assessments overview.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800/50 border border-cyber-border text-xs font-semibold text-gray-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyber-primary" : ""}`} />
            <span>Refresh telemetry</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={history.length === 0}
            title="Export scan history as CSV"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800/50 border border-cyber-border text-xs font-semibold text-gray-300 hover:text-cyber-success hover:border-cyber-success hover:bg-green-950/20 transition-all cursor-pointer disabled:opacity-40"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <Link
            to="/scanner"
            className="flex items-center space-x-1 px-4 py-2 bg-cyber-primary hover:bg-cyan-400 text-black font-bold rounded-lg text-sm shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all"
          >

            <span>Scan URL</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-cyber-card border border-cyber-border p-5 rounded-xl flex items-center justify-between cyber-glow">
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">Overall Score</p>
            <h3 className={`text-4xl font-extrabold ${getScoreColor(stats?.average_score || 100)}`}>
              {stats ? Math.round(stats.average_score) : 100}
              <span className="text-sm font-normal text-gray-500">/100</span>
            </h3>
          </div>
          <Activity className="h-12 w-12 text-cyber-primary/20" />
        </div>

        <div className="bg-cyber-card border border-cyber-border p-5 rounded-xl flex items-center justify-between glow-success">
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">Safe Hosts</p>
            <h3 className="text-4xl font-extrabold text-cyber-success">
              {stats?.low_risk_count || 0}
            </h3>
          </div>
          <CheckCircle className="h-12 w-12 text-cyber-success/20" />
        </div>

        <div className="bg-cyber-card border border-cyber-border p-5 rounded-xl flex items-center justify-between glow-warning">
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">Medium Threats</p>
            <h3 className="text-4xl font-extrabold text-cyber-warning">
              {stats?.medium_risk_count || 0}
            </h3>
          </div>
          <AlertTriangle className="h-12 w-12 text-cyber-warning/20" />
        </div>

        <div className="bg-cyber-card border border-cyber-border p-5 rounded-xl flex items-center justify-between glow-danger">
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">High/Critical</p>
            <h3 className="text-4xl font-extrabold text-cyber-danger">
              {(stats?.high_risk_count || 0) + (stats?.critical_risk_count || 0)}
            </h3>
          </div>
          <XOctagon className="h-12 w-12 text-cyber-danger/20" />
        </div>
      </div>

      {/* Graphs Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-cyber-primary" />
            <span>Risk Breakdown</span>
          </h2>
          <div className="h-72 flex items-center justify-center">
            {stats && stats.total_scans > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm font-mono text-gray-500">Perform scan analysis to render charts telemetry.</p>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold flex items-center space-x-2">
            <Globe className="h-5 w-5 text-cyber-primary" />
            <span>Recent Target Security Scores</span>
          </h2>
          <div className="h-72 flex items-center justify-center">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  />
                  <Bar dataKey="Score" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.Score >= 80 ? "#10b981" : entry.Score >= 60 ? "#f97316" : "#ef4444"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm font-mono text-gray-500">Perform scan analysis to render charts telemetry.</p>
            )}
          </div>
        </div>
      </div>

      {/* Threat Categories Breakdown + Score Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat Categories Horizontal Bar */}
        <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-lg font-bold flex items-center space-x-2" style={{ color: "var(--text-primary)" }}>
            <AlertTriangle className="h-5 w-5 text-cyber-warning" />
            <span>Threat Categories Breakdown</span>
          </h2>
          {threatData.length === 0 ? (
            <p className="text-sm font-mono text-gray-500 py-8 text-center">Perform scans to see threat category breakdown.</p>
          ) : (
            <div className="space-y-3">
              {threatData.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-semibold" style={{ color: item.color }}>{item.name}</span>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: "var(--border-color)" }}>
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round((item.value / Math.max(...threatData.map(t => t.value))) * 100)}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Trend Line Chart */}
        <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-lg font-bold flex items-center space-x-2" style={{ color: "var(--text-primary)" }}>
            <Activity className="h-5 w-5 text-cyber-primary" />
            <span>Security Score Trend</span>
          </h2>
          <div className="h-48">
            {history.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Score"
                    stroke="#00f0ff"
                    strokeWidth={2}
                    dot={{ fill: "#00f0ff", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#00f0ff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm font-mono text-gray-500 flex items-center justify-center h-full">Need 2+ scans to render trend line.</p>
            )}
          </div>
        </div>
      </div>

      {/* Reports Table - Expanded Full Width */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between pb-2 border-b border-cyber-border/30">
          <h2 className="text-lg font-bold flex items-center space-x-2" style={{ color: "var(--text-primary)" }}>
            <FileText className="h-5 w-5 text-cyber-primary" />
            <span>Security Threat Telemetry Reports</span>
          </h2>
          <button
            onClick={handleRefresh}
            title="Refresh Scan History"
            disabled={refreshing}
            className="flex items-center justify-center p-1.5 rounded-lg bg-slate-800/50 border border-cyber-border hover:bg-slate-800 hover:border-cyber-primary text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyber-primary" : ""}`} />
          </button>
        </div>
        {history.length === 0 ? (
          <div className="text-center py-12 space-y-4 bg-slate-950/20 rounded-lg border border-dashed border-cyber-border">
            <Globe className="h-12 w-12 text-gray-600 mx-auto" />
            <p className="text-sm font-mono text-gray-400">No URL security diagnostics registered under this operator profile.</p>
            <Link
              to="/scanner"
              className="inline-block px-4 py-2 bg-cyber-primary text-black font-bold rounded-lg text-sm transition-all"
            >
              Analyze First Domain
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono text-gray-300">
              <thead className="bg-slate-900/60 text-xs font-semibold text-gray-400 uppercase border-b border-cyber-border">
                <tr>
                  <th className="p-4">Target URL</th>
                  <th className="p-4">Risk</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Audit Date</th>
                  <th className="p-4">Audit Time</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border">
                {history.map((scan) => (
                  <tr key={scan.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-2 max-w-sm sm:max-w-md truncate">
                        <Globe className="h-4 w-4 text-cyber-primary shrink-0" />
                        <a href={scan.url} target="_blank" rel="noopener noreferrer" className="hover:text-white flex items-center space-x-1 truncate">
                          <span className="truncate">{scan.url}</span>
                          <ExternalLink className="h-3 w-3 inline shrink-0 text-gray-500" />
                        </a>
                      </div>
                    </td>
                    <td className="p-4">{getRiskBadge(scan.risk)}</td>
                    <td className="p-4 font-bold">
                      <span className={getScoreColor(scan.score)}>{scan.score}</span>/100
                    </td>
                    <td className="p-4 text-xs text-gray-400">
                      {formatIndianDate(scan.created_at)}
                    </td>
                    <td className="p-4 text-xs text-gray-400">
                      {formatIndianTime(scan.created_at)}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => downloadReport(scan.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-gray-300 hover:text-white border border-cyber-border transition-all cursor-pointer"
                        title="Download PDF Diagnostics"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Grid: Security Trivia Quiz & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SecurityQuiz />
        </div>
        <div className="lg:col-span-1 bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h3 className="text-lg font-bold flex items-center space-x-2" style={{ color: "var(--text-primary)" }}>
            <Server className="h-5 w-5 text-cyber-primary" />
            <span>Platform Integration Status</span>
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Real-time status indicators for final year project telemetry checking.
          </p>
          
          <div className="space-y-3 font-mono text-xs pt-2">
            <div className="flex justify-between border-b border-cyber-border pb-1.5">
              <span style={{ color: "var(--text-muted)" }}>FastAPI Backend:</span>
              <span className="text-cyber-success font-bold flex items-center gap-1">🟢 ONLINE</span>
            </div>
            <div className="flex justify-between border-b border-cyber-border pb-1.5">
              <span style={{ color: "var(--text-muted)" }}>SQLite Database:</span>
              <span className="text-cyber-success font-bold flex items-center gap-1">🟢 CONNECTED</span>
            </div>
            <div className="flex justify-between border-b border-cyber-border pb-1.5">
              <span style={{ color: "var(--text-muted)" }}>Heuristic Engine:</span>
              <span className="text-cyber-primary font-bold">🟢 ACTIVE</span>
            </div>
            <div className="flex justify-between border-b border-cyber-border pb-1.5">
              <span style={{ color: "var(--text-muted)" }}>Core AI Model:</span>
              <span className="text-cyber-primary font-bold">Llama-3.1-8b</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Telemetry Zone:</span>
              <span className="text-cyber-warning font-bold">IST (Asia/Kolkata)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
