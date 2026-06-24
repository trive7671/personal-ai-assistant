import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, User, Mail, Lock, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";

// Password strength scorer
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "Weak", color: "#ef4444", width: "20%" };
  if (score === 2) return { label: "Fair", color: "#f97316", width: "40%" };
  if (score === 3) return { label: "Good", color: "#eab308", width: "60%" };
  if (score === 4) return { label: "Strong", color: "#10b981", width: "80%" };
  return { label: "Very Strong", color: "#00f0ff", width: "100%" };
}

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }

    setLoading(true);

    try {
      await axios.post(`${API_BASE}/api/auth/register`, {
        username,
        password,
        full_name: fullName,
        email,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Network error registering new operator.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Visual background details */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyber-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-indigo/5 rounded-full blur-3xl" />

      <div className="max-w-md w-full space-y-8 bg-cyber-card border border-cyber-border p-8 rounded-xl shadow-2xl relative z-10 cyber-glow" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex flex-col items-center">
          <Shield className="h-16 w-16 text-cyber-primary filter drop-shadow-[0_0_12px_#00f0ff] mb-4" />
          <h2 className="text-center text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Register Agent Profile
          </h2>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            Create an operator account on AEGIS Security Core
          </p>
        </div>

        {error && (
          <div className="bg-red-950/20 border border-cyber-danger/50 text-cyber-danger px-4 py-3 rounded-lg flex items-center space-x-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-950/20 border border-cyber-success/50 text-cyber-success px-4 py-3 rounded-lg flex items-center space-x-3 text-sm">
            <span>Operator registered successfully. Syncing session...</span>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary focus:border-cyber-primary text-sm transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="Agent Name"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary focus:border-cyber-primary text-sm transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="operator123"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email Address <span className="text-gray-500 normal-case font-normal">(for security alerts)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary focus:border-cyber-primary text-sm transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="agent@example.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Create Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary focus:border-cyber-primary text-sm transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: "var(--border-color)" }}>
                  <div
                    className="strength-bar h-1.5 rounded-full"
                    style={{ width: strength.width, backgroundColor: strength.color }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {password.length} chars
                  </span>
                </div>
                <div className="flex space-x-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className={/[A-Z]/.test(password) ? "text-cyber-success" : ""}>A-Z</span>
                  <span className={/[0-9]/.test(password) ? "text-cyber-success" : ""}>0-9</span>
                  <span className={/[^A-Za-z0-9]/.test(password) ? "text-cyber-success" : ""}>!@#</span>
                  <span className={password.length >= 8 ? "text-cyber-success" : ""}>8+ chars</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-slate-900 border border-cyber-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyber-primary focus:border-cyber-primary text-sm transition-all"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="Repeat password"
              />
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-xs mt-1 font-mono ${password === confirmPassword ? "text-cyber-success" : "text-cyber-danger"}`}>
                {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-bold rounded-lg text-black bg-cyber-primary hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyber-primary transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-black" />
              ) : (
                "Create Profile"
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Already registered? </span>
          <Link
            to="/login"
            className="text-sm font-semibold text-cyber-primary hover:underline"
          >
            Authenticate session
          </Link>
        </div>
      </div>
    </div>
  );
}
