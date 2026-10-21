import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { Address } from '@/types/models';
import { normalizePhone, sanitizeText } from '@/utils/validation';

import { fail, request, unwrap } from './api';
import { toAddress } from './mappers';
import { requireUser } from './session';

export interface AddressInput {
  label: string;
  area: string;
  addressLine: string;
  landmark?: string;
  phone: string;
  isDefault: boolean;
}

function validate(input: AddressInput) {
  if (!input.label.trim()) fail('validation', 'Give this address a name, e.g. Home', 'label');
  if (!input.area) fail('validation', 'Choose your area', 'area');
  if (input.addressLine.trim().length < 5) fail('validation', 'Enter your building, house or street', 'addressLine');
  if (!normalizePhone(input.phone)) fail('validation', 'Enter a valid phone number for the rider', 'phone');
}

async function mine(userId: string): Promise<Address[]> {
  return unwrap(await supabase.from('addresses').select('*').eq('user_id', userId)).map(toAddress);
}

export async function listAddresses(): Promise<Address[]> {
  return request(async () => {
    const me = requireUser('customer');
    return (await mine(me.id)).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label));
  });
}

export async function saveAddress(input: AddressInput, id?: string): Promise<Address> {
  return request(async () => {
    const me = requireUser('customer');
    validate(input);
    const existing = await mine(me.id);
    if (id && !existing.some((a) => a.id === id)) fail('not_found', 'Address not found');
    const makeDefault = input.isDefault || existing.length === 0 || (existing.length === 1 && existing[0].id === id);
    if (makeDefault) {
      unwrap(await supabase.from('addresses').update({ is_default: false }).eq('user_id', me.id).eq('is_default', true));
    }
    const values = {
      label: sanitizeText(input.label, 30),
      area: input.area,
      address_line: sanitizeText(input.addressLine, 150),
      landmark: input.landmark ? sanitizeText(input.landmark, 100) : null,
      phone: normalizePhone(input.phone)!,
      is_default: makeDefault,
    };
    const row = unwrap(
      id
        ? await supabase.from('addresses').update(values).eq('id', id).select('*').single()
        : await supabase.from('addresses').insert({ ...values, user_id: me.id }).select('*').single(),
    );
    emit(['addresses']);
    return toAddress(row);
  });
}

export async function deleteAddress(id: string): Promise<void> {
  return request(async () => {
    const me = requireUser('customer');
    const removed = unwrap(await supabase.from('addresses').delete().eq('id', id).eq('user_id', me.id).select('is_default'));
    if (removed[0]?.is_default) {
      const next = (await mine(me.id))[0];
      if (next) unwrap(await supabase.from('addresses').update({ is_default: true }).eq('id', next.id));
    }
    emit(['addresses']);
  });
}
