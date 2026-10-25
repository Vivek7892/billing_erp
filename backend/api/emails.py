import concurrent.futures
import logging
import smtplib
import socket
import time
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import connection, transaction
from django.utils import timezone

from api.email_backends import PermanentEmailError, TransientEmailError, mask_email


logger = logging.getLogger(__name__)

# Bounded thread pool executor for background email delivery
_EMAIL_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=4,
    thread_name_prefix="EmailWorker"
)


def _run_email_task(func, *args, **kwargs):
    """Execute an email delivery task in a background worker thread with retries and connection cleanup."""
    max_retries = 3
    base_delay = 1.0
    func_name = getattr(func, '__name__', str(func))

    try:
        for attempt in range(1, max_retries + 1):
            try:
                func(*args, **kwargs)
                logger.info("Background email task [%s] succeeded on attempt %d", func_name, attempt)
                return
            except PermanentEmailError as exc:
                logger.error(
                    "Background email task [%s] encountered permanent configuration or authentication error: %s. Not retrying.",
                    func_name, exc
                )
                return
            except (TransientEmailError, smtplib.SMTPException, socket.error, OSError, TimeoutError) as exc:
                errno = getattr(exc, 'errno', None)
                if errno in (101, 111):
                    logger.error(
                        "Background email task [%s] encountered host network restriction [Errno %s]: %s. "
                        "Direct outbound SMTP connections (ports 25, 465, 587) are blocked by the host platform environment (e.g. Render). "
                        "To fix this on Render, configure an HTTPS transactional email provider (such as RESEND_API_KEY, BREVO_API_KEY, or SENDGRID_API_KEY). "
                        "Not retrying.",
                        func_name, errno, exc
                    )
                    return

                logger.warning(
                    "Background email task [%s] attempt %d/%d encountered transient error: %s",
                    func_name, attempt, max_retries, exc
                )
                if attempt < max_retries:
                    time.sleep(base_delay * (2 ** (attempt - 1)))
                else:
                    logger.error(
                        "Background email task [%s] exhausted all %d retries. Delivery failed: %s",
                        func_name, max_retries, exc, exc_info=True
                    )
            except Exception as exc:
                logger.error(
                    "Background email task [%s] failed with unexpected error: %s",
                    func_name, exc, exc_info=True
                )
                return
    finally:
        try:
            connection.close()
        except Exception:
            pass


def enqueue_email_task(func, *args, **kwargs):
    """Enqueue an email task to run in the background.

    If a database transaction is active, schedules execution via transaction.on_commit
    so the email is only sent if the database transaction commits successfully.
    """
    def _dispatch():
        _EMAIL_EXECUTOR.submit(_run_email_task, func, *args, **kwargs)

    try:
        transaction.on_commit(_dispatch)
    except Exception:
        _dispatch()


def get_from_email():
    """Return the configured sender with a professional display name."""
    provider = getattr(settings, "EMAIL_PROVIDER", "auto").lower()

    # Prioritize Resend-specific sender if set (e.g. onboarding@resend.dev during testing)
    resend_from = getattr(settings, "RESEND_FROM_EMAIL", None)
    if resend_from and (provider == "resend" or getattr(settings, "RESEND_API_KEY", None)):
        raw_from = resend_from
    else:
        raw_from = (
            getattr(settings, "DEFAULT_FROM_EMAIL", None)
            or getattr(settings, "EMAIL_HOST_USER", None)
            or "dreamwithtech.dev@gmail.com"
        )

    if "<" in raw_from and ">" in raw_from:
        return raw_from

    return f"Dreamwithtech <{raw_from}>"


def _get_user_name(user):
    """Return a safe display name for an email recipient."""
    first_name = getattr(user, "first_name", "") or ""
    username = getattr(user, "username", "") or ""

    return first_name.strip() or username.strip() or "there"


def _plain_text_html(content):
    """Convert simple HTML email content without visual styling."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dreamwithtech</title>
</head>
<body>
    <div>{content}</div>
</body>
</html>
"""


