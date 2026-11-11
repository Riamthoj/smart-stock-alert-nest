/**
 * Enum values are stored as VARCHAR(16) (not native Postgres enums), exactly
 * like the FastAPI version: adding a value never needs an ALTER TYPE.
 */
const values = <T extends Record<string, string>>(e: T) => Object.values(e) as [T[keyof T], ...T[keyof T][]];

export const StoreStatus = { ACTIVE: 'active', PENDING: 'pending', BLOCK: 'block' } as const;
export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus];
export const STORE_STATUSES = values(StoreStatus);

export const AlertStatus = { OPEN: 'open', RESOLVED: 'resolved' } as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];
export const ALERT_STATUSES = values(AlertStatus);

export const AlertType = {
  LOW_STOCK: 'low_stock', // 0 < available_qty <= reorder_level
  OUT_OF_STOCK: 'out_of_stock', // available_qty == 0
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];
export const ALERT_TYPES = values(AlertType);

export const MoveType = {
  IN: 'in', // stock received: purchase, restock, customer return
  OUT: 'out', // stock removed: sale, damaged, expired
  ADJUST: 'adjust', // correction after counting (+ or -)
} as const;
export type MoveType = (typeof MoveType)[keyof typeof MoveType];
export const MOVE_TYPES = values(MoveType);

export const PaymentMethod = { CASH: 'cash', BANK_TRANSFER: 'bank_transfer', QR: 'qr', CARD: 'card' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const PAYMENT_METHODS = values(PaymentMethod);

export const PaymentStatus = {
  PENDING: 'pending', // started, money not confirmed yet
  PAID: 'paid', // money received
  FAILED: 'failed', // never completed (final)
  REFUNDED: 'refunded', // was paid, money given back (final)
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PAYMENT_STATUSES = values(PaymentStatus);

/** pending -> paid | failed ; paid -> refunded ; failed / refunded are final. */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['paid', 'failed'],
  paid: ['refunded'],
  failed: [],
  refunded: [],
};

/** Payments that count towards the sale total. */
export const ACTIVE_PAYMENT_STATUSES: readonly PaymentStatus[] = ['pending', 'paid'];
