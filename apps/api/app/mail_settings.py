"""Organization SMTP config: encrypt, seed from env, send."""

from __future__ import annotations

import base64
import hashlib
import os
import smtplib
from email.message import EmailMessage
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from .models import Organization

PLAIN_PREFIX = "plain:"


def _fernet() -> Fernet | None:
    secret = os.getenv("APP_SECRET") or os.getenv("SMTP_SECRET")
    if not secret:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_smtp_password(password: str) -> str:
    fernet = _fernet()
    if fernet:
        return fernet.encrypt(password.encode("utf-8")).decode("ascii")
    if os.getenv("COOKIE_SECURE", "true").lower() == "true":
        raise ValueError("Ustaw APP_SECRET, aby zapisać hasło SMTP")
    return PLAIN_PREFIX + password


def decrypt_smtp_password(stored: str | None) -> str | None:
    if not stored:
        return None
    if stored.startswith(PLAIN_PREFIX):
        return stored[len(PLAIN_PREFIX) :]
    fernet = _fernet()
    if not fernet:
        return None
    try:
        return fernet.decrypt(stored.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def seed_smtp_from_env(org: Organization) -> bool:
    """Copy SMTP_* env into org once when DB has no host. Returns True if seeded."""
    if org.smtp_host:
        return False
    host = (os.getenv("SMTP_HOST") or "").strip()
    if not host:
        return False
    org.smtp_host = host
    org.smtp_port = int(os.getenv("SMTP_PORT", "25"))
    org.smtp_from = os.getenv("SMTP_FROM") or "timelogic@localhost"
    org.smtp_starttls = os.getenv("SMTP_STARTTLS", "").lower() == "true"
    org.smtp_user = os.getenv("SMTP_USER") or None
    password = os.getenv("SMTP_PASSWORD")
    if password:
        try:
            org.smtp_password_enc = encrypt_smtp_password(password)
        except ValueError:
            org.smtp_password_enc = PLAIN_PREFIX + password
    return True


def get_organization(db: Session, organization_id: UUID) -> Organization | None:
    org = db.get(Organization, organization_id)
    if org and seed_smtp_from_env(org):
        db.flush()
    return org


def mail_view(org: Organization) -> dict:
    configured = bool(org.smtp_host)
    return {
        "host": org.smtp_host or "",
        "port": org.smtp_port or 587,
        "from_address": org.smtp_from or "",
        "starttls": bool(org.smtp_starttls),
        "username": org.smtp_user or "",
        "password_set": bool(org.smtp_password_enc),
        "configured": configured,
    }


def deliver_mail(
    *,
    host: str,
    port: int,
    from_address: str,
    starttls: bool,
    username: str | None,
    password: str | None,
    to: str,
    subject: str,
    body: str,
) -> None:
    message = EmailMessage()
    message["From"] = from_address
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(host, port, timeout=10) as smtp:
        if starttls:
            smtp.starttls()
        if username:
            smtp.login(username, password or "")
        smtp.send_message(message)


def send_mail(
    db: Session,
    organization_id: UUID,
    to: str,
    subject: str,
    url: str,
    *,
    body: str | None = None,
) -> bool:
    org = get_organization(db, organization_id)
    if not org or not org.smtp_host:
        return False
    password = decrypt_smtp_password(org.smtp_password_enc)
    content = body or (
        "Zostałeś zaproszony do TimeLogic.\n\n"
        "Ustaw hasło pod poniższym linkiem (ważny 7 dni). "
        "Hasło wpiszesz dwukrotnie, aby uniknąć pomyłki.\n\n"
        f"{url}\n\n"
        "Po zapisaniu hasła przejdziesz do strony logowania.\n"
    )
    try:
        deliver_mail(
            host=org.smtp_host,
            port=int(org.smtp_port or 25),
            from_address=org.smtp_from or "timelogic@localhost",
            starttls=bool(org.smtp_starttls),
            username=org.smtp_user,
            password=password,
            to=to,
            subject=subject,
            body=content,
        )
    except Exception:
        return False
    return True
