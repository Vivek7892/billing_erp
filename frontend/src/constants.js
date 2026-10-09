/**
 * ShopEase POS - Application Constants
 * Standardized constants for user roles, payment methods, invoice/payment lifecycle, and inventory stock states.
 */

export const ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  ACCOUNTANT: 'accountant',
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
  PAYMENT_METHODS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  STOCK_STATUS,
}

