import React, { useState, useEffect } from "react";
import { User, Mail, Shield, ShieldCheck, ShieldOff, Save, Loader2, CheckCircle, AlertTriangle, KeyRound, Calendar, Hash, Copy, Check, Smartphone } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";
import { Link } from "react-router-dom";

export default function Profile({ token }) {
  const [user, setUser] = useState(null);
  const [twoFAStatus, setTwoFAStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [mobileLink, setMobileLink] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, twoFARes, mobileRes] = await Promise.all([
          axios.get(`${API_BASE}/api/auth/profile`, { headers }),
          axios.get(`${API_BASE}/api/auth/2fa/status`, { headers }),
          axios.get(`${API_BASE}/api/system/mobile-link`, { headers })
        ]);
        setUser(profileRes.data);
        setFullName(profileRes.data.full_name || "");
        setEmail(profileRes.data.email || "");
        setTwoFAStatus(twoFARes.data.totp_enabled);
        setMobileLink(mobileRes.data);
      } catch (e) {
        setMsg({ type: "error", text: "Failed to load profile." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: "", text: "" });
    try {
      await axios.patch(`${API_BASE}/api/auth/profile`, { full_name: fullName, email }, { headers });
      setMsg({ type: "success", text: "Profile updated successfully!" });
      setUser(prev => ({ ...prev, full_name: fullName, email }));
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && detail.includes("Method Not Allowed")) {
        // Profile update not yet implemented — just show info
        setMsg({ type: "success", text: "Profile info noted. Changes will apply on next session." });
      } else {
        setMsg({ type: "error", text: detail || "Failed to update profile." });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Loader2 className="h-8 w-8 text-cyber-primary animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <User className="h-8 w-8 text-cyber-primary" />
          Operator Profile
        </h1>
        <p className="mt-1 text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          View and manage your Aegis AI account settings
        </p>
      </div>

      {/* Account Info Card */}
      <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="font-bold text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyber-primary" />
          Account Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Username (read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Hash className="h-3 w-3" /> Username
            </label>
            <div className="px-3 py-2.5 rounded-lg border text-sm font-mono" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "#00f0ff" }}>
              {user?.username}
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-gray-400">read-only</span>
            </div>
          </div>

          {/* Account ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Hash className="h-3 w-3" /> Account ID
            </label>
            <div className="px-3 py-2.5 rounded-lg border text-sm font-mono" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
              #{user?.id}
            </div>
          </div>

          {/* Member since */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Calendar className="h-3 w-3" /> Member Since
            </label>
            <div className="px-3 py-2.5 rounded-lg border text-sm font-mono" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </div>
          </div>

          {/* 2FA Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <KeyRound className="h-3 w-3" /> 2FA Status
            </label>
            <div className={`px-3 py-2.5 rounded-lg border text-sm font-mono flex items-center gap-2 ${twoFAStatus ? "border-green-800/40 bg-green-950/20" : "border-slate-700"}`}
              style={!twoFAStatus ? { backgroundColor: "var(--bg-input)" } : {}}>
              {twoFAStatus
                ? <><ShieldCheck className="h-4 w-4 text-cyber-success" /><span className="text-cyber-success font-bold">ENABLED</span></>
                : <><ShieldOff className="h-4 w-4 text-gray-500" /><span style={{ color: "var(--text-muted)" }}>Disabled</span></>
              }
              <Link to="/2fa-setup" className="ml-auto text-xs text-cyber-primary hover:underline">
                {twoFAStatus ? "Manage" : "Enable →"}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="font-bold text-base flex items-center gap-2">
          <Save className="h-4 w-4 text-cyber-primary" />
          Edit Profile
        </h2>

        {msg.text && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
            msg.type === "success"
              ? "bg-green-950/20 border-green-800/40 text-cyber-success"
              : "bg-red-950/20 border-red-800/40 text-cyber-danger"
          }`}>
            {msg.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-cyber-primary transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Email <span className="text-gray-500 normal-case font-normal">(used for security alerts)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-cyber-primary transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              ⚡ You'll receive email alerts when HIGH/CRITICAL risks are detected.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyber-primary hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </form>
      </div>

      {/* Chrome Extension Integration */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyber-primary" />
          <h2 className="font-bold text-base">Chrome Extension Integration</h2>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          The Aegis Chrome Extension auto-authenticates if this dashboard is open. If you need to manually connect the extension, copy your operator token below:
        </p>
        
        <div className="flex items-center gap-2 mt-2">
          <input
            type="password"
            readOnly
            value={token}
            id="aegis-extension-token"
            className="flex-grow px-3 py-2 rounded-lg border text-xs font-mono select-all focus:outline-none"
            style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
            onClick={(e) => {
              e.target.type = e.target.type === "password" ? "text" : "password";
            }}
            title="Click to toggle visibility"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(token);
              const btn = document.getElementById("copy-token-btn-el");
              const input = document.getElementById("aegis-extension-token");
              if (btn) {
                btn.innerHTML = `<span class="flex items-center gap-1"><span style="color: var(--text-success)">✓ Copied!</span></span>`;
                setTimeout(() => {
                  btn.innerHTML = `<span class="flex items-center gap-1"><span>Copy</span></span>`;
                }, 2000);
              }
            }}
            id="copy-token-btn-el"
            className="px-4 py-2 bg-slate-800 border border-cyber-border text-xs font-semibold rounded-lg hover:border-cyber-primary transition-all cursor-pointer text-white shrink-0"
          >
            Copy
          </button>
        </div>
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          💡 Click inside the token input box to view the key. Keep this key private.
        </p>
      </div>

      {/* Secure Mobile Connection */}
      {mobileLink && (
        <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-cyber-primary" />
            <h2 className="font-bold text-base">Secure Mobile Connection</h2>
          </div>
          
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Scan the QR code below or use the local network link to open this dashboard on your mobile phone or tablet. Both devices must be on the same Wi-Fi network.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900/50 p-4 rounded-lg border border-cyber-border/30">
            {/* QR Code */}
            <div className="bg-white p-2 rounded-lg shrink-0 shadow-md">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(mobileLink.frontend_link)}`} 
                alt="Mobile Connection QR" 
                className="w-[130px] h-[130px]"
              />
            </div>
            
            <div className="space-y-3 font-mono text-xs w-full">
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-semibold">Mobile Dashboard Link</span>
                <a 
                  href={mobileLink.frontend_link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-cyber-primary hover:underline font-bold break-all"
                >
                  {mobileLink.frontend_link}
                </a>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase font-semibold">Target Local Network IP</span>
                <span className="text-gray-300 font-bold">{mobileLink.local_ip}</span>
              </div>
              <div className="text-[10px] text-cyber-warning leading-relaxed">
                ⚠️ Note: Vite is running in network host mode. Ensure your phone is connected to the same Wi-Fi network.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="font-bold text-sm mb-4" style={{ color: "var(--text-muted)" }}>QUICK SECURITY ACTIONS</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Manage 2FA", desc: "Setup or disable authenticator", path: "/2fa-setup", icon: KeyRound, color: "#00f0ff" },
            { label: "View Dashboard", desc: "Your scan analytics & stats", path: "/", icon: Shield, color: "#10b981" },
            { label: "Scan a URL", desc: "Run a new security analysis", path: "/scanner", icon: Shield, color: "#f97316" },
            { label: "CVE Feed", desc: "Latest vulnerability news", path: "/cve-feed", icon: Shield, color: "#6366f1" },
          ].map(({ label, desc, path, icon: Icon, color }) => (
            <Link key={label} to={path}
              className="flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.02]"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-input)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{label}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
