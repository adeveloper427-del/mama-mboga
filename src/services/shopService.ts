/** The signed-in seller's own shop profile. */
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { OperatingHours, Shop } from '@/types/models';
import { normalizePhone, sanitizeText, validateTime } from '@/utils/validation';

import { fail, request, unwrap } from './api';
import { SHOP_SELECT, toShop } from './mappers';
import { requireUser } from './session';

export async function getMyShop(): Promise<Shop> {
  return request(async () => {
    const me = requireUser('seller');
    const row = unwrap(await supabase.from('sellers').select(SHOP_SELECT).eq('id', me.id).eq('products.is_deleted', false).maybeSingle());
    return row ? toShop(row) : fail('not_found', 'Shop profile not found');
  });
}

export interface ShopUpdate {
  businessName: string;
  description: string;
  area: string;
  addressLine: string;
  landmark?: string;
  phone: string;
  hours: OperatingHours;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryFee: number;
  minOrder: number;
  logoUrl?: string;
  coverUrl?: string;
}

export async function updateMyShop(u: ShopUpdate): Promise<void> {
  return request(async () => {
    const me = requireUser('seller');
    if (u.businessName.trim().length < 3) fail('validation', 'Enter your business name', 'businessName');
    if (!u.area) fail('validation', 'Choose your area', 'area');
    if (u.addressLine.trim().length < 3) fail('validation', 'Enter where your stall/shop is', 'addressLine');
    const phone = normalizePhone(u.phone);
    if (!phone) fail('validation', 'Enter a valid Kenyan phone number', 'phone');
    if (validateTime(u.hours.open) || validateTime(u.hours.close)) fail('validation', 'Enter valid opening hours', 'hours');
    if (u.hours.open >= u.hours.close) fail('validation', 'Closing time must be after opening time', 'hours');
    if (!u.hours.days.length) fail('validation', 'Choose at least one working day', 'days');
    if (!u.offersDelivery && !u.offersPickup) fail('validation', 'Offer delivery, pickup or both', 'fulfilment');
    if (!Number.isFinite(u.deliveryFee) || u.deliveryFee < 0 || u.deliveryFee > 2000) fail('validation', 'Enter a delivery fee between 0 and 2,000', 'deliveryFee');
    if (!Number.isFinite(u.minOrder) || u.minOrder < 0 || u.minOrder > 20000) fail('validation', 'Enter a valid minimum order', 'minOrder');

    unwrap(
      await supabase
        .from('sellers')
        .update({
          business_name: sanitizeText(u.businessName, 60),
          description: sanitizeText(u.description, 500),
          area: u.area,
          address_line: sanitizeText(u.addressLine, 120),
          landmark: u.landmark ? sanitizeText(u.landmark, 120) : null,
          phone,
          open_time: u.hours.open,
          close_time: u.hours.close,
          open_days: [...u.hours.days].sort((a, b) => a - b),
          offers_delivery: u.offersDelivery,
          offers_pickup: u.offersPickup,
          delivery_fee: Math.round(u.deliveryFee),
          min_order: Math.round(u.minOrder),
          logo_url: u.logoUrl ?? null,
          cover_url: u.coverUrl ?? null,
        })
        .eq('id', me.id),
    );
    emit(['sellers']);
  });
}

/** The "Accepting orders" switch on the dashboard. */
export async function setAcceptingOrders(value: boolean): Promise<void> {
  return request(async () => {
    const me = requireUser('seller');
    unwrap(await supabase.from('sellers').update({ accepting_orders: value }).eq('id', me.id));
    emit(['sellers']);
  });
}
