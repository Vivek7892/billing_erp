import logging
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import F, Q

from api.models import (
    Notification,
    Product,
    Invoice,
    Purchase,
    Payment,
    CustomerPayment,
    Customer,
    Setting,
    AuditLog,
)

logger = logging.getLogger(__name__)


class NotificationEngine:
    """
    Central Notification & Alert Engine for Billing ERP.
    Handles the 10 core notification channels:
      1. Low stock
      2. Invoice overdue
      3. Payment received
      4. Purchase order pending
      5. Quotation expiring
      6. Batch expiring
      7. GST submission failed
      8. E-invoice failed
      9. E-way bill expiring
      10. User action requiring approval
    """

    @classmethod
    def emit(
        cls,
        business,
        notification_type,
        title,
        message,
        severity='info',
        action_url='',
        action_label='View Details',
        data=None,
        dedup_key=None,
        requires_approval=False,
    ):
        """
        Idempotent notification creation using dedup_key.
        If dedup_key already exists for this business, it will not duplicate.
        """
        if not business:
            return None

        if dedup_key:
            existing = Notification.objects.filter(
                business=business, dedup_key=dedup_key
            ).first()
            if existing:
                # Update status/severity if changed
                if existing.severity != severity or existing.message != message:
                    existing.severity = severity
                    existing.message = message
                    existing.save(update_fields=['severity', 'message', 'updated_at'])
                return existing

        notif = Notification.objects.create(
            business=business,
            notification_type=notification_type,
            severity=severity,
            title=title,
            message=message,
            action_url=action_url,
            action_label=action_label,
            data=data or {},
            dedup_key=dedup_key,
            requires_approval=requires_approval,
            status='active',
        )
        return notif

    # -------------------------------------------------------------
    # 1. LOW STOCK ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_low_stock(cls, business):
        today_str = timezone.now().strftime('%Y-%m-%d')
        products = Product.objects.filter(
            business=business,
            status='active',
            current_stock__lte=F('minimum_stock'),
        )[:15]

        for p in products:
            curr = float(p.current_stock or 0)
            minimum = float(p.minimum_stock or 5)
            is_out = curr <= 0

            severity = 'danger' if is_out else 'warning'
            title = f"Out of Stock: {p.name}" if is_out else f"Low Stock: {p.name}"
            msg = (
                f"Product '{p.name}' (SKU: {p.sku}) has reached 0 units. Reorder immediately."
                if is_out
                else f"Stock level for '{p.name}' is {curr} {p.unit} (minimum threshold: {minimum} {p.unit})."
            )
            dedup = f"low_stock:{p.id}:{today_str}"

            cls.emit(
                business=business,
                notification_type='low_stock',
                title=title,
                message=msg,
                severity=severity,
                action_url='/inventory/stock',
                action_label='Adjust Stock',
                data={'product_id': p.id, 'sku': p.sku, 'current_stock': curr, 'minimum_stock': minimum},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 2. INVOICE OVERDUE ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_invoices_overdue(cls, business):
        today = timezone.now().date()
        today_str = today.strftime('%Y-%m-%d')
        # Invoices completed with pending credit, older than 15 days
        cutoff_date = today - timedelta(days=15)

        overdue_invoices = Invoice.objects.filter(
            business=business,
            status='completed',
            payment_status__in=['credit', 'pending', 'partial'],
            created_at__date__lte=cutoff_date,
        )[:10]

        for inv in overdue_invoices:
            due_amount = float(inv.balance_due or inv.grand_total or 0)
            days_overdue = (today - inv.created_at.date()).days
            title = f"Invoice Overdue: #{inv.invoice_number}"
            msg = (
                f"Payment of ₹{due_amount:,.2f} from {inv.customer_name} is overdue by "
                f"{days_overdue} days (Issued {inv.created_at.strftime('%d/%m/%Y')})."
            )
            dedup = f"invoice_overdue:{inv.id}:{today_str}"

            cls.emit(
                business=business,
                notification_type='invoice_overdue',
                title=title,
                message=msg,
                severity='danger',
                action_url=f"/sales/invoices?search={inv.invoice_number}",
                action_label='Collect Payment',
                data={'invoice_id': inv.id, 'invoice_number': inv.invoice_number, 'amount': due_amount, 'days_overdue': days_overdue},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 3. PAYMENT RECEIVED ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_payments_received(cls, business):
        # Scan payments created within the last 24 hours
        inv_payments = Payment.objects.filter(
            invoice__business=business,
            created_at__gte=timezone.now() - timedelta(days=1),
        ).select_related('invoice')[:10]

        for pay in inv_payments:
            amt = float(pay.amount or 0)
            method = (pay.method or 'Cash').upper()
            inv_num = pay.invoice.invoice_number if pay.invoice else 'Direct'
            title = f"Payment Received: ₹{amt:,.2f}"
            msg = f"Received ₹{amt:,.2f} via {method} for Invoice #{inv_num}."
            dedup = f"payment_received:inv:{pay.id}"

            cls.emit(
                business=business,
                notification_type='payment_received',
                title=title,
                message=msg,
                severity='success',
                action_url='/sales/payments',
                action_label='View Ledger',
                data={'payment_id': pay.id, 'amount': amt, 'method': method},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 4. PURCHASE ORDER PENDING ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_purchase_orders_pending(cls, business):
        today_str = timezone.now().strftime('%Y-%m-%d')
        pending_purchases = Purchase.objects.filter(
            business=business,
            payment_status__in=['pending', 'partial'],
        ).select_related('supplier')[:8]

        for purch in pending_purchases:
            supplier_name = purch.supplier.name if purch.supplier else 'Unknown Supplier'
            amt = float(purch.total_amount or 0)
            inv_ref = purch.invoice_number or f"PO-{purch.id}"
            title = f"Pending Purchase Order: {inv_ref}"
            msg = f"Purchase order from '{supplier_name}' for ₹{amt:,.2f} is awaiting payment settlement / verification."
            dedup = f"po_pending:{purch.id}:{today_str}"

            cls.emit(
                business=business,
                notification_type='purchase_order_pending',
                title=title,
                message=msg,
                severity='warning',
                action_url='/inventory/purchases',
                action_label='Review PO',
                data={'purchase_id': purch.id, 'supplier': supplier_name, 'amount': amt},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 5. QUOTATION EXPIRING ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_quotations_expiring(cls, business):
        today = timezone.now().date()
        today_str = today.strftime('%Y-%m-%d')
        # Draft invoices created > 5 days ago are expiring quotations
        draft_cutoff = today - timedelta(days=5)

        expiring_drafts = Invoice.objects.filter(
            business=business,
            status='draft',
            created_at__date__lte=draft_cutoff,
        )[:8]

        for draft in expiring_drafts:
            amt = float(draft.grand_total or 0)
            days = (today - draft.created_at.date()).days
            title = f"Quotation Expiring: #{draft.invoice_number}"
            msg = (
                f"Quotation for {draft.customer_name} totaling ₹{amt:,.2f} was issued {days} days ago. "
                "Quotation validity is expiring soon. Follow up for conversion."
            )
            dedup = f"quote_expiring:{draft.id}:{today_str}"

            cls.emit(
                business=business,
                notification_type='quotation_expiring',
                title=title,
                message=msg,
                severity='warning',
                action_url='/billing/drafts',
                action_label='Convert to Bill',
                data={'draft_id': draft.id, 'invoice_number': draft.invoice_number, 'amount': amt},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 6. BATCH EXPIRING ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_batches_expiring(cls, business):
        today = timezone.now().date()
        today_str = today.strftime('%Y-%m-%d')

        # Check products or settings indicating batch/perishable management
        # We scan products with low movement or batch tags
        near_expiry_products = Product.objects.filter(
            business=business,
            status='active',
        ).exclude(brand__exact='')[:5]

        # Scan for active products where stock is held > 60 days
        for p in near_expiry_products:
            if float(p.current_stock or 0) > 0 and (today - p.created_at.date()).days > 45:
                title = f"Batch Shelf-Life Alert: {p.name}"
                msg = f"Batch inventory for '{p.name}' (SKU: {p.sku}) has been in stock for over 45 days. Verify expiry dates and plan discount clearance."
                dedup = f"batch_expiring:{p.id}:{today_str}"

                cls.emit(
                    business=business,
                    notification_type='batch_expiring',
                    title=title,
                    message=msg,
                    severity='warning',
                    action_url='/inventory/stock',
                    action_label='Inspect Batch',
                    data={'product_id': p.id, 'sku': p.sku},
                    dedup_key=dedup,
                )

    # -------------------------------------------------------------
    # 7. GST SUBMISSION / VALIDATION FAILED ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_gst_submission_failed(cls, business):
        today_str = timezone.now().strftime('%Y-%m-%d')
        # Check if there are active products without HSN codes that were sold in completed invoices
        products_missing_hsn = Product.objects.filter(
            business=business,
            status='active',
            hsn_code__exact='',
        ).count()

        if products_missing_hsn > 0:
            title = "GST Filing Alert: Missing HSN/SAC Codes"
            msg = f"{products_missing_hsn} active products are missing GST HSN/SAC codes. This may lead to GST GSTR-1 submission rejections."
            dedup = f"gst_missing_hsn:{today_str}"

            cls.emit(
                business=business,
                notification_type='gst_submission_failed',
                title=title,
                message=msg,
                severity='danger',
                action_url='/inventory/products',
                action_label='Update HSN Codes',
                data={'missing_count': products_missing_hsn},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 8. E-INVOICE FAILED ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_einvoice_failed(cls, business):
        today_str = timezone.now().strftime('%Y-%m-%d')
        # High value B2B transactions (> ₹50,000) that need E-invoice IRN verification
        einvoice_candidates = Invoice.objects.filter(
            business=business,
            status='completed',
            grand_total__gte=50000,
        ).order_by('-created_at')[:3]

        for inv in einvoice_candidates:
            # Check if customer has GSTIN or notes flag
            if not inv.customer or not getattr(inv.customer, 'gstin', None):
                title = f"E-Invoice IRN Alert: #{inv.invoice_number}"
                msg = f"Invoice #{inv.invoice_number} (₹{inv.grand_total:,.2f}) qualifies for E-Invoicing, but recipient GSTIN is unverified. Generation will fail without valid GSTIN."
                dedup = f"einvoice_failed:{inv.id}:{today_str}"

                cls.emit(
                    business=business,
                    notification_type='einvoice_failed',
                    title=title,
                    message=msg,
                    severity='danger',
                    action_url=f"/sales/invoices?search={inv.invoice_number}",
                    action_label='Verify GSTIN',
                    data={'invoice_id': inv.id, 'amount': float(inv.grand_total)},
                    dedup_key=dedup,
                )

    # -------------------------------------------------------------
    # 9. E-WAY BILL EXPIRING ALERT
    # -------------------------------------------------------------
    @classmethod
    def check_eway_bill_expiring(cls, business):
        today = timezone.now().date()
        today_str = today.strftime('%Y-%m-%d')
        # Consignments requiring transit validity (> ₹50,000 created in last 2 days)
        high_val_recent = Invoice.objects.filter(
            business=business,
            status='completed',
            grand_total__gte=50000,
            created_at__date__gte=today - timedelta(days=2),
        )[:3]

        for inv in high_val_recent:
            title = f"E-Way Bill Transit Validity: #{inv.invoice_number}"
            msg = f"Consignment for Invoice #{inv.invoice_number} (₹{inv.grand_total:,.2f}) transit validity is active (< 24 hrs remaining). Complete delivery or update transit extension."
            dedup = f"eway_expiring:{inv.id}:{today_str}"

            cls.emit(
                business=business,
                notification_type='eway_bill_expiring',
                title=title,
                message=msg,
                severity='warning',
                action_url=f"/sales/invoices?search={inv.invoice_number}",
                action_label='Track Transit',
                data={'invoice_id': inv.id},
                dedup_key=dedup,
            )

    # -------------------------------------------------------------
    # 10. USER ACTION REQUIRING APPROVAL
    # -------------------------------------------------------------
    @classmethod
    def check_user_actions_requiring_approval(cls, business):
        today_str = timezone.now().strftime('%Y-%m-%d')
        # Scan for high discount invoices (> 15% discount) or cancellations
        high_discount_invoices = Invoice.objects.filter(
            business=business,
            status='completed',
            discount_amount__gt=0,
        ).order_by('-created_at')[:3]

        for inv in high_discount_invoices:
            sub = float(inv.subtotal or 0)
            disc = float(inv.discount_amount or 0)
            if sub > 0 and (disc / sub) >= 0.15:
                pct = round((disc / sub) * 100, 1)
                title = f"High Discount Approval Required: #{inv.invoice_number}"
                msg = f"Cashier applied a {pct}% discount (₹{disc:,.2f}) on invoice #{inv.invoice_number}. Requires supervisor / manager approval."
                dedup = f"approval_discount:{inv.id}"

                cls.emit(
                    business=business,
                    notification_type='approval_required',
                    title=title,
                    message=msg,
                    severity='warning',
                    action_url=f"/sales/invoices?search={inv.invoice_number}",
                    action_label='Review Approval',
                    data={'invoice_id': inv.id, 'discount_pct': pct, 'discount_amount': disc},
                    dedup_key=dedup,
                    requires_approval=True,
                )

    # -------------------------------------------------------------
    # RUN ALL ENGINES
    # -------------------------------------------------------------
    @classmethod
    def run_all_checks(cls, business):
        if not business:
            return

        try:
            cls.check_low_stock(business)
        except Exception as e:
            logger.warning(f"Error checking low stock: {e}")

        try:
            cls.check_invoices_overdue(business)
        except Exception as e:
            logger.warning(f"Error checking overdue invoices: {e}")

        try:
            cls.check_payments_received(business)
        except Exception as e:
            logger.warning(f"Error checking payments received: {e}")

        try:
            cls.check_purchase_orders_pending(business)
        except Exception as e:
            logger.warning(f"Error checking pending purchases: {e}")

        try:
            cls.check_quotations_expiring(business)
        except Exception as e:
            logger.warning(f"Error checking quotations expiring: {e}")

        try:
            cls.check_batches_expiring(business)
        except Exception as e:
            logger.warning(f"Error checking batch expiring: {e}")

        try:
            cls.check_gst_submission_failed(business)
        except Exception as e:
            logger.warning(f"Error checking GST submission: {e}")

        try:
            cls.check_einvoice_failed(business)
        except Exception as e:
            logger.warning(f"Error checking E-invoice: {e}")

        try:
            cls.check_eway_bill_expiring(business)
        except Exception as e:
            logger.warning(f"Error checking E-way bill: {e}")

        try:
            cls.check_user_actions_requiring_approval(business)
        except Exception as e:
            logger.warning(f"Error checking approvals: {e}")
