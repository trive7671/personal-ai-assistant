"""
Email Alert Service — sends HTML email notifications when HIGH/CRITICAL threats are detected.
Uses Gmail SMTP with app password. Configure EMAIL_USER and EMAIL_PASS in .env
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASS = os.getenv("EMAIL_PASS", "")
EMAIL_FROM_NAME = "Aegis AI Security"


def send_alert_email(to_email: str, url: str, risk: str, score: int, issues: list):
    """Send an HTML threat alert email to the registered user."""
    if not EMAIL_USER or not EMAIL_PASS or not to_email:
        print(f"[Email] Skipped — EMAIL_USER/EMAIL_PASS not configured or no recipient.")
        return

    risk_color = {
        "HIGH": "#f97316",
        "CRITICAL": "#ef4444",
        "MEDIUM": "#eab308",
        "LOW": "#10b981"
    }.get(risk, "#94a3b8")

    issues_html = "".join(
        f'<li style="margin-bottom:6px; color:#f3f4f6;">⚠ {issue}</li>'
        for issue in (issues or [])
    ) or '<li style="color:#10b981;">No specific issues detected.</li>'

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#030712;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#0b0f19;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#00f0ff15,#6366f115);padding:32px;text-align:center;border-bottom:1px solid #1e293b;">
          <div style="font-size:36px;margin-bottom:8px;">🛡️</div>
          <h1 style="margin:0;color:#00f0ff;font-size:24px;letter-spacing:2px;">AEGIS AI</h1>
          <p style="margin:4px 0 0;color:#64748b;font-size:12px;letter-spacing:1px;">SECURITY ALERT</p>
        </div>
        <!-- Body -->
        <div style="padding:32px;">
          <div style="background:#0f172a;border:1px solid {risk_color}40;border-left:4px solid {risk_color};border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Risk Level Detected</p>
            <p style="margin:6px 0 0;color:{risk_color};font-size:28px;font-weight:800;">{risk}</p>
          </div>

          <h2 style="color:#f3f4f6;font-size:16px;margin-bottom:8px;">Target URL</h2>
          <p style="background:#0f172a;padding:12px;border-radius:6px;color:#00f0ff;font-family:monospace;font-size:13px;word-break:break-all;border:1px solid #1e293b;">
            {url}
          </p>

          <div style="display:flex;gap:16px;margin:20px 0;">
            <div style="flex:1;background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;">Security Score</p>
              <p style="margin:6px 0 0;font-size:32px;font-weight:800;color:{'#10b981' if score >= 80 else '#f97316' if score >= 60 else '#ef4444'};">{score}<span style="font-size:14px;color:#64748b;">/100</span></p>
            </div>
          </div>

          <h2 style="color:#f3f4f6;font-size:16px;margin-bottom:12px;">Issues Detected</h2>
          <ul style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 16px 16px 32px;margin:0 0 24px;">
            {issues_html}
          </ul>

          <p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">
            This is an automated security alert from Aegis AI.<br>
            Do not reply to this email.
          </p>
        </div>
        <!-- Footer -->
        <div style="background:#030712;padding:16px;text-align:center;border-top:1px solid #1e293b;">
          <p style="margin:0;color:#334155;font-size:11px;">Aegis AI Personal Cybersecurity Assistant</p>
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"⚠ Aegis Alert: {risk} Risk Detected — {url[:50]}"
    msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
        print(f"[Email] Alert sent to {to_email} for {url} ({risk})")
    except Exception as e:
        print(f"[Email] Failed to send alert: {e}")
