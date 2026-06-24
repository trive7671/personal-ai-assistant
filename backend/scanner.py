import socket
import ssl
import urllib.parse
import re
from datetime import datetime
from typing import Dict, Any, List, Tuple
import httpx

# List of suspicious keywords frequently used in phishing campaigns
SUSPICIOUS_KEYWORDS = [
    "login", "signin", "verification", "verify", "secure", "update", "account",
    "banking", "support", "billing", "confirm", "free", "gift", "paypal", "netflix",
    "amazon", "microsoft", "google", "apple", "wallet", "crypto", "token", "claim",
    "suspend", "restore", "unlock", "alert", "urgent", "click", "prize", "winner",
    "refund", "redirect", "resolve", "recovery", "validate"
]

# Malware / C2 indicator keywords — heavy-weight threat signals in domain/path
MALWARE_INDICATORS = [
    "malware", "ransomware", "payload", "exploit", "dropper", "downloader",
    "botnet", "zombie", "c2", "command-and-control", "beacon", "bot",
    "rootkit", "keylogger", "spyware", "stealer", "credential", "trojan",
    "worm", "cryptominer", "miner", "shell", "backdoor", "inject",
    "exfil", "harvest", "capture", "steal", "phish", "phishing-kit",
    "deploy", "propagat", "recruit", "amplif", "ddos", "attack"
]

# Known URL shortener domains — often used to hide malicious final destinations
URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "adf.ly", "short.link", "rebrand.ly", "cutt.ly",
    "cli.re", "su.pr", "tiny.cc", "lnkd.in", "rb.gy", "clck.ru",
    "shorturl.at", "bl.ink", "tiny.one", "soo.gd", "s2r.co"
}

# High-risk TLDs commonly abused by threat actors (free/anonymous registration)
HIGH_RISK_TLDS = {
    ".tk", ".ml", ".cf", ".gq", ".ga",   # Freenom free TLDs
    ".xyz", ".top", ".buzz", ".click",     # Cheap/bulk-registered
    ".info", ".cc", ".ru", ".cn", ".io",   # Commonly abused
    ".live", ".monster", ".icu", ".fit",   # New gTLDs abused for phishing
    ".pw", ".ws", ".su", ".to", ".biz",
    ".support", ".services", ".network", ".solutions"
}

# Legitimate brands that are commonly typosquatted / impersonated
LEGITIMATE_BRANDS = [
    "paypal", "amazon", "google", "microsoft", "apple", "facebook", "twitter",
    "instagram", "netflix", "linkedin", "whatsapp", "dropbox", "gmail",
    "youtube", "spotify", "ebay", "walmart", "wellsfargo", "chase", "citibank"
]

# Suspicious file extensions that suggest malware delivery
SUSPICIOUS_EXTENSIONS = [
    ".exe", ".msi", ".bat", ".cmd", ".vbs", ".ps1", ".dll", ".scr",
    ".jar", ".hta", ".pif", ".com", ".sys", ".reg", ".lnk",
    ".docm", ".xlsm", ".pptm",  # Macro-enabled Office documents
    ".iso", ".img", ".vhd",     # Disk image delivery vectors
]

# Mock PhishTank database of flagged phishing URLs
MOCK_PHISHTANK_DATABASE = [
    "http://secure-bank-login.net",
    "http://g00gle.com",
    "https://paypal-update-billing.support",
    "http://netflix-billing-resolve.com",
    "https://crypto-token-claim.io"
]

# Mock VirusTotal database of malicious domain threat scans
MOCK_VIRUSTOTAL_MALICIOUS = {
    "malware-downloader.xyz": {"positives": 15, "total": 68, "scan_date": "2026-06-23"},
    "credential-stealer.co.uk": {"positives": 24, "total": 68, "scan_date": "2026-06-22"},
    "trojan-sharepoint-docs.info": {"positives": 8, "total": 68, "scan_date": "2026-06-23"}
}

