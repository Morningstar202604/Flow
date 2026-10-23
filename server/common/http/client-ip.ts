interface ClientIpRequest {
  ip?: string;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}

/**
 * 客户端 IP 唯一出口。
 * Express 的 req.ip 已按 TRUST_PROXY 决定是否采信 X-Forwarded-For；
 * 这里不再直接读取该头，避免未配置反代时被伪造来源绕过限流与审计。
 */
export function resolveClientIp(req: ClientIpRequest): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
