import { describe, expect, it } from 'vitest';
import { resolveClientIp } from './client-ip';

describe('client-ip', () => {
  it('R3: 优先使用 Express 解析后的 req.ip', () => {
    expect(resolveClientIp({ ip: '203.0.113.9' })).toBe('203.0.113.9');
  });

  it('R3: 未配置 TRUST_PROXY 时伪造的 X-Forwarded-For 不参与解析', () => {
    const req = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(resolveClientIp(req)).toBe('127.0.0.1');
  });

  it('R3: 无 ip 时回退 socket 地址', () => {
    expect(resolveClientIp({ socket: { remoteAddress: '10.0.0.5' } })).toBe('10.0.0.5');
  });

  it('R3: 完全缺失时返回 unknown', () => {
    expect(resolveClientIp({})).toBe('unknown');
  });
});
