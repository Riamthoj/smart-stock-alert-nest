import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';

export interface ErrorContext {
  method?: string;
  path?: string;
  requestId?: string;
  account?: string; // "owner:<id>" / "user:<id>"
  storeId?: string;
}

/**
 * Tells a human when something is BROKEN: unexpected 500 errors and crashes
 * are posted to a Discord channel (ALERT_DISCORD_WEBHOOK_URL).
 *
 * Expected errors (404, 409, 422...) are normal traffic and never alert.
 *
 * Anti-spam: the same error (type + message + route) is sent at most once per
 * ALERT_DEDUPE_SECONDS; the next alert reports how many were suppressed.
 * Sending never blocks or breaks the request: it's fire-and-forget with a
 * 3 s timeout, and failures are only logged.
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly lastSent = new Map<string, { at: number; suppressed: number }>();

  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean {
    return !!this.config.alerting.discordWebhookUrl;
  }

  /** Report an unexpected error. Never throws, never awaits the network. */
  reportError(error: unknown, context: ErrorContext = {}): void {
    if (!this.enabled) return;
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${err.name}|${safeText(err.message)}|${context.method ?? ''} ${routeShape(context.path)}`;

    const now = Date.now();
    const previous = this.lastSent.get(key);
    if (previous && now - previous.at < this.config.alerting.dedupeSeconds * 1000) {
      previous.suppressed++;
      return;
    }
    this.lastSent.set(key, { at: now, suppressed: 0 });
    if (this.lastSent.size > 500) this.lastSent.delete(this.lastSent.keys().next().value!); // bounded memory

    void this.send(err, context, previous?.suppressed ?? 0);
  }

  private async send(err: Error, ctx: ErrorContext, suppressed: number): Promise<void> {
    const { app } = this.config;
    const stack = safeText(err.stack ?? '').split('\n').slice(0, 8).join('\n');
    const cause = err.cause instanceof Error ? safeText(`${err.cause.name}: ${err.cause.message}`) : undefined;
    const fields = [
      cause && { name: 'Cause', value: cause.slice(0, 1000), inline: false },
      ctx.method && { name: 'Request', value: `\`${ctx.method} ${ctx.path}\``, inline: false },
      ctx.account && { name: 'Account', value: ctx.account, inline: true },
      ctx.storeId && { name: 'Store', value: ctx.storeId, inline: true },
      ctx.requestId && { name: 'Request ID', value: `\`${ctx.requestId}\``, inline: false },
      suppressed > 0 && { name: 'Repeats', value: `+${suppressed} more since the last alert`, inline: false },
    ].filter(Boolean);

    const body = {
      username: app.name,
      embeds: [
        {
          title: `🔥 ${err.name}: ${safeText(err.message)}`.slice(0, 256),
          description: `\`\`\`\n${stack}\n\`\`\``.slice(0, 4000),
          color: 0xe03131,
          fields,
          footer: { text: `${app.name} v${app.version} · ${app.environment}` },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      const res = await fetch(this.config.alerting.discordWebhookUrl!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) this.logger.warn(`Discord alert rejected: HTTP ${res.status}`);
    } catch (e) {
      this.logger.warn(`Discord alert failed: ${(e as Error).message}`);
    }
  }
}

/**
 * Never ship query PARAMETERS to a chat channel: driver errors append them
 * ("...\nparams: admin,$argon2id$..."), and they can hold password hashes or
 * personal data. The SQL text itself is kept (useful, it contains no values).
 */
function safeText(text: string): string {
  return text.replace(/\n\s*params:[^\n]*/g, '\n[params redacted]');
}

/** /api/v1/products/0190.../image ->/api/v1/products/:id/image (dedupe per route, not per record). */
function routeShape(path = ''): string {
  return path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}