def _send_onboarding_welcome_worker(recipient, display_name):
    """Worker function to format and send onboarding welcome email."""
    if not recipient:
        return 0

    safe_name = escape(display_name)

    frontend_url = getattr(
        settings,
        "FRONTEND_URL",
        "https://billing-erp.vercel.app",
    ).rstrip("/")

    login_url = f"{frontend_url}/login"
    safe_login_url = escape(login_url, quote=True)

    subject = "Welcome to Dreamwithtech"

    text_content = (
        f"Hello {display_name},\n\n"
        "Welcome to Dreamwithtech. Your account is ready to use.\n\n"
        "Dreamwithtech is a business management and billing software designed "
        "to help you manage your shop and daily business operations from one place.\n\n"
        "With Dreamwithtech, you can manage your business information, products "
        "and services, billing, invoices, customers, and business records. "
        "The software is designed to keep your routine work organized and easy to manage.\n\n"
        "Getting started:\n\n"
        "1. Sign in to your account.\n"
        "2. Complete your shop or business information.\n"
        "3. Add your products or services.\n"
        "4. Configure the settings required for your business.\n"
        "5. Add and manage your customers.\n"
        "6. Create invoices and manage your billing activities.\n"
        "7. Review your records regularly and keep your business information up to date.\n\n"
        "Recommended workflow:\n"
        "Set up your business → Add products and services → Add customers → "
        "Configure settings → Create invoices → Manage daily billing and records.\n\n"
        "You can start with the basic setup and add more information as your business grows.\n\n"
        f"Sign in to Dreamwithtech:\n{login_url}\n\n"
        "Visit us:\n"
        "https://www.dreamwithtech.dev/\n\n"
        "Terms and Conditions:\n"
        "https://billing-erp.vercel.app/terms-and-conditions\n\n"
        "Contact us: 7892409872\n\n"
        "If you need assistance, please contact us using the number above.\n\n"
        "Regards,\n"
        "Dreamwithtech"
    )

    html_content = _plain_text_html(
        f"""
        <h2>Welcome to Dreamwithtech</h2>
        <p>Hello <strong>{safe_name}</strong>,</p>

        <p>
            Welcome to Dreamwithtech. Your account is ready to use.
        </p>

        <p>
            Dreamwithtech is a business management and billing software designed
            to help you manage your shop and daily business operations from one place.
        </p>

        <p>
            You can manage your business information, products and services,
            billing, invoices, customers, and business records.
        </p>

        <p><strong>Getting started:</strong></p>
        <ol>
            <li>Sign in to your account.</li>
            <li>Complete your shop or business information.</li>
            <li>Add your products or services.</li>
            <li>Configure the settings required for your business.</li>
            <li>Add and manage your customers.</li>
            <li>Create invoices and manage your billing activities.</li>
            <li>Review your records and keep your information up to date.</li>
        </ol>

        <p>
            <strong>Recommended workflow:</strong><br>
            Set up your business → Add products and services → Add customers →
            Configure settings → Create invoices → Manage daily billing and records.
        </p>

        <p>
            You can start with the basic setup and add more information as your business grows.
        </p>

        <p>
            <a href="{safe_login_url}">Sign in to Dreamwithtech</a>
        </p>

        <p>
            Visit us:<br>
            <a href="https://www.dreamwithtech.dev/">https://www.dreamwithtech.dev/</a>
        </p>

        <p>
            Terms and Conditions:<br>
            <a href="https://billing-erp.vercel.app/terms-and-conditions">
                https://billing-erp.vercel.app/terms-and-conditions
            </a>
        </p>

        <p>
            Contact us: 7892409872
        </p>

        <p>
            Regards,<br>
            Dreamwithtech
        </p>
        """
    )

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=get_from_email(),
        to=[recipient],
    )
    message.attach_alternative(html_content, "text/html")
    sent = message.send(fail_silently=False)
    if sent == 0:
        raise TransientEmailError(f"Email delivery returned 0 for welcome recipient: {mask_email(recipient)}")
    return sent


