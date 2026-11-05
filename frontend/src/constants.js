/**
 * DreamWithTech POS - Application Constants
 * Standardized constants for user roles, permissions, payment methods, invoice/payment lifecycle, and inventory stock states.
 */

export const ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  CASHIER: 'cashier',
})

export const PERMISSIONS = Object.freeze({
  INVOICE_CREATE: 'invoice.create',
  INVOICE_VIEW: 'invoice.view',
  INVOICE_EDIT: 'invoice.edit',
  INVOICE_CANCEL: 'invoice.cancel',
  PAYMENT_COLLECT: 'payment.collect',
  PAYMENT_REFUND: 'payment.refund',
  PRODUCT_VIEW: 'product.view',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  STOCK_VIEW: 'stock.view',
  STOCK_ADJUST: 'stock.adjust',
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_CREATE: 'purchase.create',
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  REPORTS_VIEW: 'reports.view',
  REPORTS_PROFIT: 'reports.profit',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
})

export const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  ONLINE: 'online',
  CREDIT: 'credit',
  RAZORPAY: 'razorpay',
})

export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
})

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  PARTIAL: 'partial',
  CREDIT: 'credit',
  REFUNDED: 'refunded',
})

export const STOCK_STATUS = Object.freeze({
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
})

export default {
  ROLES,
  PERMISSIONS,
  PAYMENT_METHODS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  STOCK_STATUS,
}
