"""Transactional Email Backend for Dreamwithtech Billing ERP.

Supports HTTPS REST APIs (Resend, Brevo, SendGrid, Mailgun) as well as standard
SMTP and console backends.
Enables reliable transactional email delivery (OTP, password reset, notifications)
in containerized production environments like Render where outbound SMTP ports
(25, 465, 587) are blocked.
"""

import email.utils
import json
import logging
import socket
import urllib.error
import urllib.request
from typing import List, Optional, Tuple

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend
from django.core.mail.backends.smtp import EmailBackend as SmtpEmailBackend
from django.core.mail.message import EmailMessage

logger = logging.getLogger(__name__)


class PermanentEmailError(Exception):
    """Email delivery failed permanently (e.g. invalid credentials, unverified sender, blocked port). Do not retry."""
    pass


class TransientEmailError(Exception):
    """Email delivery failed temporarily (e.g. rate limit, connection timeout, server 5xx). Can be retried."""
    pass


def mask_secret(val: Optional[str]) -> str:
    """Safely mask API keys and credentials for logging."""
    if not val:
        return "<none>"
    s = str(val).strip()
    if len(s) <= 8:
        return "***"
    return f"{s[:3]}...{s[-4:]}"


def mask_email(email_str: Optional[str]) -> str:
    """Mask email addresses for privacy in logs."""
    if not email_str or "@" not in email_str:
        return "***"
    user_part, domain = email_str.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "*"
    else:
        masked_user = user_part[0] + "*" * (len(user_part) - 2) + user_part[-1]
    return f"{masked_user}@{domain}"


def extract_email_content(message: EmailMessage) -> Tuple[str, Optional[str]]:
    """Extract plain text and HTML bodies from a Django EmailMessage or EmailMultiAlternatives."""
    text_content = message.body or ""
    html_content = None

    if hasattr(message, "alternatives"):
        for content, mimetype in message.alternatives:
            if mimetype == "text/html":
                html_content = content
                break
    elif getattr(message, "content_subtype", "") == "html":
        html_content = message.body
        text_content = ""

    return text_content, html_content


def _http_post(url: str, headers: dict, payload: dict, timeout: int = 15) -> Tuple[int, dict]:
    """Execute an HTTPS POST request using httpx if available, falling back to urllib."""
    try:
        import httpx
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text}
            return resp.status_code, data
    except ImportError:
        pass
    except Exception as exc:
        raise TransientEmailError(f"HTTP request to {url} failed: {exc}") from exc

    # Fallback to standard library urllib
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            try:
                data = json.loads(body)
            except Exception:
                data = {"raw": body}
            return response.status, data
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        try:
            data = json.loads(body)
        except Exception:
            data = {"raw": body}
        return err.code, data
    except urllib.error.URLError as err:
        raise TransientEmailError(f"HTTP connection to {url} failed: {err}") from err