def send_onboarding_welcome_email(user):
    """Synchronous sender for onboarding welcome email."""
    recipient = getattr(user, "email", "") or str(user)
    display_name = _get_user_name(user) if hasattr(user, "email") else "there"
    return _send_onboarding_welcome_worker(recipient, display_name)


def async_send_onboarding_welcome_email(user_or_email, user_name=None):
    """Asynchronously enqueue an onboarding welcome email."""
    if hasattr(user_or_email, "email"):
        recipient = user_or_email.email
        display_name = user_name or _get_user_name(user_or_email)
    else:
        recipient = str(user_or_email)
        display_name = user_name or "there"

    enqueue_email_task(_send_onboarding_welcome_worker, recipient, display_name)


def _send_registration_notification_worker(
    full_name,
    username,
    email,
    phone,
    role,
    is_verified,
    biz_info=None,
    client_ip=None,
    shop_registered=False,
):
    """Worker function to format and send registration notification email to admin."""
    recipient = getattr(
        settings,
        "REGISTRATION_NOTIFICATION_EMAIL",
        "connectwithvvivek@gmail.com",
    )

    if not recipient:
        return 0

    event_label = "New shop registration" if shop_registered else "New user registration"

    details = [
        ("Full name", full_name or "Not provided"),
        ("Username", username),
        ("Email", email),
        ("Phone", phone or "Not provided"),
        ("Account role", role or "owner"),
        ("Email verified", "Yes" if is_verified else "Pending"),
    ]

    if biz_info:
        details.extend(
            [
                ("Shop name", biz_info.get("name", "Not provided")),
                ("Business type", biz_info.get("business_type") or "Not provided"),
                ("Shop owner", biz_info.get("owner_name") or full_name),
                ("Shop email", biz_info.get("email") or email),
                ("Shop phone", biz_info.get("mobile") or phone or "Not provided"),
                ("Address", biz_info.get("address") or "Not provided"),
                ("City", biz_info.get("city") or "Not provided"),
                ("State", biz_info.get("state") or "Not provided"),
                ("PIN code", biz_info.get("pincode") or "Not provided"),
                ("GST registered", "Yes" if biz_info.get("gst_registered") else "No"),
                ("GSTIN", biz_info.get("gstin") or "Not provided"),
                ("PAN", biz_info.get("pan") or "Not provided"),
            ]
        )
    else:
        details.append(("Shop details", "The user has not completed shop registration yet."))

    if client_ip:
        details.append(("Registration IP", client_ip))

    details.append(
        ("Registered at", timezone.localtime().strftime("%Y-%m-%d %H:%M:%S %Z"))
    )

    text_content = (
        f"{event_label}\n\n"
        + "\n".join(f"{label}: {value}" for label, value in details)
        + "\n\nDreamwithtech"
    )

    html_content = _plain_text_html(
        f"<h2>{escape(event_label)}</h2>"
        + "".join(
            f"<p><strong>{escape(str(label))}:</strong> {escape(str(value))}</p>"
            for label, value in details
        )
    )

    subject_detail = biz_info.get("name") if shop_registered and biz_info else full_name

    message = EmailMultiAlternatives(
        subject=f"{event_label}: {subject_detail}",
        body=text_content,
        from_email=get_from_email(),
        to=[recipient],
    )
    message.attach_alternative(html_content, "text/html")
    sent = message.send(fail_silently=False)
    if sent == 0:
        raise TransientEmailError(f"Email delivery returned 0 for registration notification recipient: {mask_email(recipient)}")
    return sent


