import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./config";

// Import Components
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import { AuthProvider } from "./context/AuthContext";
import Dashboard from "./components/Dashboard";
import Scanner from "./components/Scanner";
import Chatbot from "./components/Chatbot";
import CVEFeed from "./components/CVEFeed";
import ThreatMap from "./components/ThreatMap";
import TwoFASetup from "./components/TwoFASetup";
import Profile from "./components/Profile";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("aegis_token") || "");
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const checkUserSession = async () => {
      if (!token) {
        setUser(null);
        setInitializing(false);
        return;
      }
      try {
        const response = await axios.get(`${API_BASE}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
      } catch (err) {
        console.error("Token verification failed:", err);
        handleLogout();
      } finally {
        setInitializing(false);
      }
    };
    checkUserSession();
  }, [token]);

  const handleLoginSuccess = (access_token) => {
    localStorage.setItem("aegis_token", access_token);
    setToken(access_token);
  };

  const handleLogout = () => {
    localStorage.removeItem("aegis_token");
    setToken("");
    setUser(null);
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 border-4 border-cyber-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-xs text-gray-400">Loading Session Credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col font-sans select-none" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
          {token && user && <Navbar user={user} onLogout={handleLogout} />}

          <main className="flex-grow">
            <Routes>
              {/* Authenticated Routes */}
              <Route path="/" element={token ? <Dashboard token={token} /> : <Navigate to="/login" />} />
              <Route path="/scanner" element={token ? <Scanner token={token} /> : <Navigate to="/login" />} />
              <Route path="/chatbot" element={token ? <Chatbot token={token} /> : <Navigate to="/login" />} />
              <Route path="/threat-map" element={token ? <ThreatMap token={token} /> : <Navigate to="/login" />} />
              <Route path="/cve-feed" element={token ? <CVEFeed token={token} /> : <Navigate to="/login" />} />
              <Route path="/2fa-setup" element={token ? <TwoFASetup token={token} /> : <Navigate to="/login" />} />
              <Route path="/profile" element={token ? <Profile token={token} /> : <Navigate to="/login" />} />

              {/* Guest Routes */}
              <Route path="/login" element={!token ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" />} />
              <Route path="/register" element={!token ? <Register /> : <Navigate to="/" />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
