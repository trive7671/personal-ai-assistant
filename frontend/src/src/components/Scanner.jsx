import React, { useState } from "react";
import { 
  ShieldCheck, ShieldAlert, Search, RefreshCw, AlertTriangle, 
  CheckCircle, FileDown, ArrowRight, Server, Clock, Lock
} from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";

const formatIndianDateTime = (dateString) => {
  if (!dateString) return "";
  let cleanStr = dateString;
  if (!cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
    cleanStr = cleanStr + 'Z';
  }
  const date = new Date(cleanStr);
  const dFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const tFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return `${dFormatter.format(date).replace(/\//g, '-')}, ${tFormatter.format(date)}`;
};

export default function Scanner({ token }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const steps = [
    { title: "Resolving hostname and DNS records...", icon: Server },
    { title: "Analyzing SSL/TLS certificates and handshake protocols...", icon: Lock },
    { title: "Tracing HTTP redirects and auditing response headers...", icon: RefreshCw },
    { title: "Analyzing URL naming structure and phishing markers...", icon: AlertTriangle },
    { title: "Generating expert AI remediation assessments...", icon: ShieldCheck }
  ];

  const handleScan = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    setError("");
    setResult(null);
    setLoading(true);
    setScanStep(0);

    // Simulate scanning stages visual feedback
    const runSteps = () => {
      return new Promise((resolve) => {
        let currentStep = 0;
        const interval = setInterval(() => {
          currentStep += 1;
          if (currentStep < steps.length) {
            setScanStep(currentStep);
          } else {
            clearInterval(interval);
            resolve();
          }
        }, 800);
      });
    };

    try {
      const apiPromise = axios.post(
        `${API_BASE}/api/scanner/scan`,
        { url },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Run checkpoints visual logging first, then resolve API data
      await runSteps();
      const response = await apiPromise;
      setResult(response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Scanning failed. Please check network connection.");
      }
    } finally {
      setLoading(false);
    }
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
      alert("Failed to download PDF report.");
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "border-cyber-success text-cyber-success";
    if (score >= 60) return "border-cyber-warning text-cyber-warning";
    return "border-cyber-danger text-cyber-danger";
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "LOW":
        return <span className="px-3 py-1 font-bold text-sm rounded bg-green-950/40 text-cyber-success border border-green-800/40">LOW RISK</span>;
      case "MEDIUM":
        return <span className="px-3 py-1 font-bold text-sm rounded bg-orange-950/40 text-cyber-warning border border-orange-800/40">MEDIUM RISK</span>;
      case "HIGH":
        return <span className="px-3 py-1 font-bold text-sm rounded bg-red-950/40 text-cyber-danger border border-red-800/40">HIGH RISK</span>;
      case "CRITICAL":
        return <span className="px-3 py-1 font-bold text-sm rounded bg-rose-950/40 text-rose-500 border border-rose-800/40">CRITICAL RISK</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-cyber-bg min-h-screen text-white">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center space-x-2">
          <Search className="h-8 w-8 text-cyber-primary" />
          <span>Real-time URL Security Scanner</span>
        </h1>
        <p className="text-gray-400 mt-1 text-sm font-mono">
          Analyze website HTTPS schemas, redirection routes, domain naming, and TLS certificates metrics.
        </p>
      </div>

      {/* Input scanner bar */}
      <form onSubmit={handleScan} className="bg-cyber-card border border-cyber-border p-4 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-grow">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. website.com or https://website-banking.net"
              className="block w-full px-4 py-3 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary focus:border-cyber-primary text-sm transition-all"
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-cyber-primary hover:bg-cyan-400 text-black font-extrabold rounded-lg text-sm shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <span>Launch Analysis</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-950/20 border border-cyber-danger/50 text-cyber-danger px-4 py-3 rounded-lg flex items-center space-x-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loader visual animations checklist */}
      {loading && (
        <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4">
          <h3 className="text-sm font-bold font-mono text-cyber-primary tracking-wider uppercase">
            Diagnostics execution chain:
          </h3>
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isCurrent = scanStep === idx;
              const isPassed = scanStep > idx;
              
              return (
                <div 
                  key={idx} 
                  className={`flex items-center space-x-3 text-sm transition-opacity duration-300 ${
                    isCurrent ? "opacity-100 font-bold" : isPassed ? "opacity-60" : "opacity-35"
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle className="h-4 w-4 text-cyber-success shrink-0" />
                  ) : isCurrent ? (
                    <RefreshCw className="h-4 w-4 text-cyber-primary animate-spin shrink-0" />
                  ) : (
                    <Icon className="h-4 w-4 text-gray-500 shrink-0" />
                  )}
                  <span className="font-mono">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scan details render */}
      {result && (
        <div className="space-y-6">
          {/* Risk panel card */}
          <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 cyber-glow">
            <div className="flex items-center space-x-5">
              {/* Radial score circle */}
              <div className={`w-24 h-24 border-[6px] rounded-full flex flex-col items-center justify-center font-mono ${getScoreColor(result.score)} bg-slate-900 shadow-md`}>
                <span className="text-3xl font-extrabold">{result.score}</span>
                <span className="text-[10px] text-gray-400">SCORE</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-mono truncate max-w-sm sm:max-w-md" title={result.url}>{result.url}</h2>
                <div className="flex flex-wrap items-center gap-3">
                  {getRiskBadge(result.risk)}
                  <span className="text-xs text-gray-400 font-mono flex items-center space-x-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Analyzed: {formatIndianDateTime(result.created_at)}</span>
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => downloadReport(result.id)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg border border-cyber-border text-sm transition-all cursor-pointer hover:border-cyber-primary"
            >
              <FileDown className="h-4 w-4 text-cyber-primary" />
              <span>Download PDF Diagnostics</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* List of issues */}
            <div className="md:col-span-1 bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4">
              <h3 className="font-extrabold text-sm text-gray-400 uppercase tracking-wider font-mono">
                Detected Vulnerability Alerts
              </h3>
              
              {result.issues.length === 0 ? (
                <div className="flex items-center space-x-2 text-cyber-success text-sm bg-green-950/20 border border-green-900/30 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <span>No security warnings detected on this host.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5 text-xs text-cyber-danger bg-red-950/15 border border-red-900/30 p-2.5 rounded-lg">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-cyber-danger mt-0.5" />
                      <span className="font-mono">{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI mitigation block */}
            <div className="md:col-span-2 bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-4">
              <h3 className="font-extrabold text-sm text-cyber-primary uppercase tracking-wider font-mono">
                AI Expert Analysis & Remediations
              </h3>
              <div className="prose prose-invert prose-sm max-w-none text-gray-300 font-mono whitespace-pre-wrap leading-relaxed border-t border-cyber-border pt-4">
                {result.ai_explanation}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