def send_registration_notification_email(user, business=None, request=None, shop_registered=False):
    """Synchronous sender for registration notification email."""
    full_name = user.get_full_name().strip() if hasattr(user, "get_full_name") else "Not provided"
    username = getattr(user, "username", "")
    email = getattr(user, "email", "")
    phone = getattr(user, "phone", "")
    role = (
        user.get_role_display()
        if hasattr(user, "get_role_display")
        else getattr(user, "role", "")
    )
    is_verified = getattr(user, "is_verified", False)

    biz_info = None
    if business:
        biz_info = {
            "name": getattr(business, "name", ""),
            "business_type": getattr(business, "business_type", ""),
            "owner_name": getattr(business, "owner_name", "") or full_name,
            "email": getattr(business, "email", "") or email,
            "mobile": getattr(business, "mobile", "") or phone,
            "address": getattr(business, "address", ""),
            "city": getattr(business, "city", ""),
            "state": getattr(business, "state", ""),
            "pincode": getattr(business, "pincode", ""),
            "gst_registered": getattr(business, "gst_registered", False),
            "gstin": getattr(business, "gstin", ""),
            "pan": getattr(business, "pan", ""),
        }

    client_ip = request.META.get("REMOTE_ADDR") if request and hasattr(request, "META") else None

    return _send_registration_notification_worker(
        full_name=full_name,
        username=username,
        email=email,
        phone=phone,
        role=role,
        is_verified=is_verified,
        biz_info=biz_info,
        client_ip=client_ip,
        shop_registered=shop_registered,
    )


def async_send_registration_notification_email(user, business=None, request=None, shop_registered=False):
    """Asynchronously enqueue a registration notification email to admin."""
    full_name = user.get_full_name().strip() if hasattr(user, "get_full_name") else "Not provided"
    username = getattr(user, "username", "")
    email = getattr(user, "email", "")
    phone = getattr(user, "phone", "")
    role = (
        user.get_role_display()
        if hasattr(user, "get_role_display")
        else getattr(user, "role", "")
    )
    is_verified = getattr(user, "is_verified", False)

    biz_info = None
    if business:
        biz_info = {
            "name": getattr(business, "name", ""),
            "business_type": getattr(business, "business_type", ""),
            "owner_name": getattr(business, "owner_name", "") or full_name,
            "email": getattr(business, "email", "") or email,
            "mobile": getattr(business, "mobile", "") or phone,
            "address": getattr(business, "address", ""),
            "city": getattr(business, "city", ""),
            "state": getattr(business, "state", ""),
            "pincode": getattr(business, "pincode", ""),
            "gst_registered": getattr(business, "gst_registered", False),
            "gstin": getattr(business, "gstin", ""),
            "pan": getattr(business, "pan", ""),
        }

    client_ip = request.META.get("REMOTE_ADDR") if request and hasattr(request, "META") else None

    enqueue_email_task(
        _send_registration_notification_worker,
        full_name=full_name,
        username=username,
        email=email,
        phone=phone,
        role=role,
        is_verified=is_verified,
        biz_info=biz_info,
        client_ip=client_ip,
        shop_registered=shop_registered,
    )


def _send_password_reset_worker(recipient, display_name, reset_link):
    """Worker function to format and send password reset link email."""
    if not recipient:
        return 0

    safe_name = escape(display_name)
    safe_reset_link = escape(str(reset_link), quote=True)

    subject = "Reset your Dreamwithtech password"

    text_content = (
        f"Hello {display_name},\n\n"
        "We received a request to reset your Dreamwithtech password.\n\n"
        f"Reset your password:\n{reset_link}\n\n"
        "This link is valid for a limited time and can only be used once.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "Regards,\n"
        "Dreamwithtech"
    )

    html_content = _plain_text_html(
        f"""
        <h2>Reset your password</h2>
        <p>Hello <strong>{safe_name}</strong>,</p>
        <p>We received a request to reset your Dreamwithtech password.</p>
        <p><a href="{safe_reset_link}">Reset your password</a></p>
        <p>This link is valid for a limited time and can only be used once.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p>Regards,<br>Dreamwithtech</p>
        """
    )

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=get_from_email(),
        to=[recipient],
    )
    message.attach_alternative(html_content, "text/html")
    sent = message.send(fail_silently=False)
    if sent == 0:
        raise TransientEmailError(f"Email delivery returned 0 for welcome recipient: {mask_email(recipient)}")
    return sent


