import logging
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone


logger = logging.getLogger(__name__)


def get_from_email():
    """Return the configured sender with a professional display name."""
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


def send_onboarding_welcome_email(user):
    """Send a simple text-focused onboarding email for a new user/shop."""
    recipient = getattr(user, "email", "")

    if not recipient:
        return 0

    display_name = _get_user_name(user)
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
    return message.send(fail_silently=False)


def send_registration_notification_email(user, business=None, request=None, shop_registered=False):
    """Send a simple text-only registration notification."""
    recipient = getattr(
        settings,
        "REGISTRATION_NOTIFICATION_EMAIL",
        "connectwithvvivek@gmail.com",
    )

    if not recipient:
        return 0

    full_name = user.get_full_name().strip() or "Not provided"
    event_label = "New shop registration" if shop_registered else "New user registration"

    details = [
        ("Full name", full_name),
        ("Username", user.username),
        ("Email", user.email),
        ("Phone", user.phone or "Not provided"),
        (
            "Account role",
            user.get_role_display()
            if hasattr(user, "get_role_display")
            else user.role,
        ),
        ("Email verified", "Yes" if user.is_verified else "Pending"),
    ]

    if business:
        details.extend(
            [
                ("Shop name", business.name),
                ("Business type", business.business_type or "Not provided"),
                ("Shop owner", business.owner_name or full_name),
                ("Shop email", business.email or user.email),
                ("Shop phone", business.mobile or user.phone or "Not provided"),
                ("Address", business.address or "Not provided"),
                ("City", business.city or "Not provided"),
                ("State", business.state or "Not provided"),
                ("PIN code", business.pincode or "Not provided"),
                ("GST registered", "Yes" if business.gst_registered else "No"),
                ("GSTIN", business.gstin or "Not provided"),
                ("PAN", business.pan or "Not provided"),
            ]
        )
    else:
        details.append(("Shop details", "The user has not completed shop registration yet."))

    if request is not None:
        details.append(
            ("Registration IP", request.META.get("REMOTE_ADDR") or "Not available")
        )

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

    subject_detail = business.name if shop_registered and business else full_name

    message = EmailMultiAlternatives(
        subject=f"{event_label}: {subject_detail}",
        body=text_content,
        from_email=get_from_email(),
        to=[recipient],
    )
    message.attach_alternative(html_content, "text/html")
    return message.send(fail_silently=False)


def send_password_reset_email(user, reset_link):
    """Send a simple password-reset email."""
    recipient = getattr(user, "email", "")

    if not recipient:
        return 0

    user_name = _get_user_name(user)
    safe_name = escape(user_name)
    safe_reset_link = escape(str(reset_link), quote=True)

    subject = "Reset your Dreamwithtech password"

    text_content = (
        f"Hello {user_name},\n\n"
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
    return message.send(fail_silently=False)


def send_otp_verification_email(
    user_or_email,
    otp,
    user_name=None,
    purpose="verification",
):
    """Send a simple OTP email for account verification or password reset."""
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
    return message.send(fail_silently=False)
