from decimal import Decimal
import json
from django.db import transaction
from django.utils import timezone
from ..models import (
    ApprovalRequest,
    AuditLog,
    Business,
    Customer,
    Invoice,
    Notification,
    Product,
    Setting,
    User,
)
from ..utils import audit_event


class ApprovalService:
    """Core enterprise business service for evaluating maker-checker approval rules,

    creating approval requests, and executing atomic database transactions upon admin approval.
    """

    DEFAULT_SETTINGS = {
        'approval_price_change_enabled': 'true',
        'approval_price_change_pct': '10',
        'approval_refund_enabled': 'true',
        'approval_refund_threshold': '1000',
        'approval_stock_adjustment_enabled': 'true',
        'approval_stock_adjustment_qty': '10',
        'approval_invoice_cancellation_enabled': 'true',
        'approval_user_role_change_enabled': 'true',
        'approval_credit_limit_increase_enabled': 'true',
        'approval_admin_bypass': 'true',
    }

    @classmethod
    def get_approval_settings(cls, business):
        """Retrieve approval threshold settings for the business with fallback to defaults."""
        keys = list(cls.DEFAULT_SETTINGS.keys())
        stored = {
            s.key: s.value
            for s in Setting.objects.filter(business=business, key__in=keys)
        }

        def _bool(key):
            val = stored.get(key, cls.DEFAULT_SETTINGS[key]).lower()
            return val in ('true', '1', 'yes')

        def _dec(key):
            try:
                return Decimal(str(stored.get(key, cls.DEFAULT_SETTINGS[key])))
            except Exception:
                return Decimal(str(cls.DEFAULT_SETTINGS[key]))

        return {
            'approval_price_change_enabled': _bool('approval_price_change_enabled'),
            'approval_price_change_pct': _dec('approval_price_change_pct'),
            'approval_refund_enabled': _bool('approval_refund_enabled'),
            'approval_refund_threshold': _dec('approval_refund_threshold'),
            'approval_stock_adjustment_enabled': _bool('approval_stock_adjustment_enabled'),
            'approval_stock_adjustment_qty': _dec('approval_stock_adjustment_qty'),
            'approval_invoice_cancellation_enabled': _bool('approval_invoice_cancellation_enabled'),
            'approval_user_role_change_enabled': _bool('approval_user_role_change_enabled'),
            'approval_credit_limit_increase_enabled': _bool('approval_credit_limit_increase_enabled'),
            'approval_admin_bypass': _bool('approval_admin_bypass'),
        }

    @classmethod
    def should_require_approval(cls, business, user, request_type, **kwargs):
        """Evaluates whether an action requires admin approval based on user role and business thresholds.

        Returns (required: bool, rule_description: str).
        """
        cfg = cls.get_approval_settings(business)

        # Admin bypass check
        is_admin_user = (
            user.is_superuser or
            getattr(user, 'role', '') in ('owner', 'admin')
        )
        if is_admin_user and cfg['approval_admin_bypass']:
            return False, ''

        if request_type == 'price_change':
            if not cfg['approval_price_change_enabled']:
                return False, ''
            old_price = Decimal(str(kwargs.get('old_price', 0) or 0))
            new_price = Decimal(str(kwargs.get('new_price', 0) or 0))
            if old_price > 0:
                pct = abs(new_price - old_price) / old_price * Decimal('100')
            else:
                pct = Decimal('100') if new_price > 0 else Decimal('0')
            if pct > cfg['approval_price_change_pct']:
                return True, f"Price change of {pct:.1f}% exceeds threshold of {cfg['approval_price_change_pct']}%."

        elif request_type == 'refund':
            if not cfg['approval_refund_enabled']:
                return False, ''
            refund_amount = Decimal(str(kwargs.get('refund_amount', 0) or 0))
            if refund_amount > cfg['approval_refund_threshold']:
                return True, f"Refund amount ₹{refund_amount:,.2f} exceeds threshold of ₹{cfg['approval_refund_threshold']:,.2f}."

        elif request_type == 'stock_adjustment':
            if not cfg['approval_stock_adjustment_enabled']:
                return False, ''
            quantity = abs(Decimal(str(kwargs.get('quantity', 0) or 0)))
            if quantity > cfg['approval_stock_adjustment_qty']:
                return True, f"Stock adjustment of {quantity} units exceeds threshold of {cfg['approval_stock_adjustment_qty']} units."

        elif request_type == 'invoice_cancellation':
            if cfg['approval_invoice_cancellation_enabled']:
                return True, "Invoice cancellation requires admin approval."

        elif request_type == 'user_role_change':
            if not cfg['approval_user_role_change_enabled']:
                return False, ''
            old_role = kwargs.get('old_role', 'user')
            new_role = kwargs.get('new_role', 'user')
            if old_role != new_role:
                return True, f"Changing user role from '{old_role}' to '{new_role}' requires admin approval."

        elif request_type == 'credit_limit_increase':
            if not cfg['approval_credit_limit_increase_enabled']:
                return False, ''
            old_limit = Decimal(str(kwargs.get('old_limit', 0) or 0))
            new_limit = Decimal(str(kwargs.get('new_limit', 0) or 0))
            if new_limit > old_limit:
                diff = new_limit - old_limit
                return True, f"Increasing customer credit limit by ₹{diff:,.2f} (from ₹{old_limit:,.2f} to ₹{new_limit:,.2f}) requires admin approval."

        return False, ''

    @classmethod
    def create_approval_request(
        cls,
        *,
        business,
        requested_by,
        request_type,
        entity_type,
        entity_id,
        entity_name,
        current_data,
        proposed_data,
        threshold_rule,
        reason='',
        request=None,
    ):
        """Creates a pending ApprovalRequest, generates an alert Notification for admins,

        and logs an immutable AuditLog entry.
        """
        approval_req = ApprovalRequest.objects.create(
            business=business,
            request_type=request_type,
            entity_type=entity_type,
            entity_id=str(entity_id or ''),
            entity_name=entity_name or '',
            current_data=current_data or {},
            proposed_data=proposed_data or {},
            threshold_rule=threshold_rule,
            reason=reason or '',
            requested_by=requested_by,
            status='pending',
        )

        display_name = approval_req.get_request_type_display()
        req_by_name = requested_by.get_full_name() or requested_by.username if requested_by else 'Staff'

        # Create alert notification for store admins
        notif = Notification.objects.create(
            business=business,
            notification_type='approval_required',
            severity='warning',
            title=f"Approval Required: {display_name} — {entity_name}",
            message=f"{threshold_rule} Requested by {req_by_name}. Reason: {reason or 'Pending authorization'}",
            action_url='/notifications?tab=approvals',
            action_label='Review & Approve',
            requires_approval=True,
            status='active',
            data={
                'approval_request_id': approval_req.id,
                'request_type': request_type,
                'entity_type': entity_type,
                'entity_id': str(entity_id or ''),
                'entity_name': entity_name,
                'threshold_rule': threshold_rule,
                'current_data': current_data or {},
                'proposed_data': proposed_data or {},
                'reason': reason,
                'requested_by': req_by_name,
                'requested_at': approval_req.created_at.isoformat(),
            },
        )

        approval_req.notification = notif
        approval_req.save(update_fields=['notification'])

        if request is not None:
            audit_event(
                request,
                'APPROVAL_REQUESTED',
                'ApprovalRequest',
                approval_req.id,
                entity_name=f"{display_name} ({entity_name})",
                before=current_data,
                after=proposed_data,
                reason=f"{threshold_rule} {reason}".strip(),
            )

        return approval_req

    @classmethod
    def approve_request(cls, *, approval_request_id, admin_user, review_notes='', request=None):
        """Applies an approved request inside an atomic database transaction.

        Executes the actual entity mutation, updates ApprovalRequest status, resolves linked Notification,
        and logs full audit records.
        """
        if not (admin_user.is_superuser or getattr(admin_user, 'role', '') in ('owner', 'admin', 'manager')):
            raise PermissionError('Only managers or administrators can approve requests.')

        with transaction.atomic():
            approval_req = ApprovalRequest.objects.select_for_update().get(id=approval_request_id)

            if approval_req.status != 'pending':
                raise ValueError(f'Approval request is already {approval_req.status}.')

            now = timezone.now()
            business = approval_req.business

            # Execute underlying database transaction
            if approval_req.request_type == 'price_change':
                product = Product.objects.select_for_update().get(
                    id=approval_req.entity_id,
                    business=business,
                )
                proposed = approval_req.proposed_data
                if 'selling_price' in proposed:
                    product.selling_price = Decimal(str(proposed['selling_price']))
                if 'mrp' in proposed and proposed['mrp'] is not None:
                    product.mrp = Decimal(str(proposed['mrp']))
                if 'purchase_price' in proposed and proposed['purchase_price'] is not None:
                    product.purchase_price = Decimal(str(proposed['purchase_price']))

                other = proposed.get('other_fields', {})
                for k, v in other.items():
                    if hasattr(product, k) and k not in ('id', 'business', 'created_at', 'current_stock'):
                        setattr(product, k, v)
                product.save()

            elif approval_req.request_type == 'refund':
                from .sales_return_service import SalesReturnService
                proposed = approval_req.proposed_data
                SalesReturnService.create_sales_return(
                    invoice_id=proposed['invoice_id'],
                    reason=f"Approved: {approval_req.reason or review_notes}".strip(),
                    refund_method=proposed.get('refund_method', 'cash'),
                    items_data=proposed['items'],
                    business=business,
                    created_by=approval_req.requested_by or admin_user,
                )

            elif approval_req.request_type == 'stock_adjustment':
                from .inventory_service import InventoryService
                proposed = approval_req.proposed_data
                InventoryService.adjust_stock(
                    product_id=approval_req.entity_id,
                    quantity=Decimal(str(proposed['quantity'])),
                    transaction_type=proposed.get('transaction_type', 'adjustment'),
                    notes=f"Approved: {approval_req.reason or review_notes}".strip(),
                    business=business,
                    created_by=approval_req.requested_by or admin_user,
                )

            elif approval_req.request_type == 'invoice_cancellation':
                from .invoice_service import InvoiceService
                InvoiceService.cancel_invoice(
                    invoice_id=approval_req.entity_id,
                    business=business,
                    performed_by=admin_user,
                    reason=f"Approved: {approval_req.reason or review_notes}".strip(),
                    request=request,
                )

            elif approval_req.request_type == 'user_role_change':
                target_user = User.objects.select_for_update().get(
                    id=approval_req.entity_id,
                    business=business,
                )
                new_role = approval_req.proposed_data['proposed_role']
                target_user.role = new_role
                if new_role in ('owner', 'admin'):
                    target_user.is_staff = True
                target_user.save(update_fields=['role', 'is_staff'])

            elif approval_req.request_type == 'credit_limit_increase':
                customer = Customer.objects.select_for_update().get(
                    id=approval_req.entity_id,
                    business=business,
                )
                customer.credit_limit = Decimal(str(approval_req.proposed_data['proposed_credit_limit']))
                customer.save(update_fields=['credit_limit'])

            else:
                raise NotImplementedError(f"Unsupported request type: {approval_req.request_type}")

            # Mark approval request approved
            approval_req.status = 'approved'
            approval_req.reviewed_by = admin_user
            approval_req.reviewed_at = now
            approval_req.applied_at = now
            approval_req.review_notes = review_notes
            approval_req.save()

            # Synchronize linked notification
            if approval_req.notification:
                notif = approval_req.notification
                notif.status = 'approved'
                notif.actioned_by = admin_user
                notif.actioned_at = now
                notif.action_notes = review_notes
                notif.is_read = True
                notif.save(update_fields=['status', 'actioned_by', 'actioned_at', 'action_notes', 'is_read'])

            # Log audit event
            if request is not None:
                audit_event(
                    request,
                    f"{approval_req.request_type.upper()}_APPROVED",
                    approval_req.entity_type,
                    approval_req.entity_id,
                    entity_name=approval_req.entity_name,
                    before=approval_req.current_data,
                    after=approval_req.proposed_data,
                    reason=f"Approved by {admin_user.username}: {review_notes}".strip(),
                )

        return approval_req

    @classmethod
    def reject_request(cls, *, approval_request_id, admin_user, review_notes='', request=None):
        """Rejects a pending ApprovalRequest without executing entity changes.

        Updates status, resolves notification, and logs audit record.
        """
        if not (admin_user.is_superuser or getattr(admin_user, 'role', '') in ('owner', 'admin', 'manager')):
            raise PermissionError('Only managers or administrators can reject requests.')

        with transaction.atomic():
            approval_req = ApprovalRequest.objects.select_for_update().get(id=approval_request_id)

            if approval_req.status != 'pending':
                raise ValueError(f'Approval request is already {approval_req.status}.')

            now = timezone.now()
            approval_req.status = 'rejected'
            approval_req.reviewed_by = admin_user
            approval_req.reviewed_at = now
            approval_req.review_notes = review_notes
            approval_req.save()

            if approval_req.notification:
                notif = approval_req.notification
                notif.status = 'rejected'
                notif.actioned_by = admin_user
                notif.actioned_at = now
                notif.action_notes = review_notes
                notif.is_read = True
                notif.save(update_fields=['status', 'actioned_by', 'actioned_at', 'action_notes', 'is_read'])

            if request is not None:
                audit_event(
                    request,
                    f"{approval_req.request_type.upper()}_REJECTED",
                    approval_req.entity_type,
                    approval_req.entity_id,
                    entity_name=approval_req.entity_name,
                    before=approval_req.current_data,
                    after={'status': 'rejected'},
                    reason=f"Rejected by {admin_user.username}: {review_notes}".strip(),
                )

        return approval_req

    @classmethod
    def cancel_request(cls, *, approval_request_id, user, reason='', request=None):
        """Allows requester or admin to cancel their pending request."""
        with transaction.atomic():
            approval_req = ApprovalRequest.objects.select_for_update().get(id=approval_request_id)

            if approval_req.status != 'pending':
                raise ValueError(f'Approval request is already {approval_req.status}.')

            is_admin = user.is_superuser or getattr(user, 'role', '') in ('owner', 'admin')
            if not (is_admin or approval_req.requested_by_id == user.id):
                raise PermissionError('Only the original requester or an administrator can cancel this request.')

            now = timezone.now()
            approval_req.status = 'cancelled'
            approval_req.review_notes = f"Cancelled: {reason}".strip()
            approval_req.save()

            if approval_req.notification:
                notif = approval_req.notification
                notif.status = 'dismissed'
                notif.actioned_by = user
                notif.actioned_at = now
                notif.action_notes = reason
                notif.is_read = True
                notif.save(update_fields=['status', 'actioned_by', 'actioned_at', 'action_notes', 'is_read'])

            if request is not None:
                audit_event(
                    request,
                    f"{approval_req.request_type.upper()}_CANCELLED",
                    approval_req.entity_type,
                    approval_req.entity_id,
                    entity_name=approval_req.entity_name,
                    reason=f"Cancelled by {user.username}: {reason}".strip(),
                )

        return approval_req

