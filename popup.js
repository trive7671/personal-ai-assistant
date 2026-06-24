const API_BASE = "https://aegis-backend-fy02.onrender.com"; // Change to http://localhost:8000 for local testing

document.addEventListener("DOMContentLoaded", async () => {
  const authPanel = document.getElementById("auth-panel");
  const navTabs = document.getElementById("nav-tabs");
  
  // Tab panels
  const scanTab = document.getElementById("scan-tab");
  const chatTab = document.getElementById("chat-tab");
  const historyTab = document.getElementById("history-tab");
  
  // Buttons and inputs
  const tokenInput = document.getElementById("token-input");
  const saveTokenBtn = document.getElementById("save-token-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const scanBtn = document.getElementById("scan-btn");
  
  // Scan UI
  const targetUrlDiv = document.getElementById("target-url");
  const resultPanel = document.getElementById("result-panel");
  const loadingPanel = document.getElementById("loading-panel");
  const resultScore = document.getElementById("result-score");
  const resultRiskBadge = document.getElementById("result-risk-badge");
  const resultIssues = document.getElementById("result-issues");
  const scoreRing = document.getElementById("score-ring");

  // Advanced SSL Details Pane UI
  const sslDetailsBox = document.getElementById("ssl-details-box");
  const toggleSslBtn = document.getElementById("toggle-ssl-btn");
  const sslDetailsContent = document.getElementById("ssl-details-content");
  const sslArrow = document.getElementById("ssl-arrow");

  // Advanced PDF Action UI
  const downloadPdfBtn = document.getElementById("download-pdf-btn");

  // Chat UI
  const chatBox = document.getElementById("chat-box");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatSuggestions = document.getElementById("chat-suggestions");

  // History UI
  const historyList = document.getElementById("history-list");

  let currentToken = "";
  let currentUrl = "";
  let currentScanId = null;

  // Active scan variables for contextual chatbot chips
  let lastScannedUrl = "";
  let lastScannedIssues = [];

  // --- INITIAL CHECK ---
  chrome.storage.sync.get(["aegis_token"], async (result) => {
    if (result.aegis_token) {
      currentToken = result.aegis_token;
      showAuthenticatedUI();
      initializeScanner();
    } else {
      const extractedToken = await attemptAutoTokenExtraction();
      if (extractedToken) {
        chrome.storage.sync.set({ aegis_token: extractedToken }, () => {
          currentToken = extractedToken;
          showAuthenticatedUI();
          initializeScanner();
        });
      } else {
        showPanel("auth");
      }
    }
  });

  // --- TAB SWITCHING LOGIC ---
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      
      // Toggle button states
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Toggle panels
      scanTab.classList.remove("active");
      chatTab.classList.remove("active");
      historyTab.classList.remove("active");

      if (targetTab === "scan") {
        scanTab.classList.add("active");
        initializeScanner();
      } else if (targetTab === "chat") {
        chatTab.classList.add("active");
        loadChatHistory();
      } else if (targetTab === "history") {
        historyTab.classList.add("active");
        loadScanHistory();
      }
    });
  });

  // --- SSL COLLAPSIBLE ACCORDION TOGGLE ---
  toggleSslBtn.addEventListener("click", () => {
    const isHidden = sslDetailsContent.classList.contains("hidden");
    if (isHidden) {
      sslDetailsContent.classList.remove("hidden");
      sslArrow.textContent = "▲";
    } else {
      sslDetailsContent.classList.add("hidden");
      sslArrow.textContent = "▼";
    }
  });

  // --- PDF REPORT DOWNLOAD HANDLER ---
  downloadPdfBtn.addEventListener("click", async () => {
    if (!currentScanId) return alert("No active scan report available to download.");
    
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.textContent = "⌛ Generating PDF...";
    
    try {
      const response = await fetch(`${API_BASE}/api/scanner/report/${currentScanId}`, {
        headers: { "Authorization": `Bearer ${currentToken}` }
      });
      
      if (!response.ok) throw new Error("Failed to compile PDF blob");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `aegis_report_${currentScanId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF report. Verify backend connection.");
    } finally {
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.textContent = "📥 Download PDF Report";
    }
  });

  // --- AUTH PANEL HANDLERS ---
  saveTokenBtn.addEventListener("click", () => {
    const val = tokenInput.value.trim();
    if (!val) return alert("Please enter a valid authentication token.");
    chrome.storage.sync.set({ aegis_token: val }, () => {
      currentToken = val;
      showAuthenticatedUI();
      initializeScanner();
    });
  });

  logoutBtn.addEventListener("click", () => {
    chrome.storage.sync.remove(["aegis_token"], () => {
      currentToken = "";
      tokenInput.value = "";
      currentScanId = null;
      lastScannedUrl = "";
      lastScannedIssues = [];
      showPanel("auth");
      resultPanel.classList.add("hidden");
    });
  });

  // --- SCAN HANDLERS ---
  scanBtn.addEventListener("click", async () => {
    if (!currentUrl) return alert("No active tab URL detected.");
    
    showLoader(true, "Launching diagnostic scans...");
    resultPanel.classList.add("hidden");

    try {
      const response = await fetch(`${API_BASE}/api/scanner/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({ url: currentUrl })
      });

      if (response.status === 401) {
        showLoader(false);
        alert("Session token is invalid or expired. Please re-authenticate.");
        logoutBtn.click();
        return;
      }

      if (!response.ok) {
        throw new Error("HTTP scan execution failure");
      }

      const data = await response.json();
      showLoader(false);
      renderResults(data);

      // Cache scan result locally mapping to URL
      const cacheObj = {};
      cacheObj[`scan_${currentUrl}`] = data;
      chrome.storage.sync.set(cacheObj);

    } catch (err) {
      console.error(err);
      showLoader(false);
      alert(`Scan failed. Verify the Aegis backend server is running at ${API_BASE}`);
    }
  });

  // --- CHAT HANDLERS ---
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    executeChatQuery(message);
  });

  async function executeChatQuery(message) {
    appendChatMessage("user", message);
    chatInput.value = "";
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    // Show temporary typing indicator
    const typingIndicator = appendChatMessage("ai", "Aegis is preparing query response...");

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({ message: message })
      });

      typingIndicator.remove();

      if (response.status === 401) {
        alert("Session expired. Please log in again.");
        logoutBtn.click();
        return;
      }

      if (!response.ok) throw new Error("Chat completions error");

      const data = await response.json();
      appendChatMessage("ai", data.response);
    } catch (err) {
      console.error(err);
      typingIndicator.remove();
      appendChatMessage("ai", "Error connecting to AI operator. Verify your backend server is active.");
    } finally {
      chatInput.disabled = false;
      chatSendBtn.disabled = false;
      chatInput.focus();
    }
  }

  // --- ROUTINE UI HELPERS ---

  function showPanel(panel) {
    if (panel === "auth") {
      authPanel.classList.remove("hidden");
      navTabs.classList.add("hidden");
      scanTab.classList.remove("active");
      chatTab.classList.remove("active");
      historyTab.classList.remove("active");
    } else {
      authPanel.classList.add("hidden");
      navTabs.classList.remove("hidden");
      scanTab.classList.add("active");
      chatTab.classList.remove("active");
      historyTab.classList.remove("active");
    }
  }

  function showAuthenticatedUI() {
    showPanel("scan");
    tabButtons.forEach(b => b.classList.remove("active"));
    document.getElementById("tab-btn-scan").classList.add("active");
  }

  function showLoader(show, msg = "") {
    if (show) {
      loadingPanel.classList.remove("hidden");
      document.getElementById("loader-msg").textContent = msg;
      scanBtn.disabled = true;
    } else {
      loadingPanel.classList.add("hidden");
      scanBtn.disabled = false;
    }
  }

  function initializeScanner() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const url = tabs[0].url;
        if (url.startsWith("http://") || url.startsWith("https://")) {
          currentUrl = url;
          targetUrlDiv.textContent = url;
          scanBtn.disabled = false;

          // Attempt loading cached result from background scan
          chrome.storage.sync.get([`scan_${url}`], (res) => {
            if (res[`scan_${url}`]) {
              renderResults(res[`scan_${url}`]);
            } else {
              resultPanel.classList.add("hidden");
            }
          });
        } else {
          currentUrl = "";
          targetUrlDiv.textContent = "Extension scanner is inactive on system pages.";
          scanBtn.disabled = true;
          resultPanel.classList.add("hidden");
        }
      }
    });
  }

  async function attemptAutoTokenExtraction() {
    return new Promise((resolve) => {
      chrome.tabs.query({ url: "*://localhost:5173/*" }, (tabs) => {
        if (!tabs || tabs.length === 0) return resolve(null);
        
        const targetTab = tabs[0];
        chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: () => localStorage.getItem("aegis_token")
        }, (results) => {
          if (chrome.runtime.lastError || !results || !results[0]) {
            return resolve(null);
          }
          resolve(results[0].result);
        });
      });
    });
  }

  function renderResults(data) {
    resultPanel.classList.remove("hidden");
    resultScore.textContent = data.score;
    
    // Save scanner state parameters for context chips
    currentScanId = data.id || null;
    lastScannedUrl = data.url || "";
    lastScannedIssues = data.issues || [];

    if (data.score >= 80) {
      scoreRing.style.borderColor = "#10b981";
    } else if (data.score >= 60) {
      scoreRing.style.borderColor = "#f97316";
    } else {
      scoreRing.style.borderColor = "#ef4444";
    }

    resultRiskBadge.className = "badge";
    resultRiskBadge.textContent = `${data.risk} RISK`;
    resultRiskBadge.classList.add(`badge-${data.risk.toLowerCase()}`);

    // Set Certificate details pane if SSL certificate info was successfully gathered
    if (data.ssl_info && data.ssl_info.valid) {
      sslDetailsBox.classList.remove("hidden");
      sslDetailsContent.innerHTML = `
        <div><b>CN:</b> ${data.ssl_info.subject}</div>
        <div><b>Issuer:</b> ${data.ssl_info.issuer}</div>
        <div><b>Expires:</b> ${data.ssl_info.expiry}</div>
        <div><b>Handshake:</b> ${data.ssl_info.version}</div>
      `;
    } else {
      sslDetailsBox.classList.add("hidden");
      sslDetailsContent.innerHTML = "";
    }

    // Set PDF report button
    if (currentScanId) {
      downloadPdfBtn.style.display = "block";
    } else {
      downloadPdfBtn.style.display = "none";
    }

    resultIssues.innerHTML = "";
    if (data.issues.length === 0) {
      resultIssues.innerHTML = `<div style="color: #10b981; font-size: 11px;">✓ No critical threats detected.</div>`;
    } else {
      data.issues.forEach(issue => {
        const item = document.createElement("div");
        item.className = "issue-item";
        item.innerHTML = `<span>⚠</span> <span>${issue}</span>`;
        resultIssues.appendChild(item);
      });
    }
  }

  // --- CHAT LOGIC ---

  async function loadChatHistory() {
    chatBox.innerHTML = `<div style="font-size: 10px; font-family: monospace; color: #64748b; text-align: center; padding: 12px;">Loading conversations...</div>`;
    renderContextSuggestions();
    
    try {
      const response = await fetch(`${API_BASE}/api/ai/chat/history`, {
        headers: { "Authorization": `Bearer ${currentToken}` }
      });
      
      if (!response.ok) throw new Error();
      
      const data = await response.json();
      chatBox.innerHTML = "";

      if (data.length === 0) {
        appendChatMessage("ai", "Affirmative, Operator. I am Aegis, your AI Cybersecurity Assistant. Ask me to scan a URL, explain vulnerability mechanics, or advice on server hardening policies.");
      } else {
        data.forEach(msg => {
          appendChatMessage(msg.sender, msg.text);
        });
      }
    } catch (err) {
      chatBox.innerHTML = `<div style="font-size: 10px; font-family: monospace; color: #ef4444; text-align: center; padding: 12px;">Failed to synchronize chat logs.</div>`;
    }
  }

  function appendChatMessage(sender, text) {
    const bubble = document.createElement("div");
    bubble.className = `msg msg-${sender}`;
    bubble.textContent = text;
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
  }

  function renderContextSuggestions() {
    chatSuggestions.innerHTML = "";
    
    // Add default general suggestions
    let suggestionsList = ["Explain SQL Injection", "Harden Web Server"];
    
    // Dynamically build suggestions targeting the last scanned URL threats
    if (lastScannedUrl && lastScannedIssues.length > 0) {
      const domainName = lastScannedUrl.replace(/^https?:\/\//, "").split("/")[0];
      // Limit to 2 contextual questions
      lastScannedIssues.slice(0, 2).forEach(issue => {
        if (issue.includes("HTTPS") || issue.includes("SSL")) {
          suggestionsList.unshift(`Fix SSL certificates on ${domainName}`);
        } else if (issue.includes("PhishTank") || issue.includes("VirusTotal")) {
          suggestionsList.unshift(`Why was ${domainName} flagged as suspicious?`);
        } else if (issue.includes("X-Frame-Options") || issue.includes("Clickjacking")) {
          suggestionsList.unshift(`Explain Clickjacking patch for ${domainName}`);
        } else {
          suggestionsList.unshift(`How to address: "${issue}"`);
        }
      });
    }

    // Slice to maximum 3 suggestion chips
    suggestionsList.slice(0, 3).forEach(text => {
      const chip = document.createElement("button");
      chip.textContent = text;
      Object.assign(chip.style, {
        background: "#0b0f19",
        border: "1px solid #1e293b",
        borderRadius: "4px",
        color: "#94a3b8",
        padding: "3px 6px",
        fontSize: "8px",
        fontFamily: "monospace",
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "150px"
      });

      chip.addEventListener("click", () => {
        executeChatQuery(text);
      });
      
      chip.addEventListener("mouseover", () => {
        chip.style.borderColor = "#00f0ff";
        chip.style.color = "#fff";
      });
      
      chip.addEventListener("mouseout", () => {
        chip.style.borderColor = "#1e293b";
        chip.style.color = "#94a3b8";
      });

      chatSuggestions.appendChild(chip);
    });
  }

  // --- HISTORY LOGIC ---

  async function loadScanHistory() {
    historyList.innerHTML = `<div style="font-size: 10px; font-family: monospace; color: #64748b; text-align: center; padding: 12px;">Retrieving history...</div>`;
    try {
      const response = await fetch(`${API_BASE}/api/scanner/history`, {
        headers: { "Authorization": `Bearer ${currentToken}` }
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      historyList.innerHTML = "";

      if (data.length === 0) {
        historyList.innerHTML = `<div style="font-size: 10px; font-family: monospace; color: #64748b; text-align: center; padding: 12px;">No scan history found.</div>`;
      } else {
        const recentScans = data.slice(0, 5);
        recentScans.forEach(scan => {
          const item = document.createElement("div");
          item.className = "hist-item";
          
          let cleanUrl = scan.url;
          cleanUrl = cleanUrl.replace(/^https?:\/\//, "");

          item.innerHTML = `
            <span class="hist-url" title="${scan.url}">${cleanUrl}</span>
            <div>
              <span class="hist-score" style="color: ${getScoreColor(scan.score)}">${scan.score}</span>
              <span class="badge badge-${scan.risk.toLowerCase()}" style="font-size: 8px; padding: 1px 4px;">${scan.risk}</span>
            </div>
          `;
          historyList.appendChild(item);
        });
      }
    } catch (err) {
      historyList.innerHTML = `<div style="font-size: 10px; font-family: monospace; color: #ef4444; text-align: center; padding: 12px;">Failed to load audit logs.</div>`;
    }
  }

  function getScoreColor(score) {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f97316";
    return "#ef4444";
  }

});

// ---------- ALERT UI ----------
function showAlert(message, risk) {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.minWidth = '200px';
  toast.style.padding = '12px 16px';
  toast.style.background = 'rgba(30, 41, 59, 0.9)';
  toast.style.backdropFilter = 'blur(8px)';
  toast.style.color = '#fff';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  toast.style.zIndex = '9999';
  toast.style.transition = 'opacity 0.4s ease';
  toast.textContent = risk ? `[${risk}] ${message}` : message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 5000);
  setTimeout(() => { toast.remove(); }, 5600);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'alert') {
    let payload = msg.payload;
    try { payload = JSON.parse(msg.payload); } catch (e) {}
    const message = typeof payload === 'object' && payload.message ? payload.message : payload;
    const risk = typeof payload === 'object' && payload.risk ? payload.risk : '';
    showAlert(message, risk);
  }
});
