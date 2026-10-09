import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc } from 'drizzle-orm';
import { addresses } from '@server/database/schema';

export interface CreateAddressDto {
  label?: string;
  receiverName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isDefault?: boolean;
}

export interface UpdateAddressDto {
  label?: string;
  receiverName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isDefault?: boolean;
}

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async create(userId: string, dto: CreateAddressDto) {
    // If isDefault is true, reset all other addresses for this user
    if (dto.isDefault) {
      await this.db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));
    }

    const inserted = await this.db
      .insert(addresses)
      .values({
        userId,
        label: dto.label ?? 'Home',
        receiverName: dto.receiverName,
        phone: dto.phone ?? null,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2 ?? null,
        city: dto.city,
        state: dto.state ?? null,
        country: dto.country ?? 'CN',
        zipCode: dto.zipCode ?? null,
        isDefault: dto.isDefault ?? false,
      })
      .returning();

    return inserted[0];
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    // Verify the address belongs to the user
    await this.getOne(userId, id);

    // If setting this address to default, reset all others
    if (dto.isDefault) {
      await this.db
        .update(addresses)
        .set({ isDefault: false })
        .where(
          and(
            eq(addresses.userId, userId),
            eq(addresses.isDefault, true),
          ),
        );
    }

    const setValues: Record<string, unknown> = {};
    if (dto.label !== undefined) setValues.label = dto.label;
    if (dto.receiverName !== undefined) setValues.receiverName = dto.receiverName;
    if (dto.phone !== undefined) setValues.phone = dto.phone;
    if (dto.addressLine1 !== undefined) setValues.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) setValues.addressLine2 = dto.addressLine2;
    if (dto.city !== undefined) setValues.city = dto.city;
    if (dto.state !== undefined) setValues.state = dto.state;
    if (dto.country !== undefined) setValues.country = dto.country;
    if (dto.zipCode !== undefined) setValues.zipCode = dto.zipCode;
    if (dto.isDefault !== undefined) setValues.isDefault = dto.isDefault;

    // Only update if there are fields to update
    if (Object.keys(setValues).length > 0) {
      setValues.updatedAt = new Date();
      const updated = await this.db
        .update(addresses)
        .set(setValues)
        .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
        .returning();

      if (updated.length === 0) {
        throw new NotFoundException('地址不存在');
      }
      return updated[0];
    }

    // No fields updated, return existing
    return this.getOne(userId, id);
  }

  async remove(userId: string, id: string) {
    // Verify the address belongs to the user
    await this.getOne(userId, id);

    await this.db
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)));

    return { success: true };
  }

  async list(userId: string) {
    return this.db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  }

  async getOne(userId: string, id: string) {
    const rows = await this.db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)));

    if (rows.length === 0) {
      throw new NotFoundException('地址不存在');
    }
    return rows[0];
  }

  async setDefault(userId: string, id: string) {
    // Verify the address belongs to the user
    await this.getOne(userId, id);

    // Reset all addresses for this user to non-default
    await this.db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));

    // Set the selected address as default
    const updated = await this.db
      .update(addresses)
      .set({ isDefault: true })
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
      .returning();

    return updated[0];
  }
}
