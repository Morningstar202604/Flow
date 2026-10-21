import { describe, expect, it } from 'vitest';
import { SHOPPER_TOOLS, getShopperTool } from './shopper-tools';
import { COPILOT_TOOLS } from '../copilot/copilot-tools';

// 行为契约（R8）：买家工具集与卖家工具集完全隔离，买家不可能触达运营/财务工具
describe('shopper tool isolation', () => {
  it('R8: 买家工具里没有任何卖家工具', () => {
    const sellerNames = new Set(COPILOT_TOOLS.map((tool) => tool.name));
    for (const tool of SHOPPER_TOOLS) {
      expect(sellerNames.has(tool.name)).toBe(false);
    }
  });

  it('R8: 买家唯一写工具是 add_to_cart', () => {
    const writeTools = SHOPPER_TOOLS.filter((tool) => tool.kind === 'write');
    expect(writeTools.map((tool) => tool.name)).toEqual(['add_to_cart']);
  });

  it('R8: 未注册工具名查不到（防模型幻觉调用卖家工具）', () => {
    expect(getShopperTool('update_order_status')).toBeUndefined();
    expect(getShopperTool('create_coupon')).toBeUndefined();
    expect(getShopperTool('approve_refund')).toBeUndefined();
    expect(getShopperTool('add_to_cart')).toBeDefined();
  });

  it('R8: add_to_cart 数量上限被约束', () => {
    const addTool = getShopperTool('add_to_cart');
    const quantity = addTool?.params.find((param) => param.name === 'quantity');
    expect(quantity?.min).toBe(1);
    expect(quantity?.max).toBe(20);
  });
});