async def query_mock_phishtank(url: str) -> bool:
    """Mock checking PhishTank blocklist database."""
    url_lower = url.lower().strip()
    for bad_url in MOCK_PHISHTANK_DATABASE:
        if bad_url in url_lower:
            return True
    return False

async def query_mock_virustotal(hostname: str) -> Dict[str, Any]:
    """Mock checking VirusTotal domain analysis engine."""
    hostname_clean = hostname.lower().strip()
    if hostname_clean in MOCK_VIRUSTOTAL_MALICIOUS:
        return {
            "flagged": True,
            **MOCK_VIRUSTOTAL_MALICIOUS[hostname_clean]
        }
    return {"flagged": False, "positives": 0, "total": 68}

def _levenshtein(s1: str, s2: str) -> int:
    """Compute the Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]

def check_typosquatting(hostname: str) -> Tuple[bool, str]:
    """Detect typosquatted / lookalike brand domains using Levenshtein distance."""
    # Strip port and www prefix
    clean = re.sub(r'^www\.', '', hostname.lower().split(':')[0])
    # Get the base domain (last two parts before TLD-like segment)
    parts = clean.split('.')
    base = parts[0] if len(parts) >= 1 else clean
    
    for brand in LEGITIMATE_BRANDS:
        if brand == base:
            continue  # Exact match is fine
        dist = _levenshtein(base, brand)
        # Flag if very similar (1-2 edits) but not identical
        if 0 < dist <= 2 and len(base) >= 4:
            return True, brand
    return False, ""

def check_url_shortener(hostname: str) -> bool:
    """Detect known URL shortener services that obscure the true destination."""
    clean = hostname.lower().split(':')[0]
    return clean in URL_SHORTENERS

def check_high_risk_tld(hostname: str) -> Tuple[bool, str]:
    """Detect high-risk top-level domains frequently abused in phishing campaigns."""
    clean = hostname.lower().split(':')[0]
    for tld in HIGH_RISK_TLDS:
        if clean.endswith(tld):
            return True, tld
    return False, ""

def check_suspicious_extension(path: str) -> Tuple[bool, str]:
    """Detect URLs that directly serve suspicious executable or macro file types."""
    path_lower = path.lower().split('?')[0]  # Remove query string
    for ext in SUSPICIOUS_EXTENSIONS:
        if path_lower.endswith(ext):
            return True, ext
    return False, ""

def check_public_ip_host(hostname: str) -> bool:
    """Detect routable public IP addresses used as hostnames (non-private ranges)."""
    host = hostname.split(':')[0]
    try:
        packed = socket.inet_aton(host)
        # Check for private/loopback ranges
        octets = [int(x) for x in host.split('.')]
        is_private = (
            octets[0] == 10 or
            (octets[0] == 172 and 16 <= octets[1] <= 31) or
            (octets[0] == 192 and octets[1] == 168) or
            octets[0] == 127 or
            octets[0] == 0
        )
        return not is_private  # Public routable IP = suspicious
    except socket.error:
        return False

def parse_url(url: str) -> str:
    """Normalize and clean URL for scanning."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url

def check_ssl_certificate(hostname: str, port: int = 443) -> Tuple[bool, Dict[str, Any]]:
    """Inspect the SSL/TLS certificate of the host, returning validity and metadata."""
    context = ssl.create_default_context()
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    
    cert_info = {}
    try:
        # Resolve hostname first to ensure it exists
        socket.gethostbyname(hostname)
        
        with socket.create_connection((hostname, port), timeout=3.0) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                
                # Extract expiry dates
                not_before = cert.get("notBefore")
                not_after = cert.get("notAfter")
                issuer = dict(x[0] for x in cert.get("issuer", []))
                subject = dict(x[0] for x in cert.get("subject", []))
                
                cert_info = {
                    "valid": True,
                    "issuer": issuer.get("organizationName", "Unknown"),
                    "subject": subject.get("commonName", hostname),
                    "expiry": not_after,
                    "version": ssock.version()
                }
                return True, cert_info
    except Exception as e:
        return False, {"valid": False, "error": str(e)}

