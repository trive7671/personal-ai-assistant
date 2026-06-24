import React, { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldOff, QrCode, Key, CheckCircle, AlertTriangle, Loader2, Copy, Check } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";

export default function TwoFASetup({ token }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("idle"); // idle | setup | verify | enabled
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/auth/2fa/status`, { headers });
      setStatus(res.data);
      if (res.data.totp_enabled) setStep("enabled");
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSetup = async () => {
    setProcessing(true);
    setMsg({ type: "", text: "" });
    try {
      const res = await axios.post(`${API_BASE}/api/auth/2fa/setup`, {}, { headers });
      setQrCode(res.data.qr_code);
      setSecret(res.data.secret);
      setStep("setup");
    } catch { setMsg({ type: "error", text: "Failed to initiate 2FA setup." }); }
    finally { setProcessing(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) return setMsg({ type: "error", text: "Enter a 6-digit code." });
    setProcessing(true);
    setMsg({ type: "", text: "" });
    try {
      await axios.post(`${API_BASE}/api/auth/2fa/verify`, { code: otpCode }, { headers });
      setMsg({ type: "success", text: "2FA enabled successfully! Your account is now protected." });
      setStep("enabled");
      setStatus({ totp_enabled: true });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.detail || "Invalid code. Try again." });
    } finally { setProcessing(false); setOtpCode(""); }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) return setMsg({ type: "error", text: "Enter your current OTP to disable 2FA." });
    setProcessing(true);
    setMsg({ type: "", text: "" });
    try {
      await axios.post(`${API_BASE}/api/auth/2fa/disable`, { code: otpCode }, { headers });
      setMsg({ type: "success", text: "2FA disabled. Your account no longer requires OTP." });
      setStep("idle");
      setStatus({ totp_enabled: false });
      setQrCode(""); setSecret(""); setOtpCode("");
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.detail || "Invalid code." });
    } finally { setProcessing(false); setOtpCode(""); }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 text-cyber-primary animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <Shield className="h-8 w-8 text-cyber-primary" />
          Two-Factor Authentication
        </h1>
        <p className="mt-1 text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          Add an extra layer of security to your Aegis AI account
        </p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${status?.totp_enabled ? "border-green-800/40 bg-green-950/20" : "border-slate-700 bg-slate-900/30"}`}>
        {status?.totp_enabled ? (
          <ShieldCheck className="h-10 w-10 text-cyber-success shrink-0" />
        ) : (
          <ShieldOff className="h-10 w-10 text-gray-500 shrink-0" />
        )}
        <div>
          <p className="font-bold text-lg" style={{ color: status?.totp_enabled ? "#10b981" : "var(--text-muted)" }}>
            2FA is {status?.totp_enabled ? "ENABLED" : "DISABLED"}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {status?.totp_enabled
              ? "Your account is protected with TOTP authentication."
              : "Enable 2FA to secure your account with Google Authenticator."}
          </p>
        </div>
      </div>

      {/* Feedback message */}
      {msg.text && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
          msg.type === "success" ? "bg-green-950/20 border-green-800/40 text-cyber-success" : "bg-red-950/20 border-red-800/40 text-cyber-danger"
        }`}>
          {msg.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* IDLE — not enabled */}
      {(step === "idle") && (
        <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <QrCode className="h-5 w-5 text-cyber-primary" />
            Set Up Authenticator App
          </h2>
          <ol className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <li>1. Install <strong>Google Authenticator</strong> or <strong>Authy</strong> on your phone</li>
            <li>2. Click "Generate QR Code" below</li>
            <li>3. Scan the QR code with your authenticator app</li>
            <li>4. Enter the 6-digit code to confirm setup</li>
          </ol>
          <button
            onClick={handleSetup}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyber-primary hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Generate QR Code
          </button>
        </div>
      )}

      {/* SETUP — show QR code */}
      {step === "setup" && (
        <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <QrCode className="h-5 w-5 text-cyber-primary" />
            Scan this QR Code
          </h2>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-xl inline-block shadow-lg">
              <img src={`data:image/png;base64,${qrCode}`} alt="2FA QR Code" className="w-48 h-48" />
            </div>
          </div>

          {/* Manual key fallback */}
          <div className="space-y-2">
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Or enter this key manually in your app:
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)" }}>
              <code className="text-sm text-cyber-primary font-mono flex-1 break-all">{secret}</code>
              <button onClick={copySecret} className="shrink-0 text-gray-400 hover:text-cyber-primary cursor-pointer transition-colors">
                {copied ? <Check className="h-4 w-4 text-cyber-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* OTP Verify form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Enter 6-digit code from your app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyber-primary"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
            <button
              type="submit"
              disabled={processing || otpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyber-primary hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify & Activate 2FA
            </button>
          </form>
        </div>
      )}

      {/* ENABLED — show disable option */}
      {step === "enabled" && (
        <div className="rounded-xl border border-red-900/30 p-6 space-y-4 bg-red-950/10">
          <h2 className="font-bold text-lg flex items-center gap-2 text-cyber-danger">
            <ShieldOff className="h-5 w-5" />
            Disable Two-Factor Authentication
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            To disable 2FA, enter your current authenticator code to confirm.
          </p>
          <form onSubmit={handleDisable} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Current OTP code"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyber-danger"
              style={{ backgroundColor: "var(--bg-input)", borderColor: "#7f1d1d", color: "var(--text-primary)" }}
            />
            <button
              type="submit"
              disabled={processing || otpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyber-danger hover:bg-red-400 text-white font-bold rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Disable 2FA
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
