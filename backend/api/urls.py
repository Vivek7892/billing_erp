from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register('users', views.UserViewSet, basename='user')
router.register('categories', views.CategoryViewSet, basename='category')
router.register('suppliers', views.SupplierViewSet, basename='supplier')
router.register('products', views.ProductViewSet, basename='product')
router.register('customers', views.CustomerViewSet, basename='customer')
router.register('purchases', views.PurchaseViewSet, basename='purchase')
router.register('invoices', views.InvoiceViewSet, basename='invoice')
router.register('inventory', views.InventoryViewSet, basename='inventory')
router.register('settings', views.SettingViewSet, basename='setting')
router.register('expenses', views.ExpenseViewSet, basename='expense')
router.register('expense-categories', views.ExpenseCategoryViewSet, basename='expense-category')
router.register('sales-returns', views.SalesReturnViewSet, basename='sales-return')

urlpatterns = [
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/super-admin/login/', views.SuperAdminLoginView.as_view(), name='super-admin-login'),
    path('auth/super-admin/dashboard/', views.SuperAdminDashboardView.as_view(), name='super-admin-dashboard'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('me/', views.MeView.as_view(), name='me-alias'),
    path('me/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('reports/sales/', views.SalesReportView.as_view(), name='sales-report'),
    path('reports/products/', views.ProductReportView.as_view(), name='product-report'),
    path('reports/profit/', views.ProfitReportView.as_view(), name='profit-report'),
    path('reports/gst/', views.GSTReportView.as_view(), name='gst-report'),
    path('reports/customers/', views.CustomerCreditReportView.as_view(), name='customer-credit-report'),
    path('reports/payments/', views.PaymentReportView.as_view(), name='payment-report'),
    path('reports/expenses/', views.ExpenseReportView.as_view(), name='expense-report'),
    path('bills/', views.BillsListView.as_view(), name='bills-list'),
    path('invoices/<int:pk>/pdf/', views.InvoicePDFView.as_view(), name='invoice-pdf'),
    path('invoices/<int:pk>/cancel/', views.CancelInvoiceView.as_view(), name='cancel-invoice'),
    path('invoices/<int:pk>/refund/', views.RefundInvoiceView.as_view(), name='refund-invoice'),
    path('inventory/adjust/', views.StockAdjustView.as_view(), name='stock-adjust'),
    path('inventory/bulk-adjust/', views.BulkStockAdjustView.as_view(), name='bulk-stock-adjust'),
    path('inventory/import/', views.StockImportView.as_view(), name='stock-import'),
    # Keep explicit actions ahead of router detail patterns such as /inventory/<pk>/.
    path('', include(router.urls)),
]
