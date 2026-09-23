import os
import smtplib
from email.message import EmailMessage


def send_reset_email(to_email: str, reset_link: str) -> None:
    """Send the reset link by SMTP if configured, otherwise print it to the console (dev mode)."""
    host = os.getenv("SMTP_HOST")

    if not host:
        print(f"\n[DEV] Password reset link for {to_email}:\n{reset_link}\n")
        return

    msg = EmailMessage()
    msg["Subject"] = "Reset your HireMind password"
    msg["From"] = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER", "")
    msg["To"] = to_email
    msg.set_content(
        "We received a request to reset your HireMind password.\n\n"
        f"Open this link to choose a new password (valid for 15 minutes):\n{reset_link}\n\n"
        "If you did not ask for this, you can ignore this email."
    )

    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as server:
        server.starttls()
        user = os.getenv("SMTP_USER")
        if user:
            server.login(user, os.getenv("SMTP_PASSWORD", ""))
        server.send_message(msg)