class TransactionalEmailBackend(BaseEmailBackend):
    """
    Intelligent Email Backend for Dreamwithtech.

    Automatically selects between HTTPS APIs (Resend, Brevo, SendGrid, Mailgun)
    and standard SMTP/Console based on configuration.
    """

    def __init__(self, fail_silently: bool = False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.timeout = getattr(settings, "EMAIL_TIMEOUT", 15)

    def resolve_provider(self) -> str:
        """Resolve the active email delivery provider."""
        explicit_provider = getattr(settings, "EMAIL_PROVIDER", "auto")
        if explicit_provider and explicit_provider != "auto":
            return explicit_provider.lower().strip()

        # Auto-detection based on configured credentials
        if getattr(settings, "RESEND_API_KEY", "") or getattr(settings, "EMAIL_API_KEY", "").startswith("re_"):
            return "resend"
        if getattr(settings, "BREVO_API_KEY", "") or getattr(settings, "EMAIL_API_KEY", "").startswith("xkeysib-"):
            return "brevo"
        if getattr(settings, "SENDGRID_API_KEY", "") or getattr(settings, "EMAIL_API_KEY", "").startswith("SG."):
            return "sendgrid"
        if getattr(settings, "MAILGUN_API_KEY", "") and getattr(settings, "MAILGUN_DOMAIN", ""):
            return "mailgun"
        if getattr(settings, "EMAIL_API_KEY", ""):
            return "resend"

        # If SMTP host is configured (e.g. local development with smtp.gmail.com)
        if getattr(settings, "EMAIL_HOST", ""):
            return "smtp"

        # Fallback to console in DEBUG mode
        if getattr(settings, "DEBUG", False):
            return "console"

        return "smtp"

    def send_messages(self, email_messages: List[EmailMessage]) -> int:
        """Deliver messages through the resolved provider."""
        if not email_messages:
            return 0

        provider = self.resolve_provider()
        num_sent = 0

        for message in email_messages:
            try:
                sent = self._send_one(message, provider)
                if sent:
                    num_sent += 1
            except Exception as exc:
                if not self.fail_silently:
                    raise
                logger.error("Failed to deliver email through %s (fail_silently=True): %s", provider, exc)

        return num_sent

    def _send_one(self, message: EmailMessage, provider: str) -> bool:
        """Send a single message via the selected provider."""
        to_emails = list(message.to)
        if not to_emails:
            return False

        sender_name, sender_email = email.utils.parseaddr(message.from_email)
        if not sender_email:
            default_from = getattr(settings, "DEFAULT_FROM_EMAIL", "dreamwithtech.dev@gmail.com")
            sender_name, sender_email = email.utils.parseaddr(default_from)

        text_content, html_content = extract_email_content(message)

        if provider == "resend":
            return self._send_resend(message, text_content, html_content, sender_name, sender_email)
        elif provider in ("brevo", "sendinblue"):
            return self._send_brevo(message, text_content, html_content, sender_name, sender_email)
        elif provider == "sendgrid":
            return self._send_sendgrid(message, text_content, html_content, sender_name, sender_email)
        elif provider == "mailgun":
            return self._send_mailgun(message, text_content, html_content, sender_name, sender_email)
        elif provider == "console":
            return bool(ConsoleEmailBackend().send_messages([message]))
        elif provider == "smtp":
            return self._send_smtp(message)
        else:
            raise PermanentEmailError(f"Unsupported EMAIL_PROVIDER '{provider}'. Choose resend, brevo, sendgrid, mailgun, smtp, or console.")

    # -------------------------------------------------------------------------
    # RESEND (HTTPS API)
    # -------------------------------------------------------------------------
    def _send_resend(self, message: EmailMessage, text: str, html: Optional[str], s_name: str, s_email: str) -> bool:
        api_key = getattr(settings, "RESEND_API_KEY", None) or getattr(settings, "EMAIL_API_KEY", "")
        if not api_key:
            raise PermanentEmailError("RESEND_API_KEY or EMAIL_API_KEY is not configured.")

        # Allow overriding sender specifically for Resend (e.g. onboarding@resend.dev)
        resend_from = getattr(settings, "RESEND_FROM_EMAIL", "") or message.from_email
        url = getattr(settings, "EMAIL_API_URL", "").strip() or "https://api.resend.com/emails"

        payload = {
            "from": resend_from,
            "to": list(message.to),
            "subject": message.subject,
            "text": text,
        }
        if html:
            payload["html"] = html
        if message.reply_to:
            payload["reply_to"] = message.reply_to
        if message.cc:
            payload["cc"] = list(message.cc)
        if message.bcc:
            payload["bcc"] = list(message.bcc)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Dreamwithtech-Billing-ERP/1.0",
        }

        status, resp_data = _http_post(url, headers, payload, timeout=self.timeout)

        if status in (200, 201, 202):
            msg_id = resp_data.get("id") if isinstance(resp_data, dict) else "<unknown>"
            logger.info("Resend delivered email successfully (id=%s, to=%s)", msg_id, [mask_email(e) for e in message.to])
            return True

        err_msg = resp_data.get("message") if isinstance(resp_data, dict) else str(resp_data)
        if status in (400, 401, 403, 422):
            raise PermanentEmailError(f"Resend API error HTTP {status}: {err_msg}")
        elif status == 429:
            raise TransientEmailError(f"Resend rate limit exceeded (HTTP 429): {err_msg}")
        else:
            raise TransientEmailError(f"Resend service error HTTP {status}: {err_msg}")

    # -------------------------------------------------------------------------
    # BREVO / SENDINBLUE (HTTPS API)
    # -------------------------------------------------------------------------
    def _send_brevo(self, message: EmailMessage, text: str, html: Optional[str], s_name: str, s_email: str) -> bool:
        api_key = getattr(settings, "BREVO_API_KEY", None) or getattr(settings, "EMAIL_API_KEY", "")
        if not api_key:
            raise PermanentEmailError("BREVO_API_KEY or EMAIL_API_KEY is not configured.")

        url = getattr(settings, "EMAIL_API_URL", "").strip() or "https://api.brevo.com/v3/smtp/email"

        payload = {
            "sender": {
                "name": s_name or "Dreamwithtech",
                "email": s_email or "dreamwithtech.dev@gmail.com",
            },
            "to": [{"email": addr} for addr in message.to],
            "subject": message.subject,
            "textContent": text,
        }
        if html:
            payload["htmlContent"] = html
        if message.reply_to:
            r_name, r_email = email.utils.parseaddr(message.reply_to[0])
            payload["replyTo"] = {"email": r_email, "name": r_name or r_email}
        if message.cc:
            payload["cc"] = [{"email": addr} for addr in message.cc]
        if message.bcc:
            payload["bcc"] = [{"email": addr} for addr in message.bcc]

        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "Dreamwithtech-Billing-ERP/1.0",
        }

        status, resp_data = _http_post(url, headers, payload, timeout=self.timeout)

        if status in (200, 201, 202):
            msg_id = resp_data.get("messageId") if isinstance(resp_data, dict) else "<unknown>"
            logger.info("Brevo delivered email successfully (id=%s, to=%s)", msg_id, [mask_email(e) for e in message.to])
            return True

        err_msg = resp_data.get("message") if isinstance(resp_data, dict) else str(resp_data)
        if status in (400, 401, 403, 404, 422):
            raise PermanentEmailError(f"Brevo API error HTTP {status}: {err_msg}")
        elif status == 429:
            raise TransientEmailError(f"Brevo rate limit exceeded (HTTP 429): {err_msg}")
        else:
            raise TransientEmailError(f"Brevo service error HTTP {status}: {err_msg}")

    # -------------------------------------------------------------------------
    # SENDGRID (HTTPS API)
    # -------------------------------------------------------------------------
    def _send_sendgrid(self, message: EmailMessage, text: str, html: Optional[str], s_name: str, s_email: str) -> bool:
        api_key = getattr(settings, "SENDGRID_API_KEY", None) or getattr(settings, "EMAIL_API_KEY", "")
        if not api_key:
            raise PermanentEmailError("SENDGRID_API_KEY or EMAIL_API_KEY is not configured.")

        url = getattr(settings, "EMAIL_API_URL", "").strip() or "https://api.sendgrid.com/v3/mail/send"

        personalization = {"to": [{"email": addr} for addr in message.to]}
        if message.cc:
            personalization["cc"] = [{"email": addr} for addr in message.cc]
        if message.bcc:
            personalization["bcc"] = [{"email": addr} for addr in message.bcc]

        content_list = [{"type": "text/plain", "value": text or " "}]
        if html:
            content_list.append({"type": "text/html", "value": html})

        payload = {
            "personalizations": [personalization],
            "from": {"email": s_email, "name": s_name or "Dreamwithtech"},
            "subject": message.subject,
            "content": content_list,
        }
        if message.reply_to:
            r_name, r_email = email.utils.parseaddr(message.reply_to[0])
            payload["reply_to"] = {"email": r_email, "name": r_name or r_email}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Dreamwithtech-Billing-ERP/1.0",
        }

        status, resp_data = _http_post(url, headers, payload, timeout=self.timeout)

        if status in (200, 201, 202):
            logger.info("SendGrid delivered email successfully (to=%s)", [mask_email(e) for e in message.to])
            return True

        err_msg = str(resp_data)
        if isinstance(resp_data, dict) and "errors" in resp_data:
            err_msg = "; ".join([e.get("message", "") for e in resp_data["errors"] if isinstance(e, dict)])

        if status in (400, 401, 403, 404, 422):
            raise PermanentEmailError(f"SendGrid API error HTTP {status}: {err_msg}")
        elif status == 429:
            raise TransientEmailError(f"SendGrid rate limit exceeded (HTTP 429): {err_msg}")
        else:
            raise TransientEmailError(f"SendGrid service error HTTP {status}: {err_msg}")

    # -------------------------------------------------------------------------
    # MAILGUN (HTTPS API)
    # -------------------------------------------------------------------------
    def _send_mailgun(self, message: EmailMessage, text: str, html: Optional[str], s_name: str, s_email: str) -> bool:
        api_key = getattr(settings, "MAILGUN_API_KEY", "")
        domain = getattr(settings, "MAILGUN_DOMAIN", "")
        if not api_key or not domain:
            raise PermanentEmailError("MAILGUN_API_KEY and MAILGUN_DOMAIN must be configured.")

        url = f"https://api.mailgun.net/v3/{domain}/messages"
        # Mailgun expects multipart/form-data or application/x-www-form-urlencoded
        try:
            import httpx
            data = {
                "from": message.from_email,
                "to": list(message.to),
                "subject": message.subject,
                "text": text,
            }
            if html:
                data["html"] = html

            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, auth=("api", api_key), data=data)
                if resp.status_code in (200, 201, 202):
                    logger.info("Mailgun delivered email successfully (to=%s)", [mask_email(e) for e in message.to])
                    return True
                if resp.status_code in (400, 401, 403):
                    raise PermanentEmailError(f"Mailgun API error HTTP {resp.status_code}: {resp.text}")
                raise TransientEmailError(f"Mailgun service error HTTP {resp.status_code}: {resp.text}")
        except ImportError:
            raise PermanentEmailError("httpx package required for Mailgun API delivery.")

    # -------------------------------------------------------------------------
    # SMTP (Standard SmtpEmailBackend)
    # -------------------------------------------------------------------------
    def _send_smtp(self, message: EmailMessage) -> bool:
        """Deliver via Django's built-in SMTP backend."""
        try:
            backend = SmtpEmailBackend(
                host=getattr(settings, "EMAIL_HOST", ""),
                port=getattr(settings, "EMAIL_PORT", 587),
                username=getattr(settings, "EMAIL_HOST_USER", ""),
                password=getattr(settings, "EMAIL_HOST_PASSWORD", ""),
                use_tls=getattr(settings, "EMAIL_USE_TLS", True),
                use_ssl=getattr(settings, "EMAIL_USE_SSL", False),
                timeout=self.timeout,
                fail_silently=False,
            )
            count = backend.send_messages([message])
            return count > 0
        except (socket.error, OSError) as exc:
            errno = getattr(exc, "errno", None)
            if errno in (101, 111):
                raise PermanentEmailError(
                    f"Direct SMTP connection to {getattr(settings, 'EMAIL_HOST', '')}:{getattr(settings, 'EMAIL_PORT', 587)} "
                    f"failed with [Errno {errno}] (Network is unreachable / Connection refused). "
                    "Outbound SMTP traffic is blocked by the host platform environment (e.g. Render). "
                    "Please configure an HTTPS transactional email provider (such as RESEND_API_KEY, BREVO_API_KEY, or SENDGRID_API_KEY) "
                    "in your production environment variables."
                ) from exc
            raise TransientEmailError(f"SMTP socket error: {exc}") from exc