def send_password_reset_email(user, reset_link):
    """Synchronous sender for password reset link email."""
    recipient = getattr(user, "email", "") or str(user)
    display_name = _get_user_name(user) if hasattr(user, "email") else "there"
    return _send_password_reset_worker(recipient, display_name, reset_link)


def async_send_password_reset_email(user_or_email, reset_link, user_name=None):
    """Asynchronously enqueue a password reset link email."""
    if hasattr(user_or_email, "email"):
        recipient = user_or_email.email
        display_name = user_name or _get_user_name(user_or_email)
    else:
        recipient = str(user_or_email)
        display_name = user_name or "there"

    enqueue_email_task(_send_password_reset_worker, recipient, display_name, reset_link)


def _send_otp_verification_worker(recipient, otp, display_name, purpose="signup"):
    """Worker function to format and send OTP code email."""
    if not recipient:
        return 0

    display_name = str(display_name).strip() or "there"
    is_password_reset = purpose == "reset"

    subject = (
        "Your Dreamwithtech password reset code"
        if is_password_reset
        else "Verify your Dreamwithtech account"
    )

    instruction = (
        "Use the code below to reset your Dreamwithtech password."
        if is_password_reset
        else "Use the code below to verify your Dreamwithtech account."
    )

    safe_name = escape(display_name)
    safe_otp = escape(str(otp))
    safe_instruction = escape(instruction)

    text_content = (
        f"Hello {display_name},\n\n"
        f"{instruction}\n\n"
        f"Your verification code is: {otp}\n\n"
        "This code expires in 10 minutes. Do not share it with anyone.\n\n"
        "If you did not request this code, you can safely ignore this email.\n\n"
        "Regards,\n"
        "Dreamwithtech"
    )

    html_content = _plain_text_html(
        f"""
        <h2>{"Password reset code" if is_password_reset else "Verify your account"}</h2>
        <p>Hello <strong>{safe_name}</strong>,</p>
        <p>{safe_instruction}</p>
        <p><strong>Your verification code is: {safe_otp}</strong></p>
        <p>This code expires in 10 minutes. Do not share it with anyone.</p>
        <p>If you did not request this code, you can safely ignore this email.</p>
        <p>Regards,<br>Dreamwithtech</p>
        """
    )

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=get_from_email(),
        to=[recipient],
    )
    message.attach_alternative(html_content, "text/html")
    sent = message.send(fail_silently=False)
    if sent == 0:
        raise TransientEmailError(f"Email delivery returned 0 for welcome recipient: {mask_email(recipient)}")
    return sent


def send_otp_verification_email(
    user_or_email,
    otp,
    user_name=None,
    purpose="signup",
):
    """Synchronous sender for OTP verification email."""
    if hasattr(user_or_email, "email"):
        recipient = user_or_email.email
        display_name = (
            user_name
            or getattr(user_or_email, "first_name", "")
            or getattr(user_or_email, "username", "")
            or "there"
        )
    else:
        recipient = str(user_or_email)
        display_name = user_name or "there"

    return _send_otp_verification_worker(recipient, otp, display_name, purpose)


def async_send_otp_verification_email(
    user_or_email,
    otp,
    user_name=None,
    purpose="signup",
):
    """Asynchronously enqueue an OTP verification email."""
    if hasattr(user_or_email, "email"):
        recipient = user_or_email.email
        display_name = (
            user_name
            or getattr(user_or_email, "first_name", "")
            or getattr(user_or_email, "username", "")
            or "there"
        )
    else:
        recipient = str(user_or_email)
        display_name = user_name or "there"

    enqueue_email_task(
        _send_otp_verification_worker,
        recipient,
        str(otp),
        display_name,
        purpose,
    )


# ══════════════════════════════════════════════════════════════════════════════
# AUTOMATIC INVOICE EMAIL DELIVERY (WITH ATTACHED PDF)
# ══════════════════════════════════════════════════════════════════════════════

