import React, { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, Send, ShieldAlert, Cpu, User, RefreshCw, 
  Plus, Trash2, Shield, Key, Compass, ExternalLink, ArrowRight,
  Brain
} from "lucide-react";
import axios from "axios";
import { API_BASE } from "../config";
import { Link } from "react-router-dom";

// Parse message text to extract optional reasoning thought blocks
const parseMessageText = (text) => {
  if (!text) return { thought: null, text: "" };
  const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/i;
  const match = text.match(thoughtRegex);
  if (match) {
    const thoughtContent = match[1].trim();
    const cleanText = text.replace(thoughtRegex, "").trim();
    return { thought: thoughtContent, text: cleanText };
  }
  return { thought: null, text };
};

export default function Chatbot({ token }) {
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Affirmative, Operator. I am Aegis, your AI Cybersecurity Assistant. Ask me to scan a URL, explain vulnerability mechanics, or advice on server hardening policies.",
      session_id: "default"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("default");
  const [isClearingSingle, setIsClearingSingle] = useState(null);
  
  const chatEndRef = useRef(null);

  const [cards, setCards] = useState([
    { title: "Website Security", desc: "Audit configurations & SSL setup", query: "How do I audit my website SSL certificate?" },
    { title: "OWASP Vulnerabilities", desc: "Explain core vulnerability concepts", query: "Explain Cross-Site Scripting (XSS) and how to mitigate it" },
    { title: "2FA Integration", desc: "Hardening login configurations", query: "How does Time-based One-Time Password (TOTP) protect logins?" },
    { title: "Server Patching", desc: "Harden Nginx/Apache configs", query: "Give me the standard security headers to add to Nginx configs" }
  ]);

  // Load user scan history to build contextual prompt cards
  useEffect(() => {
    const fetchLastAudit = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/scanner/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data && response.data.length > 0) {
          const scans = response.data;
          
          // Build recent chats list for sidebar
          const uniqueDomains = Array.from(new Set(scans.map(s => s.url.replace(/^https?:\/\//, "").split("/")[0]))).slice(0, 5);
          setRecentChats(uniqueDomains);

          // Update dynamic greeting prompt cards
          const lastScan = scans[0];
          const cleanDomain = lastScan.url.replace(/^https?:\/\//, "").split("/")[0];
          setCards([
            { title: `Audit ${cleanDomain}`, desc: `Why was it rated ${lastScan.risk}?`, query: `Explain the vulnerability risks found on ${cleanDomain} with score ${lastScan.score}` },
            { title: "Secure Threat Map", desc: "Understand scanning geolocation", query: "How is Leaflet geolocating threat coordinates in our system?" },
            { title: "2FA Authentication", desc: "Hardening login security", query: "Explain how to configure Google Authenticator with JWT" },
            { title: "CVE Vulnerabilities", desc: "Search vulnerability databases", query: "Tell me about the latest critical remote code execution (RCE) CVEs" }
          ]);
        }
      } catch (err) {
        console.error("Failed to load last audit metrics for suggestions:", err);
      }
    };
    if (token) {
      fetchLastAudit();
    }
  }, [token]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/ai/chat/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data) {
          setMessages(response.data);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    if (token) {
      fetchHistory();
    }
  }, [token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend) => {
    if (!textToSend.trim()) return;

    const userMessage = { 
      sender: "user", 
      text: textToSend, 
      session_id: activeSessionId,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const activeHistory = messages.filter((m) => (m.session_id || "default") === activeSessionId);

    try {
      const response = await axios.post(
        `${API_BASE}/api/ai/chat`,
        {
          message: textToSend,
          history: activeHistory.slice(-10),
          session_id: activeSessionId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const aiResponse = { 
        sender: "ai", 
        text: response.data.response,
        session_id: activeSessionId,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error(err);
      const errorResponse = {
        sender: "ai",
        text: "Failed to connect to the cybersecurity AI core. Please verify your backend server is online.",
        session_id: activeSessionId,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleNewSession();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNewSession = () => {
    const newSid = "session_" + Date.now();
    setActiveSessionId(newSid);
  };

  const executeClearChat = async () => {
    setIsClearing(true);
    setClearError("");
    try {
      await axios.delete(`${API_BASE}/api/ai/chat/clear`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages([]);
      setActiveSessionId("default");
      setShowConfirmModal(false);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
      setClearError("Failed to reset chat session. Please verify connection.");
    } finally {
      setIsClearing(false);
    }
  };

  const executeDeleteSession = async (sid) => {
    setIsClearingSingle(sid);
    try {
      await axios.delete(`${API_BASE}/api/ai/chat/clear?session_id=${sid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages((prev) => prev.filter((m) => (m.session_id || "default") !== sid));
      if (activeSessionId === sid) {
        setActiveSessionId("default");
      }
    } catch (err) {
      console.error("Failed to delete chat session:", err);
      alert("Failed to delete chat session. Please verify connection.");
    } finally {
      setIsClearingSingle(null);
    }
  };

  // Group messages by session_id
  const groupedSessions = {};
  messages.forEach((msg) => {
    const sid = msg.session_id || "default";
    if (!groupedSessions[sid]) {
      groupedSessions[sid] = [];
    }
    groupedSessions[sid].push(msg);
  });

  // Calculate past conversations list
  const sessionList = Object.keys(groupedSessions)
    .filter((sid) => {
      return groupedSessions[sid].some((m) => m.sender === "user");
    })
    .map((sid) => {
      const sMessages = groupedSessions[sid];
      const firstUserMsg = sMessages.find((m) => m.sender === "user");
      const lastMsg = sMessages[sMessages.length - 1];
      return {
        id: sid,
        title: firstUserMsg ? firstUserMsg.text : "New Chat",
        updatedAt: lastMsg ? new Date(lastMsg.created_at || Date.now()) : new Date()
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const activeSessionMessages = groupedSessions[activeSessionId] || [];
  
  const displayMessages = activeSessionMessages.length > 0 
    ? activeSessionMessages
    : [
        {
          sender: "ai",
          text: "Affirmative, Operator. I am Aegis, your AI Cybersecurity Assistant. Ask me to scan a URL, explain vulnerability mechanics, or advice on server hardening policies.",
          session_id: activeSessionId
        }
      ];

  const hasUserMessages = activeSessionMessages.some(m => m.sender === "user");
  const isFreshChat = !hasUserMessages;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-5rem)] text-white">
      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-cyber-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-cyber-danger">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-bold">Clear Chat History?</h3>
            </div>
            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              This will permanently delete all your conversation logs from the server database and start a fresh session.
            </p>
            {clearError && (
              <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 p-2.5 rounded font-mono">
                {clearError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isClearing}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-cyber-border text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={executeClearChat}
                disabled={isClearing}
                className="px-4 py-2 rounded-lg bg-red-950/40 border border-red-800/60 text-xs font-semibold text-cyber-danger hover:bg-red-900 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isClearing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{isClearing ? "Clearing..." : "Confirm Clear"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Workspace Wrapper */}
      <div className="flex h-full rounded-2xl border border-cyber-border overflow-hidden bg-slate-950/80 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        
        {/* SIDEBAR (ChatGPT Style) */}
        <div className="w-64 bg-slate-950 border-r border-cyber-border flex flex-col justify-between p-3 shrink-0 hidden md:flex">
          <div className="space-y-4">
            
            {/* New Chat Button */}
            <button
              onClick={handleNewSession}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-dashed border-cyber-border hover:border-cyber-primary hover:bg-slate-900 transition-all text-xs font-semibold font-mono text-gray-300 hover:text-white cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-cyber-primary group-hover:scale-110 transition-transform" />
                New Chat
              </span>
              <kbd className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded border border-cyber-border/40 font-sans text-gray-500">Ctrl + K</kbd>
            </button>

            {/* Chat History List */}
            <div className="space-y-2 flex-grow overflow-y-auto max-h-[35vh] scrollbar-thin">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 font-mono px-2 block border-b border-cyber-border/30 pb-1">Chat History</span>
              <div className="space-y-1 pt-1">
                {sessionList.length > 0 ? (
                  sessionList.map((session) => {
                    const isActive = activeSessionId === session.id;
                    const isDeleting = isClearingSingle === session.id;
                    return (
                      <div
                        key={session.id}
                        className={`group w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                          isActive
                            ? "bg-cyber-primary/10 text-cyber-primary border-cyber-primary/25"
                            : "text-gray-400 hover:text-white hover:bg-slate-900 border-transparent"
                        }`}
                      >
                        <button
                          onClick={() => setActiveSessionId(session.id)}
                          className="flex items-center gap-2 text-left truncate flex-grow cursor-pointer"
                          title={session.title}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate pr-1">{session.title}</span>
                        </button>
                        <button
                          onClick={() => executeDeleteSession(session.id)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 rounded transition-all cursor-pointer disabled:opacity-50"
                          title="Delete Conversation"
                        >
                          {isDeleting ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-500" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-gray-600 font-mono px-2 py-1">No past sessions.</div>
                )}
              </div>
            </div>

            {/* Recent list */}
            <div className="space-y-2 shrink-0">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 font-mono px-2">Recent Audits</span>
              <div className="space-y-1">
                {recentChats.length > 0 ? (
                  recentChats.map((domain, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(`Analyze security configurations for ${domain}`)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-white hover:bg-slate-900 transition-all text-left truncate"
                      title={domain}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-cyber-primary/70 shrink-0" />
                      <span className="truncate">{domain}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-[10px] text-gray-600 font-mono px-2 py-1">No scanned hosts yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Footer Link */}
          <div className="border-t border-cyber-border/40 pt-3 space-y-1.5">
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-gray-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all"
            >
              <Compass className="h-4 w-4 text-gray-500" />
              <span>Back to Control Panel</span>
            </Link>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-all text-left cursor-pointer"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span>Clear All Chats</span>
            </button>
          </div>
        </div>

        {/* MAIN CONVERSATION PANE */}
        <div className="flex-grow flex flex-col justify-between h-full bg-slate-950/40 relative">
          
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-cyber-border">
            <span className="font-extrabold text-sm tracking-wider">
              AEGIS<span className="text-cyber-primary">.AI</span>
            </span>
            <button 
              onClick={handleNewSession}
              className="p-1 rounded hover:bg-slate-900 border border-cyber-border text-xs flex items-center gap-1.5 px-2.5 py-1 text-gray-300 font-mono cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-cyber-primary" /> New
            </button>
          </div>

          {/* Messages Viewport */}
          <div className="flex-grow overflow-y-auto px-4 md:px-8 pb-32 pt-6 space-y-6 scrollbar-thin">
            
            {isFreshChat ? (
              /* Centered Logo/Branding on Start */
              <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto space-y-10 pt-8">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-cyber-primary/10 border border-cyber-primary flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.25)]">
                    <Shield className="h-8 w-8 text-cyber-primary animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight">How can I secure your systems today?</h2>
                  <p className="text-xs font-mono text-gray-400 max-w-md leading-relaxed">
                    Aegis is connected to your local database diagnostics and NVD vulnerability databases. Select a prompt or query custom directives.
                  </p>
                </div>

                {/* Suggestions Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {cards.map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(card.query)}
                      disabled={loading}
                      className="p-4 rounded-xl border border-cyber-border bg-slate-900/40 hover:border-cyber-primary hover:bg-slate-900 text-left transition-all cursor-pointer group space-y-1 shadow-md hover:scale-[1.01]"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-200 group-hover:text-cyber-primary transition-all">{card.title}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{card.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation Messages List */
              <div className="max-w-3xl mx-auto space-y-6">
                {displayMessages.map((msg, index) => {
                  const isAI = msg.sender === "ai";
                  const parsed = parseMessageText(msg.text);
                  
                  return (
                    <div 
                      key={index}
                      className={`flex gap-4 p-4 rounded-xl border ${
                        isAI 
                          ? "bg-slate-900/60 border-cyber-border/40" 
                          : "bg-cyber-indigo/10 border-cyber-indigo/25 ml-6"
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isAI 
                          ? "bg-cyber-primary/10 border-cyber-primary/30 text-cyber-primary" 
                          : "bg-cyber-indigo/20 border-cyber-indigo/40 text-cyber-indigo"
                      }`}>
                        {isAI ? <Cpu className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                      </div>

                      {/* Content */}
                      <div className="space-y-2.5 w-full overflow-hidden">
                        <span className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                          {isAI ? "Aegis AI Core" : "Security Operator"}
                        </span>
                        
                        {/* Collapsible thought/reasoning block for AI */}
                        {isAI && parsed.thought && (
                          <details className="group border border-cyber-border/40 rounded-lg overflow-hidden bg-slate-950/40">
                            <summary className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-gray-400 hover:text-cyber-primary cursor-pointer transition-all select-none list-none group-open:border-b group-open:border-cyber-border/20 font-mono">
                              <Brain className="h-3.5 w-3.5 text-cyber-primary animate-pulse shrink-0" />
                              <span>Aegis Reasoning Process</span>
                              <span className="ml-auto text-[9px] text-gray-500 font-normal transition-transform group-open:rotate-90">▶</span>
                            </summary>
                            <div className="p-3 font-mono text-[10px] text-gray-400 border-l-2 border-cyber-primary/40 bg-slate-950/20 leading-relaxed whitespace-pre-wrap select-text">
                              {parsed.thought}
                            </div>
                          </details>
                        )}
                        
                        <p className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                          {parsed.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {loading && (
              <div className="max-w-3xl mx-auto ml-0 sm:ml-6 flex items-center space-x-2.5 text-xs text-cyber-primary font-mono bg-slate-900/60 border border-cyber-border rounded-lg w-max px-4 py-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Aegis is generating response...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Floating Input Pill Bar (ChatGPT Style) */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-8 pb-4 px-4 md:px-8">
            <div className="max-w-3xl mx-auto space-y-2">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(input);
                }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message Aegis AI Core..."
                  disabled={loading}
                  className="w-full pl-4 pr-12 py-3 bg-slate-900 border border-cyber-border focus:border-cyber-primary rounded-xl text-white placeholder-gray-500 focus:outline-none text-sm font-mono transition-all shadow-lg"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2.5 p-1.5 bg-cyber-primary hover:bg-cyan-400 text-black rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:bg-gray-800 disabled:text-gray-500 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
                  title="Send Message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              
              <p className="text-[10px] text-center text-gray-500 font-mono">
                Aegis AI Core can make mistakes. Verify critical vulnerability hashes and server configuration outputs.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
