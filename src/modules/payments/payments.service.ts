import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, notFound } from '../../common/errors/app-error.js';
import { fromCents, moneyToNumber, toCents, type Cents } from '../../common/utils/money.js';
import { DatabaseService } from '../../database/database.service.js';
import { PaymentsRepository, SalesRepository } from '../../database/repositories/sales.repository.js';
import {
  ACTIVE_PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
  type Payment,
  type PaymentStatus,
  type Sale,
} from '../../database/schema/index.js';
import type { Scope } from '../auth/scope.js';
import { PaymentCreateDto, PaymentsQueryDto } from './dto/payment.dto.js';
import { msg } from '../../common/i18n/message.js';

export const presentPayment = (p: Payment) => ({
  id: p.id,
  sale_id: p.sale_id,
  payment_method: p.payment_method,
  amount: moneyToNumber(p.amount),
  status: p.status,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

/**
 * Payments of a sale (split tender: cash + QR...).
 *   status machine: pending -> paid | failed ; paid -> refunded
 *   pending + paid payments may NEVER exceed the sale total
 * The sale row is locked (FOR UPDATE) while checking, so two cashiers adding
 * payments at the same moment can't overpay a receipt.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly payments: PaymentsRepository,
    private readonly sales: SalesRepository,
  ) {}

  list(scope: Scope, query: PaymentsQueryDto) {
    return this.payments.listFiltered(
      {
        saleId: query.sale_id,
        status: query.status,
        paymentMethod: query.payment_method,
        storeId: scope.listStore(query.store_id),
      },
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  /** The sale, if the account may see it (another store's sale -> 404). */
  private async visibleSale(scope: Scope, saleId: string, { lock = false } = {}): Promise<Sale> {
    const sale = lock ? await this.sales.findByIdForUpdate(saleId) : await this.sales.findById(saleId);
    return scope.visible(sale, 'Sale', saleId);
  }

  async get(scope: Scope, id: string): Promise<Payment> {
    const payment = await this.payments.findById(id);
    if (!payment) throw notFound('Payment', id);
    scope.visible(await this.sales.findById(payment.sale_id), 'Payment', id); // visibility = the sale's store
    return payment;
  }

  private async assertNotOverTotal(sale: Sale, adding: Cents, excludeId?: string): Promise<void> {
    const already = await this.payments.activeTotal(sale.id, excludeId);
    const total = toCents(sale.total);
    if (already + adding > total) {
      throw new BusinessRuleError(
        msg`Payment too large: sale total ${fromCents(total)}, already paid/pending ${fromCents(already)}, remaining ${fromCents(total - already)}`,
      );
    }
  }

  async create(scope: Scope, dto: PaymentCreateDto): Promise<Payment> {
    const payment = await this.database.transaction(async () => {
      const sale = await this.visibleSale(scope, dto.sale_id, { lock: true });
      await this.assertNotOverTotal(sale, toCents(dto.amount));
      return this.payments.insert({ ...dto, amount: fromCents(toCents(dto.amount)) });
    });
    this.logger.log(`Payment ${payment.id} ${payment.payment_method} ${payment.amount} for sale ${payment.sale_id}`);
    return payment;
  }

  async setStatus(scope: Scope, id: string, status: PaymentStatus): Promise<Payment> {
    const existing = await this.get(scope, id);
    return this.database.transaction(async () => {
      const sale = await this.visibleSale(scope, existing.sale_id, { lock: true });
      const payment = (await this.payments.findById(id))!; // re-read under the lock
      if (!PAYMENT_TRANSITIONS[payment.status].includes(status)) {
        throw new BusinessRuleError(msg`Cannot change payment status from '${payment.status}' to '${status}'`);
      }
      // Re-activating money (e.g. failed -> paid is not allowed today, but stay safe) must still fit the total.
      if (ACTIVE_PAYMENT_STATUSES.includes(status) && !ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
        await this.assertNotOverTotal(sale, toCents(payment.amount), payment.id);
      }
      const updated = await this.payments.update(id, { status });
      this.logger.log(`Payment ${id} status ${payment.status} -> ${status}`);
      return updated;
    });
  }
}
