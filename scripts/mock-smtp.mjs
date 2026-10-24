#!/usr/bin/env node
/**
 * 极简 SMTP 收集器（演示/联调用）：接收邮件内容并写入 /_mail 观测端点。
 * 实现 EHLO / AUTH PLAIN / MAIL FROM / RCPT TO / DATA / QUIT 的最小可用子集。
 *
 * 用法：node scripts/mock-smtp.mjs（默认 2525）
 */
import { createServer } from 'node:net';

const PORT = Number(process.env.SMTP_PORT ?? 2525);
const mails = [];

const server = createServer((socket) => {
  let inData = false;
  let buffer = '';
  let current = { from: '', to: [], data: '' };
  socket.write('220 mock-smtp ready\r\n');

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (inData) {
        if (line === '.') {
          inData = false;
          mails.push({ ...current, at: new Date().toISOString() });
          current = { from: '', to: [], data: '' };
          socket.write('250 OK queued\r\n');
        } else {
          current.data += `${line}\n`;
        }
        continue;
      }
      const upper = line.toUpperCase();
      if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
        socket.write('250-mock-smtp\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
      } else if (upper.startsWith('AUTH')) {
        socket.write('235 Authentication successful\r\n');
      } else if (upper.startsWith('MAIL FROM')) {
        current.from = line.slice(10).replace(/[<>]/g, '').trim();
        socket.write('250 OK\r\n');
      } else if (upper.startsWith('RCPT TO')) {
        current.to.push(line.slice(8).replace(/[<>]/g, '').trim());
        socket.write('250 OK\r\n');
      } else if (upper === 'DATA') {
        inData = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (upper === 'QUIT') {
        socket.write('221 Bye\r\n');
        socket.end();
      } else if (upper === 'RSET') {
        current = { from: '', to: [], data: '' };
        socket.write('250 OK\r\n');
      } else {
        socket.write('250 OK\r\n');
      }
    }
  });
  socket.on('error', () => {});
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-smtp] listening on 127.0.0.1:${PORT} (${mails.length} mails)`);
});

export { mails };
