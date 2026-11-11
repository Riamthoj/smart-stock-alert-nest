import { fromCents, moneyToNumber, toCents } from '../../common/utils/money.js';
import type { SaleWithDetails } from '../../database/repositories/sales.repository.js';
import { PaymentStatus } from '../../database/schema/index.js';

/**
 * A receipt as the API returns it. Money as JSON numbers; computed fields:
 *   line_total  = qty * unit_price
 *   paid_amount = SUM(payments with status "paid")
 *   balance_due = total - paid_amount
 */
export function presentSale(sale: SaleWithDetails) {
  const paidCents = sale.payments
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  return {
    id: sale.id,
    store_id: sale.store_id,
    owner_id: sale.owner_id,
    customer_id: sale.customer_id,
    receipt_number: sale.receipt_number,
    subtotal: moneyToNumber(sale.subtotal),
    discount: moneyToNumber(sale.discount),
    tax: moneyToNumber(sale.tax),
    total: moneyToNumber(sale.total),
    paid_amount: moneyToNumber(fromCents(paidCents)),
    balance_due: moneyToNumber(fromCents(toCents(sale.total) - paidCents)),
    sold_at: sale.sold_at,
    items: sale.items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      qty: i.qty,
      unit_price: moneyToNumber(i.unit_price),
      cost_price: moneyToNumber(i.cost_price),
      line_total: moneyToNumber(fromCents(i.qty * toCents(i.unit_price))),
    })),
    created_at: sale.created_at,
  };
}