async def analyze_redirects_and_headers(url: str) -> Tuple[int, List[str], Dict[str, str]]:
    """Follow redirects and analyze response status and headers."""
    redirect_count = 0
    redirect_chain = []
    headers_info = {}
    
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=False) as client:
            current_url = url
            for _ in range(5):  # Limit to 5 hops max
                response = await client.get(current_url)
                if response.status_code in (301, 302, 303, 307, 308):
                    redirect_count += 1
                    location = response.headers.get("location", "")
                    if not location:
                        break
                    # Handle relative redirects
                    current_url = urllib.parse.urljoin(current_url, location)
                    redirect_chain.append(current_url)
                else:
                    headers_info = {
                        "server": response.headers.get("server", "Unknown"),
                        "x-frame-options": response.headers.get("x-frame-options", "Missing"),
                        "content-security-policy": response.headers.get("content-security-policy", "Missing"),
                        "strict-transport-security": response.headers.get("strict-transport-security", "Missing")
                    }
                    break
    except Exception:
        # Fallback if connection fails during redirect trace
        pass
        
    return redirect_count, redirect_chain, headers_info

async def scan_url(url: str) -> Dict[str, Any]:
    """Perform security scanning checks on the target URL."""
    normalized_url = parse_url(url)
    parsed = urllib.parse.urlparse(normalized_url)
    hostname = parsed.netloc
    path = parsed.path
    
    issues = []
    score = 100
    
    # 1. Check Schema (HTTPS availability)
    is_https = parsed.scheme == "https"
    if not is_https:
        score -= 40  # Raised from 30 — HTTP is a strong risk signal for malicious domains
        issues.append("Missing HTTPS — Unencrypted connection (high risk for credential theft)")
        ssl_valid = False
        ssl_info = {"valid": False, "error": "Unencrypted HTTP schema"}
    else:
        # 2. Inspect SSL Certificate
        ssl_valid, ssl_info = check_ssl_certificate(hostname)
        if not ssl_valid:
            score -= 20
            issues.append(f"SSL/TLS issues: {ssl_info.get('error', 'Invalid certificate')}")
            
    # 3. Analyze redirect paths
    redirect_count, redirect_chain, headers = await analyze_redirects_and_headers(normalized_url)
    if redirect_count > 2:
        score -= 15
        issues.append(f"Multiple redirects detected ({redirect_count} hops) - Possible phishing gateway redirection")
        
    # 4a. Check for phishing keywords in domain or path
    found_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in hostname.lower() or kw in path.lower()]
    if found_keywords:
        deduction = min(len(found_keywords) * 15, 45)
        score -= deduction
        issues.append(f"Suspicious keyword(s) matching known phishing templates: {', '.join(found_keywords[:5])}")

    # 4b. Check for malware / C2 indicator keywords — separate heavier penalty
    full_url_lower = (hostname + path).lower()
    found_malware_kw = [kw for kw in MALWARE_INDICATORS if kw in full_url_lower]
    if found_malware_kw:
        deduction = min(len(found_malware_kw) * 20, 60)
        score -= deduction
        issues.append(f"Malware/C2 indicator term(s) detected in URL: {', '.join(found_malware_kw[:4])} — High-confidence threat signal")
        
    # 5. Check URL Phishing indicators
    # Check IP as hostname (check private vs public separately)
    is_ip = False
    try:
        socket.inet_aton(hostname.split(":")[0])
        is_ip = True
    except socket.error:
        pass
        
    if is_ip:
        if check_public_ip_host(hostname):
            # Public routable IP as hostname — higher risk (C2 servers, malware hosts)
            score -= 40
            issues.append("Public IP address used as hostname (Strongly indicative of C2/malware hosting)")
        else:
            # Private/localhost IP — could be local network attack attempt
            score -= 30
            issues.append("Private/local IP address used as hostname (Suspicious network targeting)")

    # NEW: Check for URL shortener services (hide malicious final destination)
    if check_url_shortener(hostname):
        score -= 30
        issues.append(f"URL shortener service detected ({hostname}) — Final destination is concealed")

    # NEW: Check for high-risk TLDs frequently abused in phishing/malware campaigns
    tld_flagged, matched_tld = check_high_risk_tld(hostname)
    if tld_flagged:
        score -= 20
        issues.append(f"High-risk TLD detected ({matched_tld}) — Commonly abused in phishing campaigns")

    # NEW: Check for typosquatting / lookalike brand domains
    is_typosquat, matched_brand = check_typosquatting(hostname)
    if is_typosquat:
        score -= 30
        issues.append(f"Typosquatting detected — domain closely resembles '{matched_brand}' (likely brand impersonation)")

    # NEW: Check for suspicious file extensions (malware delivery vectors)
    ext_flagged, matched_ext = check_suspicious_extension(path)
    if ext_flagged:
        score -= 30
        issues.append(f"Suspicious file extension in URL path ({matched_ext}) — Possible malware/exploit delivery")
        
    # Check excessive subdomains
    domain_parts = hostname.split(".")
    if "www" in domain_parts:
        domain_parts.remove("www")
    if len(domain_parts) > 3:
        score -= 15
        issues.append(f"Excessive subdomains detected ({len(domain_parts) - 1} levels) — Risk of subdomain spoofing")
        
    # Check for '@' symbol in URL
    if "@" in normalized_url:
        score -= 25  # Increased from 20 — very strong phishing indicator
        issues.append("Contains '@' symbol — Commonly used to obscure the true target domain")
        
    # Check URL length
    if len(normalized_url) > 90:
        score -= 10
        issues.append("Excessively long URL (Often used to hide suspicious query parameters or extensions)")

    # NEW: Check for multiple dots in domain suggesting deep nesting / deception
    domain_only = hostname.split(':')[0]
    dot_count = domain_only.count('.')
    if dot_count >= 4 and not is_ip:
        score -= 10
        issues.append(f"Domain has {dot_count} dot levels — possible multi-layer spoofing or deception")
        
    # Check security headers
    if headers:
        if headers.get("strict-transport-security") == "Missing" and is_https:
            score -= 5
            issues.append("HTTP Strict Transport Security (HSTS) header is missing")
        if headers.get("x-frame-options") == "Missing":
            score -= 5
            issues.append("X-Frame-Options header is missing (Clickjacking vulnerability risk)")
        if headers.get("content-security-policy") == "Missing":
            score -= 5
            issues.append("Content Security Policy (CSP) header is missing")

    # 6. Check PhishTank Blocklist
    is_in_phishtank = await query_mock_phishtank(normalized_url)
    if is_in_phishtank:
        score -= 45
        issues.append("Flagged in PhishTank phishing database")

    # 7. Check VirusTotal Domain Scan
    vt_result = await query_mock_virustotal(hostname)
    if vt_result["flagged"]:
        score -= 50
        issues.append(f"Flagged by VirusTotal ({vt_result['positives']}/{vt_result['total']} AV engines)")

    # Clamp the final score
    score = max(0, min(score, 100))
    
    # Determine Risk Level
    if score >= 80:
        risk = "LOW"
    elif score >= 60:
        risk = "MEDIUM"
    elif score >= 30:
        risk = "HIGH"
    else:
        risk = "CRITICAL"
        
    return {
        "url": normalized_url,
        "score": score,
        "risk": risk,
        "issues": issues,
        "ssl_info": ssl_info,
        "redirect_count": redirect_count,
        "headers": headers
    }
