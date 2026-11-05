from rest_framework.permissions import BasePermission

ADMIN_ROLES = ('owner', 'admin')
CASHIER_ROLES = ('cashier',)
ALL_STAFF_ROLES = ('owner', 'admin', 'cashier')
MANAGER_ROLES = ADMIN_ROLES
FINANCE_ROLES = ADMIN_ROLES


def is_active_business_member(user):
    """Verify user is authenticated, active, and attached to a business."""
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return getattr(user, 'business_id', None) is not None


class HasBusinessPermission(BasePermission):
    """
    Check if the authenticated user has a specific business permission.
    Owner role automatically grants all permissions.
    """
    required_permission = None

    def __init__(self, required_permission=None):
        if required_permission:
            self.required_permission = required_permission

    def has_permission(self, request, view):
        if not is_active_business_member(request.user):
            return False
        if request.user.is_superuser or request.user.role == 'owner':
            return True
        perm = getattr(view, 'required_permission', self.required_permission)
        if not perm:
            # Check action map if available on viewset
            action = getattr(view, 'action', None)
            action_perms = getattr(view, 'action_permissions', {})
            perm = action_perms.get(action)
        if not perm:
            return True
        return request.user.has_permission(perm)


class IsOwner(BasePermission):
    """Only the verified business owner has access."""
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role == 'owner' or request.user.is_superuser)


class IsOwnerOrAdmin(BasePermission):
    """Owner or Admin role."""
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role in ADMIN_ROLES or request.user.is_superuser)


IsAdmin = IsOwnerOrAdmin


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role in ADMIN_ROLES or request.user.is_superuser)


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not is_active_business_member(request.user):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.role in ALL_STAFF_ROLES or request.user.is_superuser
        return request.user.role in ADMIN_ROLES or request.user.is_superuser


class IsManagerOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not is_active_business_member(request.user):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.role in ALL_STAFF_ROLES or request.user.is_superuser
        return request.user.role in ADMIN_ROLES or request.user.is_superuser


class IsFinanceStaff(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role in ADMIN_ROLES or request.user.is_superuser)


class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role in ADMIN_ROLES or request.user.is_superuser)


class IsCashierOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role in ALL_STAFF_ROLES or request.user.is_superuser)


class IsAccountantOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (request.user.role in ADMIN_ROLES or request.user.is_superuser)


# ---------------------------------------------------------------------------
# Fine-grained RBAC permission classes
# ---------------------------------------------------------------------------

class CanManageUsers(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('users.manage') or request.user.is_superuser
        )


class CanViewUsers(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('users.view') or request.user.has_permission('users.manage') or request.user.is_superuser
        )


class CanViewReports(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('reports.view') or request.user.is_superuser
        )


class CanViewProfitReport(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('reports.profit') or request.user.is_superuser
        )


class CanManageSettings(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('settings.manage') or request.user.is_superuser
        )


class CanViewSettings(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('settings.view') or request.user.has_permission('settings.manage') or request.user.is_superuser
        )


class CanAdjustStock(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('stock.adjust') or request.user.is_superuser
        )


class CanCancelInvoice(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('invoice.cancel') or request.user.is_superuser
        )


class CanRefundPayment(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('payment.refund') or request.user.is_superuser
        )


class CanViewAudit(BasePermission):
    def has_permission(self, request, view):
        return is_active_business_member(request.user) and (
            request.user.role == 'owner' or request.user.has_permission('audit.view') or request.user.is_superuser
        )
