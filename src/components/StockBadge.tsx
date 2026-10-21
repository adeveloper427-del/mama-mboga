import type { StockState } from '@/types/models';

import { Badge, type Tone } from './ui';

const MAP: Record<StockState, { label: string; tone: Tone; icon: 'checkmark-circle' | 'alert-circle' | 'close-circle' | 'pause-circle' }> = {
  in_stock: { label: 'In stock', tone: 'success', icon: 'checkmark-circle' },
  low_stock: { label: 'Low stock', tone: 'warning', icon: 'alert-circle' },
  out_of_stock: { label: 'Sold out', tone: 'danger', icon: 'close-circle' },
  unavailable: { label: 'Unavailable', tone: 'neutral', icon: 'pause-circle' },
};

export function StockBadge({ state, hideInStock, size }: { state: StockState; hideInStock?: boolean; size?: 'sm' | 'md' }) {
  if (hideInStock && state === 'in_stock') return null;
  const m = MAP[state];
  return <Badge label={m.label} tone={m.tone} icon={m.icon} size={size} />;
}
