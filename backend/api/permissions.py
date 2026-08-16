from rest_framework.permissions import BasePermission

ADMIN_ROLES = ('owner', 'admin')
MANAGER_ROLES = ('owner', 'admin', 'manager')
ALL_STAFF_ROLES = ('owner', 'admin', 'manager', 'cashier', 'accountant')


class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ADMIN_ROLES


# Alias kept for backward compat with existing views
IsAdmin = IsOwnerOrAdmin


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in MANAGER_ROLES


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.role in ALL_STAFF_ROLES
        return request.user.role in ADMIN_ROLES


class IsCashierOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ALL_STAFF_ROLES


class IsAccountantOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('owner', 'admin', 'accountant')
