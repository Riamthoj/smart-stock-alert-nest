import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/app-config.js';
import { AlertingService } from './alerting.service.js';

const config = (webhook?: string) =>
  ({
    alerting: { discordWebhookUrl: webhook, dedupeSeconds: 300 },
    app: { name: 'Test API', version: '1.0.0', environment: 'test' },
  }) as unknown as AppConfig;

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('AlertingService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing without a webhook', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    new AlertingService(config()).reportError(new Error('boom'));
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a Discord embed with the request context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    new AlertingService(config('https://discord.test/hook')).reportError(new TypeError('x is undefined'), {
      method: 'POST',
      path: '/api/v1/sales',
      requestId: 'req-1',
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.embeds[0].title).toContain('TypeError: x is undefined');
    expect(JSON.stringify(body.embeds[0].fields)).toContain('POST /api/v1/sales');
  });

  it('sends the same error on the same route only once per window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const alerting = new AlertingService(config('https://discord.test/hook'));
    for (let i = 0; i < 5; i++) {
      // different record ids, same route shape -> one alert
      alerting.reportError(new Error('boom'), { method: 'GET', path: `/api/v1/products/0190f4c2-7d3a-7b4e-9a1c-2f8e5d6c7b8${i}` });
    }
    alerting.reportError(new Error('other'), { method: 'GET', path: '/api/v1/products' });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never sends query parameters (may hold password hashes), but shows the cause', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const err = new Error('Failed query: update "users" set "password_hash" = $1\nparams: $argon2id$v=19$secret,u1', {
      cause: new Error('database "x" does not exist'),
    });
    new AlertingService(config('https://discord.test/hook')).reportError(err);
    await flush();
    const sent = fetchMock.mock.calls[0][1].body as string;
    expect(sent).not.toContain('argon2id');
    expect(sent).toContain('params redacted');
    expect(sent).toContain('does not exist');
  });

  it('never throws when Discord is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(() => new AlertingService(config('https://discord.test/hook')).reportError(new Error('boom'))).not.toThrow();
    await flush();
  });
});
