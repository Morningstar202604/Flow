import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotNotifyService } from './copilot-notify.service';

// 行为契约（R18）：通知失败绝不抛出，未配置时明确返回
describe('CopilotNotifyService', () => {
  let service: CopilotNotifyService;

  beforeEach(() => {
    service = new CopilotNotifyService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('R18: 未配置渠道时返回 ok=false 且不调用 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await service.send({ kind: 'none' }, 'hello');
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R18: 非 http(s) 地址被拒绝', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await service.send({ kind: 'webhook', url: 'file:///etc/passwd' }, 'hello');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('http(s)');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R18: 成功发送时携带 text 与企微/飞书兼容字段', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    const result = await service.send({ kind: 'webhook', url: 'https://example.com/hook' }, '巡检摘要');
    expect(result.ok).toBe(true);

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.text).toBe('巡检摘要');
    expect(body.content.text).toBe('巡检摘要');
  });

  it('R18: 上游非 2xx 时不抛错，返回失败原因', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    const result = await service.send({ kind: 'webhook', url: 'https://example.com/hook' }, 'x');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('500');
  });

  it('R18: 网络异常被吞掉并返回失败原因（不影响巡检）', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await service.send({ kind: 'webhook', url: 'https://example.com/hook' }, 'x');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ECONNREFUSED');
  });
});