def _send_invoice_email_worker(invoice_id, recipient_email=None, display_name=None, custom_notes=None):
    """Send a simple invoice email with the PDF attached."""
    from api.models import Invoice, Setting, CommunicationLog

    try:
        invoice = (
            Invoice.objects.select_related("customer", "business", "created_by")
            .prefetch_related("items")
            .get(pk=invoice_id)
        )
    except Invoice.DoesNotExist:
        logger.warning("Invoice %s not found for email delivery. Aborting.", invoice_id)
        return 0

    to_email = recipient_email or (invoice.customer.email if invoice.customer else "")
    to_email = str(to_email or "").strip()

    if not to_email or "@" not in to_email:
        logger.info(
            "Invoice %s has no recipient email address. Skipping email delivery.",
            invoice.invoice_number,
        )
        return 0

    biz = invoice.business

    def get_setting(key, default=""):
        setting = Setting.objects.filter(business=biz, key=key).first() if biz else None
        return getattr(setting, "value", None) or default

    shop_name = get_setting("shop_name", getattr(biz, "name", "") or "Store")
    shop_phone = get_setting("shop_phone", getattr(biz, "mobile", "") or "")
    shop_email = get_setting("shop_email", getattr(biz, "email", "") or "")
    shop_address = get_setting("shop_address", getattr(biz, "address", "") or "")
    shop_gstin = getattr(biz, "gstin", "") or ""

    customer_name = (
        display_name
        or (invoice.customer.name if invoice.customer else invoice.customer_name)
        or "Valued Customer"
    )

    inv_date = invoice.created_at.strftime("%d %b %Y") if invoice.created_at else ""
    inv_num = invoice.invoice_number or f"INV-{invoice.pk}"
    short_url = invoice.get_short_url()

    total = f"Rs. {invoice.grand_total:,.2f}"
    paid = f"Rs. {invoice.paid_amount:,.2f}"
    due = f"Rs. {invoice.balance_due:,.2f}"

    # Generate PDF attachment.
    pdf_bytes = None
    try:
        from api.pdf_utils import generate_invoice_pdf

        pdf_buf = generate_invoice_pdf(invoice)
        if pdf_buf:
            pdf_bytes = pdf_buf.getvalue()
    except Exception as pdf_err:
        logger.warning(
            "Could not generate PDF attachment for invoice %s: %s",
            inv_num,
            pdf_err,
        )

    # Simple item list for the email.
    items = list(invoice.items.all())
    item_lines = []

    for idx, item in enumerate(items, 1):
        name = item.product_name or "Item"
        qty = item.quantity or 0
        rate = f"Rs. {item.unit_price:,.2f}"
        line_total = f"Rs. {item.total:,.2f}"
        item_lines.append(f"{idx}. {name} - {qty} x {rate} = {line_total}")

    items_text = "\n".join(item_lines) if item_lines else "See attached PDF for item details."

    payment_method = str(invoice.payment_method or "").upper()
    payment_status = str(invoice.payment_status or "").upper()

    # Plain, easy-to-read email.
    text_content = (
        f"Hello {customer_name},\n\n"
        f"Thank you for your purchase from {shop_name}.\n\n"
        f"INVOICE\n"
        f"Invoice No.: {inv_num}\n"
        f"Date: {inv_date}\n"
        f"Payment: {payment_method}\n"
        f"Status: {payment_status}\n\n"
        f"ITEMS\n"
        f"{items_text}\n\n"
        f"TOTAL: {total}\n"
        f"PAID: {paid}\n"
        f"BALANCE DUE: {due}\n\n"
        f"View your bill online:\n"
        f"{short_url}\n\n"
        f"Your invoice PDF is attached.\n\n"
        f"{shop_name}\n"
        f"{('Phone: ' + shop_phone) if shop_phone else ''}\n"
        f"{('Email: ' + shop_email) if shop_email else ''}\n"
        f"{shop_address}\n"
        f"{('GSTIN: ' + shop_gstin) if shop_gstin else ''}\n\n"
        f"Thank you!"
    )

    # Simple HTML email — no large banner, cards, shadows, or unnecessary styling.
    safe_shop = escape(shop_name)
    safe_customer = escape(customer_name)
    safe_url = escape(short_url, quote=True)
    safe_items = "<br>".join(escape(line) for line in item_lines)

    if not safe_items:
        safe_items = "See attached PDF for item details."

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #{escape(inv_num)}</title>
</head>
<body style="margin:0; padding:20px; font-family:Arial,sans-serif; color:#222; background:#fff;">
    <div style="max-width:600px; margin:auto;">
        <h2 style="margin-bottom:4px;">{safe_shop}</h2>
        <p style="margin-top:0;">Tax Invoice</p>

        <p>Hello <strong>{safe_customer}</strong>,</p>
        <p>Thank you for your purchase. Here is your bill:</p>

        <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
            <tr>
                <td><strong>Invoice No.</strong></td>
                <td>{escape(inv_num)}</td>
            </tr>
            <tr>
                <td><strong>Date</strong></td>
                <td>{escape(inv_date)}</td>
            </tr>
            <tr>
                <td><strong>Payment</strong></td>
                <td>{escape(payment_method)}</td>
            </tr>
            <tr>
                <td><strong>Status</strong></td>
                <td>{escape(payment_status)}</td>
            </tr>
        </table>

        <h3>Items</h3>
        <div style="line-height:1.7;">{safe_items}</div>

        <hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">

        <p><strong>Total: {escape(total)}</strong></p>
        <p>Paid: {escape(paid)}</p>
        <p>Balance Due: {escape(due)}</p>

        <p>
            <a href="{safe_url}">View Digital Bill</a>
        </p>

        <p>Your invoice PDF is attached to this email.</p>

        <hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">

        <p style="font-size:13px; color:#666;">
            <strong>{safe_shop}</strong><br>
            {escape(shop_address) if shop_address else ""}
            {f"<br>Phone: {escape(shop_phone)}" if shop_phone else ""}
            {f"<br>Email: {escape(shop_email)}" if shop_email else ""}
            {f"<br>GSTIN: {escape(shop_gstin)}" if shop_gstin else ""}
        </p>

        <p>Thank you!</p>
    </div>
