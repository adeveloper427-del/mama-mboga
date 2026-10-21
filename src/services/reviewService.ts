import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { Review } from '@/types/models';
import { sanitizeText } from '@/utils/validation';

import { fail, request, rpc, unwrap } from './api';
import { toReview } from './mappers';
import { requireUser } from './session';

/** Customers review a shop once per completed order; the database updates the shop's rating. */
export async function submitReview(orderId: string, rating: number, comment: string): Promise<Review> {
  return request(async () => {
    requireUser('customer');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('validation', 'Choose a rating from 1 to 5 stars', 'rating');
    await rpc('submit_review', { p_order_id: orderId, p_rating: rating, p_comment: sanitizeText(comment, 500) });
    emit(['reviews', 'orders', 'sellers']);
    const row = unwrap(await supabase.from('reviews').select('*').eq('order_id', orderId).single());
    return toReview(row);
  });
}

export async function listMyShopReviews(): Promise<Review[]> {
  return request(async () => {
    const me = requireUser('seller');
    const rows = unwrap(await supabase.from('reviews').select('*').eq('seller_id', me.id).order('created_at', { ascending: false }));
    return rows.map(toReview);
  });
}
