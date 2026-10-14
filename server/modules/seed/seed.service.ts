import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { count } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import {
  categories,
  coupons,
  productVariants,
  products,
  shippingTemplates,
  users,
} from '../../database/schema';

/**
 * 演示数据种子：SEED_DEMO_DATA=true 且数据库为空时写入一次。
 * 演示账号：卖家 seller@example.com / seller123；买家 buyer@example.com / buyer123；优惠码 TEST10（九折）。
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SEED_DEMO_DATA !== 'true') return;

    try {
      const userCount = await this.db.select({ n: count() }).from(users);
      if (Number(userCount[0]?.n ?? 0) > 0) {
        this.logger.log('SEED_DEMO_DATA=true 但数据库已有用户，跳过演示数据写入');
        return;
      }

      await this.seed();
      this.logger.log(
        '演示数据已写入：卖家 seller@example.com / seller123，买家 buyer@example.com / buyer123，优惠码 TEST10（九折）',
      );
    } catch (err) {
      this.logger.error('演示数据写入失败', err instanceof Error ? err.stack : String(err));
    }
  }

  private async seed(): Promise<void> {
    const sellerHash = await bcrypt.hash('seller123', 10);
    const buyerHash = await bcrypt.hash('buyer123', 10);

    await this.db.transaction(async (tx) => {
      const [seller] = await tx
        .insert(users)
        .values({
          email: 'seller@example.com',
          passwordHash: sellerHash,
          name: 'Demo Seller',
          role: 'seller',
        })
        .returning();

      await tx.insert(users).values({
        email: 'buyer@example.com',
        passwordHash: buyerHash,
        name: 'Demo Buyer',
        role: 'buyer',
      });

      await tx.insert(shippingTemplates).values({
        sellerId: seller.id,
        name: '默认运费模板',
        freeShippingThreshold: '100.00',
        baseFee: '5.00',
        extraFeePerUnit: '2.00',
        unitType: 'quantity',
        isDefault: true,
      });

      const [catHome] = await tx
        .insert(categories)
        .values({ nameZh: '家居生活', nameEn: 'Home & Living', slug: 'home-living', sortOrder: 1 })
        .returning();
      const [catOutdoor] = await tx
        .insert(categories)
        .values({ nameZh: '户外运动', nameEn: 'Sports & Outdoors', slug: 'sports-outdoors', sortOrder: 2 })
        .returning();

      const demoProducts = [
        {
          titleZh: '便携折叠水杯 500ml',
          titleEn: 'Portable Folding Cup 500ml',
          descZh: '食品级硅胶，折叠收纳不占空间，适合户外徒步与差旅。',
          descEn: 'Food-grade silicone, folds flat for travel and hiking.',
          categoryId: catOutdoor.id,
          price: '12.90',
          stock: 500,
          weight: '0.300',
        },
        {
          titleZh: '棉麻北欧抱枕套 45x45cm',
          titleEn: 'Linen Cushion Cover 45x45cm',
          descZh: '天然棉麻面料，隐形拉链，机洗可用的北欧风家居单品。',
          descEn: 'Natural linen cotton with hidden zipper, machine washable.',
          categoryId: catHome.id,
          price: '9.50',
          stock: 800,
          weight: '0.200',
        },
      ];

      for (const [index, item] of demoProducts.entries()) {
        const [product] = await tx
          .insert(products)
          .values({
            sellerId: seller.id,
            titleZh: item.titleZh,
            titleEn: item.titleEn,
            descZh: item.descZh,
            descEn: item.descEn,
            categoryId: item.categoryId,
            status: 'active',
            weight: item.weight,
            totalStock: item.stock,
          })
          .returning();

        await tx.insert(productVariants).values({
          productId: product.id,
          sku: `DEMO-${String(index + 1).padStart(3, '0')}`,
          price: item.price,
          stock: item.stock,
          status: 'active',
        });
      }

      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await tx.insert(coupons).values({
        sellerId: seller.id,
        code: 'TEST10',
        type: 'percent',
        value: '10.00',
        totalQuantity: 1000,
        perUserLimit: 1,
        expiresAt,
        active: true,
      });
    });
  }
}