</body>
</html>
"""

    subject = f"Invoice #{inv_num} from {shop_name}"

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=get_from_email(),
        to=[to_email],
    )
    message.attach_alternative(html_content, "text/html")

    if pdf_bytes:
        message.attach(
            f"Invoice_{inv_num}.pdf",
            pdf_bytes,
            "application/pdf",
        )

    sent = message.send(fail_silently=False)

    if sent > 0:
        logger.info(
            "Successfully delivered invoice email for %s to %s",
            inv_num,
            mask_email(to_email),
        )

        try:
            CommunicationLog.objects.create(
                business=invoice.business,
                channel="email",
                message_type="invoice",
                recipient_name=customer_name,
                recipient_phone=to_email,
                reference_type="invoice",
                reference_id=str(invoice.pk),
                short_url=short_url,
                content=f"Tax invoice #{inv_num} emailed to {to_email}. Total: {total}",
                status="sent",
                sent_by=invoice.created_by,
            )
        except Exception as log_err:
            logger.warning(
                "Could not record CommunicationLog for invoice %s email: %s",
                inv_num,
                log_err,
            )
    else:
        raise TransientEmailError(
            f"Email delivery returned 0 for invoice {inv_num} "
            f"to {mask_email(to_email)}"
        )

    return sent


def async_send_invoice_email(
    invoice_or_id,
    recipient_email=None,
    recipient_name=None,
    custom_notes=None,
):
    """Asynchronously enqueue sending an invoice email with PDF attached."""
    inv_id = invoice_or_id.pk if hasattr(invoice_or_id, "pk") else int(invoice_or_id)

    enqueue_email_task(
        _send_invoice_email_worker,
        inv_id,
        recipient_email=recipient_email,
        display_name=recipient_name,
        custom_notes=custom_notes,
    )
