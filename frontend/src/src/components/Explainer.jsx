import React, { useState, useEffect } from "react";
import { BookOpen, HelpCircle, Code, ShieldCheck, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";

export default function Explainer({ token }) {
  const [selectedVuln, setSelectedVuln] = useState("SQL Injection");
  const [vulnData, setVulnData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [error, setError] = useState("");

  const presetVulns = ["SQL Injection", "XSS", "CSRF", "Broken Authentication"];

  const fetchVulnerabilityDetails = async (name) => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${API_BASE}/api/ai/explain-vulnerability`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVulnData(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch vulnerability assessment. Check server status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVulnerabilityDetails(selectedVuln);
  }, [selectedVuln]);

  const handleCustomQuerySubmit = (e) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    
    fetchVulnerabilityDetails(customQuery);
    setSelectedVuln(""); // Clear tab selection for custom queries representation
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 bg-cyber-bg min-h-screen text-white">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center space-x-2">
          <BookOpen className="h-8 w-8 text-cyber-primary" />
          <span>Vulnerability Explainer Module</span>
        </h1>
        <p className="text-gray-400 mt-1 text-sm font-mono">
          Explore vulnerabilities, see how attackers exploit them, inspect their impacts, and get coding remediation patches.
        </p>
      </div>

      {/* Preset tabs selector & Custom prompt search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Navigation panel */}
        <div className="lg:col-span-1 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-5">
          <div className="space-y-2">
            <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wider">
              Common Threat Profiles
            </h3>
            <div className="flex flex-col space-y-1.5">
              {presetVulns.map((vuln) => (
                <button
                  key={vuln}
                  onClick={() => {
                    setSelectedVuln(vuln);
                    setCustomQuery("");
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-mono font-semibold transition-all cursor-pointer ${
                    selectedVuln === vuln
                      ? "bg-cyber-primary/10 border border-cyber-primary/45 text-cyber-primary"
                      : "bg-slate-900/60 border border-cyber-border text-gray-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  <span>{vuln}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-cyber-border pt-4 space-y-3">
            <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wider">
              Query Custom Threat
            </h3>
            <form onSubmit={handleCustomQuerySubmit} className="space-y-2">
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="e.g. SSRF, Path Traversal"
                className="w-full px-3 py-2 bg-slate-900 border border-cyber-border rounded-lg text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary"
              />
              <button
                type="submit"
                className="w-full py-2 bg-cyber-primary hover:bg-cyan-400 text-black font-bold rounded-lg text-xs font-mono transition-all cursor-pointer"
              >
                Ask Aegis AI
              </button>
            </form>
          </div>
        </div>

        {/* Diagnostic assessment block */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="bg-cyber-card border border-cyber-border p-12 rounded-xl flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="h-8 w-8 text-cyber-primary animate-spin" />
              <p className="font-mono text-xs text-gray-400">Consulting AI Knowledge Base...</p>
            </div>
          ) : error ? (
            <div className="bg-red-950/20 border border-cyber-danger/50 text-cyber-danger p-6 rounded-xl text-sm font-mono">
              {error}
            </div>
          ) : vulnData ? (
            <div className="bg-cyber-card border border-cyber-border p-6 rounded-xl space-y-6 cyber-glow">
              {/* Header */}
              <div className="border-b border-cyber-border pb-4">
                <span className="text-xs font-mono text-cyber-primary uppercase tracking-widest font-bold">Threat profile</span>
                <h2 className="text-2xl font-bold font-mono text-white mt-1">{vulnData.name}</h2>
              </div>

              {/* Grid content */}
              <div className="space-y-5">
                {/* What is it */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold font-mono text-gray-400 flex items-center space-x-2">
                    <HelpCircle className="h-4.5 w-4.5 text-cyber-primary" />
                    <span>What is this?</span>
                  </h4>
                  <p className="text-xs font-mono leading-relaxed text-gray-300 pl-6 border-l border-slate-800">
                    {vulnData.what_is_it}
                  </p>
                </div>

                {/* How attackers use it */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold font-mono text-gray-400 flex items-center space-x-2">
                    <AlertCircle className="h-4.5 w-4.5 text-cyber-warning" />
                    <span>How Attackers Exploit It</span>
                  </h4>
                  <p className="text-xs font-mono leading-relaxed text-gray-300 pl-6 border-l border-slate-800">
                    {vulnData.how_attackers_use}
                  </p>
                </div>

                {/* Impact */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold font-mono text-gray-400 flex items-center space-x-2">
                    <Code className="h-4.5 w-4.5 text-cyber-danger" />
                    <span>Threat Severity & Impact</span>
                  </h4>
                  <p className="text-xs font-mono leading-relaxed text-gray-300 pl-6 border-l border-slate-800 font-semibold">
                    {vulnData.impact}
                  </p>
                </div>

                {/* How to fix */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold font-mono text-gray-400 flex items-center space-x-2">
                    <ShieldCheck className="h-4.5 w-4.5 text-cyber-success" />
                    <span>Remediation Protocols</span>
                  </h4>
                  <div className="text-xs font-mono leading-relaxed text-gray-300 pl-6 border-l border-slate-800 whitespace-pre-wrap prose prose-invert max-w-none">
                    {vulnData.how_to_fix}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-cyber-card border border-cyber-border p-12 rounded-xl text-center text-gray-500 font-mono text-sm">
              Select a threat profile from the navigation to load diagnostic profiles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
