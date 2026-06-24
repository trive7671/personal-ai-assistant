import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, User, Lock, AlertTriangle, Loader2, KeyRound } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState("credentials"); // "credentials" | "otp"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = { username, password };
      if (step === "otp") payload.otp_code = otpCode;

      const response = await axios.post(`${API_BASE}/api/auth/login-2fa`, payload);
      const { access_token } = response.data;
      onLoginSuccess(access_token);
      navigate("/");
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (detail === "2FA_REQUIRED") {
        // Move to OTP step
        setStep("otp");
        setError("");
      } else if (detail) {
        setError(detail);
      } else {
        setError("Network error connecting to cybersecurity engine.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyber-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-indigo/5 rounded-full blur-3xl" />

      <div className="max-w-md w-full space-y-8 bg-cyber-card border border-cyber-border p-8 rounded-xl shadow-2xl relative z-10 cyber-glow" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex flex-col items-center">
          <Shield className="h-16 w-16 text-cyber-primary filter drop-shadow-[0_0_12px_#00f0ff] mb-4" />
          <h2 className="text-center text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            AEGIS<span className="text-cyber-primary">.AI</span> Security Login
          </h2>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {step === "otp" ? "Enter your 6-digit authenticator code" : "Secure Web Threat Diagnostic Platform"}
          </p>
        </div>

        {/* Step indicator */}
        {step === "otp" && (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="flex items-center gap-2 text-xs font-mono text-cyber-success">
              <div className="w-5 h-5 rounded-full bg-cyber-success/20 border border-cyber-success flex items-center justify-center text-cyber-success text-xs">✓</div>
              Credentials
            </div>
            <div className="w-8 h-px bg-cyber-primary/40" />
            <div className="flex items-center gap-2 text-xs font-mono text-cyber-primary">
              <div className="w-5 h-5 rounded-full bg-cyber-primary/20 border border-cyber-primary flex items-center justify-center text-cyber-primary text-xs">2</div>
              Authenticator
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/20 border border-cyber-danger/50 text-cyber-danger px-4 py-3 rounded-lg flex items-center space-x-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-4 space-y-5" onSubmit={handleSubmit}>
          {step === "credentials" ? (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text" required value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary text-sm transition-all"
                    style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                    placeholder="operator123"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password" required value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary text-sm transition-all"
                    style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-cyber-primary/30 bg-cyber-primary/5 text-center space-y-1">
                <KeyRound className="h-8 w-8 text-cyber-primary mx-auto" />
                <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  Open your authenticator app and enter the 6-digit code for <strong className="text-cyber-primary">AEGIS AI</strong>
                </p>
              </div>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyber-primary"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "#00f0ff" }}
                autoFocus
              />
              <button type="button" onClick={() => { setStep("credentials"); setOtpCode(""); setError(""); }}
                className="w-full text-xs text-gray-400 hover:text-white transition-colors cursor-pointer">
                ← Back to credentials
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (step === "otp" && otpCode.length !== 6)}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg text-black bg-cyber-primary hover:bg-cyan-400 focus:outline-none transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-black" /> : step === "otp" ? "Verify & Login" : "Initialize Security Session"}
          </button>
        </form>

        <div className="text-center mt-4">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>New agent? </span>
          <Link to="/register" className="text-sm font-semibold text-cyber-primary hover:underline">
            Register credentials
          </Link>
        </div>
      </div>
    </div>
  );
}
