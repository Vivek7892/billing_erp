/**
 * Standardized formatting utilities for DreamWithTech Billing ERP.
 * Ensures consistent Indian number format, currency, decimal precision,
 * quantities, percentages, and dates across all pages and components.
 *
 * Requirements:
 * - Currency:    ₹1,25,000.00
 * - Numbers:     1,25,000
 * - Decimals:    125.50
 * - Percentages: 18.00%
 * - Quantities:  1,250.500
 * - Dates:       02 Nov 2026
 */

/**
 * Parses any value (string, number, Decimal-like) safely to a numeric primitive.
 * Returns NaN if unparseable.
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return isNaN(value) ? NaN : value;
  // Strip existing currency symbols, commas and spaces
  const cleanStr = String(value).replace(/[₹$,\s]/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? NaN : parsed;
}

/**
 * Format currency in Indian notation: ₹1,25,000.00
 * Handles negative values cleanly: -₹1,25,000.00
 */
export function formatCurrency(value, options = {}) {
  const num = parseNumber(value);
  const minDec = options.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 2;
  const maxDec = options.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 2;
  const symbol = options.showSymbol === false ? '' : '₹';

  if (isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : `${symbol}0.00`;
  }

  const isNeg = num < 0;
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec,
  });

  return isNeg ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Format integer or general number with Indian comma grouping: 1,25,000
 */
export function formatNumber(value, options = {}) {
  const num = parseNumber(value);
  const decimals = options.decimals !== undefined ? options.decimals : 0;

  if (isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : '0';
  }

  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format decimal numbers with specified precision: 125.50
 */
export function formatDecimal(value, decimals = 2, options = {}) {
  const num = parseNumber(value);

  if (isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : (0).toFixed(decimals);
  }

  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage with Indian comma grouping and % suffix: 18.00%
 */
export function formatPercent(value, decimals = 2, options = {}) {
  const num = parseNumber(value);

  if (isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : `0.${'0'.repeat(decimals)}%`;
  }

  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${formatted}%`;
}

/**
 * Format item/stock quantity with 3-decimal precision: 1,250.500
 */
export function formatQuantity(value, decimals = 3, options = {}) {
  const num = parseNumber(value);

  if (isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : (0).toFixed(decimals);
  }

  const minDec = options.minDecimals !== undefined
    ? options.minDecimals
    : (options.trimZeros && Number.isInteger(num) ? 0 : decimals);

  return num.toLocaleString('en-IN', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format date in Indian standard format: 02 Nov 2026
 */
export function formatDate(dateInput, options = {}) {
  if (!dateInput) return options.fallback || '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return options.fallback || '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-IN', { month: 'short' });
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Format date and time in Indian format: 02 Nov 2026, 09:04 AM
 */
export function formatDateTime(dateInput, options = {}) {
  if (!dateInput) return options.fallback || '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return options.fallback || '—';

  const datePart = formatDate(d, options);
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  if (options.seconds) {
    timeOptions.second = '2-digit';
  }
  const timePart = d.toLocaleTimeString('en-IN', timeOptions);

  return `${datePart}, ${timePart}`;
}

/**
 * Format time only: 09:04 AM
 */
export function formatTime(dateInput, options = {}) {
  if (!dateInput) return options.fallback || '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return options.fallback || '—';

  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  if (options.seconds) {
    timeOptions.second = '2-digit';
  }
  return d.toLocaleTimeString('en-IN', timeOptions);
}

// Convenient shorthand aliases
export const fmtCurrency = formatCurrency;
export const fmtNumber = formatNumber;
export const fmtDecimal = formatDecimal;
export const fmtPercent = formatPercent;
export const fmtQuantity = formatQuantity;
export const fmtDate = formatDate;
export const fmtDateTime = formatDateTime;
export const fmtTime = formatTime;

export default {
  parseNumber,
  formatCurrency,
  formatNumber,
  formatDecimal,
  formatPercent,
  formatQuantity,
  formatDate,
  formatDateTime,
  formatTime,
  fmtCurrency,
  fmtNumber,
  fmtDecimal,
  fmtPercent,
  fmtQuantity,
  fmtDate,
  fmtDateTime,
  fmtTime,
};

