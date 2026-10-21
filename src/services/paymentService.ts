/**
 * Payments are pluggable providers behind one interface.
 *
 * Cash works today. M-Pesa is wired up structurally but disabled: the real
 * flow must run on the backend, because the Daraja consumer key/secret and
 * passkey can never ship inside the app:
 *
 *   1. App → Supabase Edge Function `mpesa-stk-push` { orderId, phone }
 *   2. Edge Function → Daraja STK Push → customer's phone shows the M-Pesa PIN prompt
 *   3. Daraja → Edge Function callback → payments row set to 'paid' / 'failed'
 *   4. The app receives the change through Realtime and the order screen updates itself.
 *
 * Enabling it = deploy that function, set appConfig.features.mpesa and implement initiate() below.
 */
import { appConfig } from '@/config';
import { supabase } from '@/backend/supabase';
import type { Fulfilment, Payment, PaymentMethod, PaymentStatus } from '@/types/models';

import { fail, request, unwrap } from './api';
import { toPayment } from './mappers';
import { requireUser } from './session';

export interface PaymentInitResult {
  status: PaymentStatus;
  reference?: string;
}

export interface PaymentProvider {
  method: PaymentMethod;
  label: (fulfilment: Fulfilment) => string;
  description: (fulfilment: Fulfilment) => string;
  icon: string;
  available: boolean;
  unavailableReason?: string;
  initiate(order: { id: string; code: string }, opts: { phone?: string }): Promise<PaymentInitResult>;
}

const cashProvider: PaymentProvider = {
  method: 'cash',
  label: (f) => (f === 'delivery' ? 'Cash on delivery' : 'Pay at pickup'),
  description: (f) =>
    f === 'delivery' ? 'Pay the rider in cash when your order arrives' : 'Pay the seller in cash when you collect',
  icon: 'cash-outline',
  available: true,
  // Nothing to collect up front; the seller confirms payment on completion.
  initiate: async () => ({ status: 'unpaid' }),
};

const mpesaProvider: PaymentProvider = {
  method: 'mpesa',
  label: () => 'M-Pesa',
  description: () => 'Pay instantly with an M-Pesa prompt on your phone',
  icon: 'phone-portrait-outline',
  available: appConfig.features.mpesa,
  unavailableReason: 'Coming soon',
  initiate: async () => {
    // Implemented on the backend; see the header comment.
    return fail('not_configured', 'M-Pesa payments are not available yet. Please choose cash.');
  },
};

export const paymentProviders: PaymentProvider[] = [cashProvider, mpesaProvider];

export function getProvider(method: PaymentMethod): PaymentProvider {
  const p = paymentProviders.find((x) => x.method === method);
  if (!p || !p.available) return fail('not_configured', 'This payment method is not available yet.');
  return p;
}

export async function getPaymentForOrder(orderId: string): Promise<Payment | null> {
  return request(async () => {
    requireUser();
    // RLS returns the payment only to the order's customer, seller or an admin.
    const row = unwrap(await supabase.from('payments').select('*').eq('order_id', orderId).maybeSingle());
    return row ? toPayment(row) : null;
  });
}
