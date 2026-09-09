/**
 * App-wide constants: route paths, status enums, error messages, currency.
 */

// ─── Route paths (web) ─────────────────────────────────────────

export const ROUTES = {
  // Auth
  ONBOARDING: '/onboarding',
  LOGIN: '/login',
  FACIAL_VERIFY: '/verify/facial',

  // Dashboard
  DASHBOARD: '/',
  TRANSACTIONS: '/transactions',
  TRANSACTION_DETAIL: '/transactions/:id',
  NOTIFICATIONS: '/notifications',
  PROFILE: '/profile',

  // Wallet flows
  SEND_MONEY: '/send',
  CASH_OUT: '/cash-out',
  CASH_IN: '/cash-in',
  PAY_BILL: '/pay-bill',
  BUY_GOODS: '/buy-goods',
};

export const ADMIN_ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  LIVE_FEED: '/feed',
  CASES: '/cases',
  CASE_DETAIL: '/cases/:id',
  ANALYTICS: '/analytics',
};

// ─── API base URLs ──────────────────────────────────────────────

function getBaseUrl(type) {
  const defaultPort = '3001';
  const defaultUrl = `http://localhost:${defaultPort}`;

  try {
    const env = typeof globalThis !== 'undefined' ? globalThis.process?.env : undefined;
    if (env) {
      if (type === 'api') {
        return (
          env.EXPO_PUBLIC_API_URL ||
          env.VITE_API_URL ||
          env.API_URL ||
          defaultUrl
        );
      }
      return (
        env.EXPO_PUBLIC_WS_URL ||
        env.VITE_WS_URL ||
        env.WS_URL ||
        defaultUrl
      );
    }
  } catch {
    // ignore
  }

  return defaultUrl;
}

export const API_BASE_URL = getBaseUrl('api');
export const WS_BASE_URL = getBaseUrl('ws');

// ─── Currency ───────────────────────────────────────────────────

export const CURRENCY = {
  code: 'GHS',
  symbol: 'GH₵',
  locale: 'en-GH',
};

export function formatCurrency(amount, currency) {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : CURRENCY.symbol;
  return `${sym} ${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Error messages ─────────────────────────────────────────────

export const ERRORS = {
  NETWORK: 'Unable to connect. Please check your network and try again.',
  INVALID_PASSWORD: 'Incorrect Password. Please try again.',
  INVALID_PIN: 'Incorrect Password. Please try again.',
  PASSWORD_LOCKED: 'Too many failed attempts. Your account has been temporarily locked.',
  PIN_LOCKED: 'Too many failed attempts. Your account has been temporarily locked.',
  BIOMETRIC_FAILED: 'Biometric verification failed. Please try again.',
  FACIAL_FAILED: 'Facial verification could not be completed.',
  TRANSACTION_BLOCKED: 'This transaction has been blocked for security reasons.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  ACCOUNT_FROZEN: 'Your account has been temporarily frozen. Please contact support.',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction.',
};

// ─── Transaction labels ─────────────────────────────────────────

export const TRANSACTION_TYPE_LABELS = {
  send: 'Send Money',
  receive: 'Cash In',
  cash_out: 'Cash Out',
  cash_in: 'Cash In',
  pay_bill: 'Pay Bill',
  buy_goods: 'Buy Goods',
};

export const TRANSACTION_STATUS_LABELS = {
  completed: 'Completed',
  flagged: 'Flagged',
  blocked: 'Blocked',
  under_review: 'Under review',
  pending: 'Pending',
};

// ─── Detection type labels ──────────────────────────────────────

export const DETECTION_TYPE_LABELS = {
  atod: 'Account takeover',
  transaction_anomaly: 'Transaction anomaly',
};

// ─── Password config ────────────────────────────────────────────

export const PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_ATTEMPTS = 3;
export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 3;
