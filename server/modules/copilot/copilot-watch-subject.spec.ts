import { describe, expect, it } from 'vitest';
import { renderSubject } from './copilot-watch.service';
import type { CopilotInsight } from '../../../shared/api.interface';

function insight(severity: CopilotInsight['severity']): CopilotInsight {
  return {
    id: 'x',
    type: 'low_stock',
    severity,
    title: 't',
    detail: 'd',
    suggestion: 's',
    prompt: 'p',
    entityId: 'e',
  };
}

// 行为契约（R23）：邮件主题模板按占位符渲染，且长度受限
describe('renderSubject', () => {
  it('R23: 替换 count / critical / newCount', () => {
    const subject = renderSubject(
      '【Flow 店铺巡检】{{count}} 项待处理（严重 {{critical}} / 新增 {{newCount}}）',
      [insight('critical'), insight('warning'), insight('info')],
      [insight('warning')],
    );
    expect(subject).toBe('【Flow 店铺巡检】3 项待处理（严重 1 / 新增 1）');
  });

  it('R23: 无占位符时原样返回', () => {
    expect(renderSubject('纯文本主题', [insight('warning')], [])).toBe('纯文本主题');
  });

  it('R23: 超长主题被截断到 200 字符', () => {
    const long = 'x'.repeat(500);
    expect(renderSubject(long, [], []).length).toBe(200);
  });
});
