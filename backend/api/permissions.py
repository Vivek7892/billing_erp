from rest_framework.permissions import BasePermission

ADMIN_ROLES = ('owner', 'admin')
CASHIER_ROLES = ('cashier',)
ALL_STAFF_ROLES = ('owner', 'admin', 'cashier')
MANAGER_ROLES = ADMIN_ROLES
FINANCE_ROLES = ADMIN_ROLES


class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ADMIN_ROLES


# Alias kept for backward compat with existing views
IsAdmin = IsOwnerOrAdmin


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ADMIN_ROLES


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.role in ALL_STAFF_ROLES
        return request.user.role in ADMIN_ROLES


class IsManagerOrReadOnly(BasePermission):
    """All staff may read; admins and owners may mutate operational data."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.role in ALL_STAFF_ROLES
        return request.user.role in ADMIN_ROLES


class IsFinanceStaff(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ADMIN_ROLES


class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ADMIN_ROLES


class IsCashierOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ALL_STAFF_ROLES


class IsAccountantOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ADMIN_ROLES
