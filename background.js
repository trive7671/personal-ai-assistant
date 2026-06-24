const API_BASE = "https://aegis-backend-fy02.onrender.com"; // Change to http://localhost:8000 for local testing

// Background Service Worker for Aegis AI Website Scanner

// Listen for tab activation changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      handleUrlChange(tab.url, tab.id);
    }
  });
});

// Listen for URL updates in tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    handleUrlChange(tab.url, tabId);
  }
});

// --- ALERT SSE CLIENT ---
let alertEventSource = null;
function initAlertStream(token) {
  // Close previous connection if any
  if (alertEventSource) alertEventSource.close();
  // Use token as query param (backend should accept for auth)
  const url = `${API_BASE}/api/alerts/stream?token=${token}`;
  alertEventSource = new EventSource(url);
  alertEventSource.onmessage = (event) => {
    // Forward alert message to popup UI
    chrome.runtime.sendMessage({ type: "alert", payload: event.data });
  };
  alertEventSource.onerror = (err) => {
    console.error("[Aegis Background] Alert SSE error", err);
    // Attempt reconnection after delay
    setTimeout(() => initAlertStream(token), 5000);
  };
}

// Cleanup on extension unload
chrome.runtime.onSuspend.addListener(() => {
  if (alertEventSource) alertEventSource.close();
});

// --- URL SECURITY SCANNER ROUTER ---

// Primary routine to handle active tab changes
async function handleUrlChange(url, tabId) {
  // Exclude system pages, blank pages, and extension resource pages
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    clearBadge(tabId);
    return;
  }

  // Retrieve JWT authorization token from storage
  chrome.storage.sync.get(["aegis_token"], async (store) => {
    const token = store.aegis_token;
    if (!token) {
      console.log("[Aegis Background] No operator token registered.");
      return;
    }
    // Initialize alert SSE stream
    initAlertStream(token);

    try {
      console.log(`[Aegis Background] Auditing domain: ${url}`);
      const response = await fetch(`${API_BASE}/api/scanner/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ url: url })
      });

      if (!response.ok) {
        throw new Error(`Scan request error: ${response.status}`);
      }

      const scanResult = await response.json();
      console.log("[Aegis Background] Scan success:", scanResult);

      // Cache scan result locally mapping to URL for popup instant load
      const cacheObj = {};
      cacheObj[`scan_${url}`] = scanResult;
      chrome.storage.sync.set(cacheObj);

      // Render Badge parameters
      updateBadge(tabId, scanResult.score, scanResult.risk);

      // Send desktop alerts for dangerous domains
      if (scanResult.risk === "HIGH" || scanResult.risk === "CRITICAL") {
        const alertMsg = scanResult.issues.length > 0 
          ? `Threat indicators: ${scanResult.issues[0]} (and ${scanResult.issues.length - 1} more issues)` 
          : "Highly insecure URL characteristics flagged.";
        
        chrome.notifications.create(`aegis_alert_${Date.now()}`, {
          type: "basic",
          iconUrl: "icon.png",
          title: `⚠️ Aegis Warning: ${scanResult.risk} Risk Site`,
          message: `${url}\nScore: ${scanResult.score}/100\n${alertMsg}`,
          priority: 2
        });
      }

    } catch (err) {
      console.error("[Aegis Background] Passive scanner error:", err);
    }
  });
}

function updateBadge(tabId, score, risk) {
  let badgeColor = "#64748b"; // Low risk fallback
  if (risk === "LOW") {
    badgeColor = "#10b981"; // Green
  } else if (risk === "MEDIUM") {
    badgeColor = "#f97316"; // Orange
  } else {
    badgeColor = "#ef4444"; // Red for High/Critical
  }

  chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: tabId });
  chrome.action.setBadgeText({ text: score.toString(), tabId: tabId });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ text: "", tabId: tabId });
}
