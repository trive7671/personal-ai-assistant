import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Shield, LayoutDashboard, Search, MessageSquare,
  Globe, Newspaper, ShieldCheck, LogOut, Sun, Moon,
  Menu, X, User, Download
} from "lucide-react";
import { API_BASE } from "../config";

export default function Navbar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("aegis_theme") || "dark";
    setIsDark(saved === "dark");
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("aegis_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogoutClick = () => {
    onLogout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard",   path: "/",           icon: LayoutDashboard },
    { name: "URL Scanner", path: "/scanner",     icon: Search },
    { name: "AI Chatbot",  path: "/chatbot",     icon: MessageSquare },
    { name: "Threat Map",  path: "/threat-map",  icon: Globe },
    { name: "CVE Feed",    path: "/cve-feed",    icon: Newspaper },
    { name: "2FA Setup",   path: "/2fa-setup",   icon: ShieldCheck },
    { name: "Profile",     path: "/profile",     icon: User },
  ];

  const NavLink = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
          isActive
            ? "text-cyber-primary bg-cyber-primary/10 border-b-2 border-cyber-primary"
            : "hover:bg-slate-800/50"
        }`}
        style={isActive ? {} : { color: "var(--text-secondary)" }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <nav
      className="border-b sticky top-0 z-50"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group shrink-0">
            <Shield className="h-7 w-7 text-cyber-primary filter drop-shadow-[0_0_8px_#00f0ff] group-hover:scale-110 transition-transform" />
            <span className="font-extrabold text-lg tracking-wider" style={{ color: "var(--text-primary)" }}>
              AEGIS<span className="text-cyber-primary">.AI</span>
            </span>
          </Link>

          {/* Desktop Nav items */}
          <div className="hidden xl:flex space-x-0.5">
            {navItems.map(item => <NavLink key={item.path} item={item} />)}
          </div>

          {/* Right controls */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Light Mode" : "Dark Mode"}
              className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer hover:border-cyber-primary"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-input)" }}
            >
              {isDark
                ? <Sun className="h-3.5 w-3.5 text-cyber-primary" />
                : <Moon className="h-3.5 w-3.5 text-cyber-primary" />
              }
            </button>

            {/* Username badge — hidden on small */}
            {user && (
              <Link to="/profile"
                className="hidden md:flex items-center gap-1.5 text-xs border rounded px-2 py-1 font-mono hover:border-cyber-primary transition-all"
                style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)", backgroundColor: "var(--bg-input)" }}
                title="View Profile"
              >
                <User className="h-3 w-3" />
                <span className="text-cyber-success font-semibold">{user.full_name || user.username}</span>
              </Link>
            )}

            {/* Download Extension */}
            <a
              href={`${API_BASE}/api/system/download-extension`}
              download="aegis_extension.zip"
              className="hidden sm:flex items-center space-x-1 px-3 py-1.5 rounded text-xs font-semibold bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30 hover:bg-cyber-primary hover:text-black transition-all cursor-pointer"
              title="Download Chrome Extension ZIP"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Extension</span>
            </a>

            {/* Logout */}
            <button
              onClick={handleLogoutClick}
              className="hidden sm:flex items-center space-x-1 px-3 py-1.5 rounded text-xs font-semibold bg-red-950/20 text-cyber-danger border border-red-900/40 hover:bg-cyber-danger hover:text-white transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>

            {/* Hamburger — visible on < xl */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="xl:hidden flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div
          className="xl:hidden border-t"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30"
                      : "hover:bg-slate-800/50"
                  }`}
                  style={isActive ? {} : { color: "var(--text-secondary)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}

            {/* Download Extension in mobile */}
            <div className="pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
              <a
                href={`${API_BASE}/api/system/download-extension`}
                download="aegis_extension.zip"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-cyber-primary hover:bg-cyber-primary/10 transition-all cursor-pointer border border-dashed border-cyber-primary/30"
              >
                <Download className="h-4 w-4 shrink-0" />
                Download Extension
              </a>
            </div>

            {/* Logout row in mobile */}
            <div className="pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-cyber-danger hover:bg-red-950/20 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
