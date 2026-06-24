"""
Two-Factor Authentication (2FA) service using TOTP (RFC 6238).
Compatible with Google Authenticator, Authy, and any TOTP app.
"""
import pyotp
import qrcode
import qrcode.image.svg
import io
import base64


def generate_totp_secret() -> str:
    """Generate a new random TOTP secret for a user."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "Aegis AI") -> str:
    """Get the otpauth:// URI for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)


def generate_qr_base64(secret: str, username: str) -> str:
    """Generate a base64-encoded PNG QR code image for the TOTP URI."""
    uri = get_totp_uri(secret, username)
    qr = qrcode.QRCode(version=1, box_size=8, border=4)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code against the user's secret. Allows 1 window drift."""
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    except Exception:
        return False
