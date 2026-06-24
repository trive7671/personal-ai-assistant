import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# We expect these in the .env file (or Render Environment Variables)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
ALERT_FROM_EMAIL = os.getenv("ALERT_FROM_EMAIL", "security@aegis-ai.com")

def send_alert_email(to_email: str, url: str, risk: str, score: int, issues: list):
    """
    Sends an automated email alert when a HIGH or CRITICAL risk is detected.
    Requires SMTP_USERNAME and SMTP_PASSWORD to be set in environment.
    """
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("WARNING: SMTP credentials not set. Alert email cannot be sent.")
        return False

    subject = f"🚨 SECURITY ALERT: {risk} Risk Detected on {url}"
    
    # Format issues as bullet points
    issues_html = "".join([f"<li>{issue}</li>" for issue in issues]) if issues else "<li>Unspecified threats detected.</li>"

    # HTML Email Template
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Aegis AI Security Alert</h2>
          </div>
          <div style="padding: 20px;">
            <p><strong>Warning:</strong> A recent scan has identified a potential security threat.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Target URL:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{url}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Risk Level:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #d32f2f; font-weight: bold;">{risk}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Security Score:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{score}/100</td></tr>
            </table>
            
            <h3 style="margin-top: 20px; color: #d32f2f;">Identified Threats:</h3>
            <ul>
              {issues_html}
            </ul>
            
            <p style="margin-top: 20px;">Please log in to your Aegis AI Dashboard immediately to review the full AI threat analysis and take necessary precautions.</p>
          </div>
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #777;">
            <p>This is an automated alert from your Aegis AI Cybersecurity Assistant.</p>
          </div>
        </div>
      </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = ALERT_FROM_EMAIL
    msg["To"] = to_email

    part = MIMEText(html_content, "html")
    msg.attach(part)

    try:
        # Connect to SMTP server and send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(ALERT_FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        print(f"Alert email successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send alert email: {str(e)}")
        return False
