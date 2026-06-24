// content.js - Aegis Input Security Observer

document.addEventListener("focusin", (e) => {
  if (e.target && e.target.type === "password") {
    checkPasswordSafety();
  }
});

function checkPasswordSafety() {
  const isHttp = window.location.protocol === "http:";
  const currentUrl = window.location.href;

  if (isHttp) {
    injectWarningBanner("Unencrypted Connection (HTTP) - Anyone on this local network can capture your typed credentials!");
    return;
  }

  // Retrieve scanning evaluations from local cache storage
  const cacheKey = `scan_${currentUrl}`;
  chrome.storage.sync.get([cacheKey], (res) => {
    const scanData = res[cacheKey];
    if (scanData && (scanData.risk === "HIGH" || scanData.risk === "CRITICAL")) {
      const threatMessage = `This domain is evaluated as ${scanData.risk} Risk (${scanData.score}/100 Score). Threat: ${scanData.issues[0] || 'Unknown issue'}`;
      injectWarningBanner(threatMessage);
    }
  });
}

function injectWarningBanner(message) {
  // Prevent duplicate injections
  if (document.getElementById("aegis-security-banner")) return;

  const banner = document.createElement("div");
  banner.id = "aegis-security-banner";
  
  // Apply premium warning styles directly to override page layouts
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    backgroundColor: "#7f1d1d", // Deep Alert Red
    color: "#fecaca",
    padding: "12px 20px",
    fontSize: "11px",
    fontFamily: "monospace",
    zIndex: "999999",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    borderBottom: "3px solid #ef4444",
    boxSizing: "border-box"
  });

  const textContainer = document.createElement("span");
  textContainer.innerHTML = `⚠️ <strong style="color: #fff; text-transform: uppercase;">Aegis Shield Alert:</strong> ${message}`;
  
  const dismissBtn = document.createElement("button");
  dismissBtn.innerText = "DISMISS WARNING";
  Object.assign(dismissBtn.style, {
    backgroundColor: "transparent",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "9px",
    fontWeight: "bold",
    borderRadius: "4px",
    fontFamily: "monospace"
  });
  
  dismissBtn.addEventListener("mouseover", () => {
    dismissBtn.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    dismissBtn.style.color = "#fff";
  });
  
  dismissBtn.addEventListener("mouseout", () => {
    dismissBtn.style.backgroundColor = "transparent";
    dismissBtn.style.color = "#fca5a5";
  });

  dismissBtn.addEventListener("click", () => {
    banner.remove();
  });

  banner.appendChild(textContainer);
  banner.appendChild(dismissBtn);
  
  // Inject at the very top of body
  document.body.appendChild(banner);
}
