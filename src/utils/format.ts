import type { OrderStatus, PaymentMethod, PaymentStatus, Unit } from '@/types/models';

export function formatKES(amount: number): string {
  const rounded = Math.round(amount);
  return `KSh ${rounded.toLocaleString('en-KE')}`;
}

/** Compact money for tight spaces: KSh 12.4K */
export function formatKESCompact(amount: number): string {
  if (amount >= 1_000_000) return `KSh ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 10_000) return `KSh ${(amount / 1000).toFixed(1)}K`;
  return formatKES(amount);
}

const UNIT_LABELS: Record<Unit, { one: string; many: string }> = {
  kg: { one: 'kg', many: 'kg' },
  bunch: { one: 'bunch', many: 'bunches' },
  piece: { one: 'piece', many: 'pieces' },
  heap: { one: 'heap', many: 'heaps' },
  dozen: { one: 'dozen', many: 'dozen' },
  tray: { one: 'tray', many: 'trays' },
  gorogoro: { one: 'gorogoro', many: 'gorogoro' },
  packet: { one: 'packet', many: 'packets' },
};

export function unitLabel(unit: Unit, qty = 1): string {
  return qty === 1 ? UNIT_LABELS[unit].one : UNIT_LABELS[unit].many;
}

export function formatQty(qty: number, unit: Unit): string {
  return `${qty} ${unitLabel(unit, qty)}`;
}

export function perUnit(unit: Unit): string {
  return `per ${UNIT_LABELS[unit].one}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** "+254712345678" → "0712 345 678" */
export function formatPhone(phone: string): string {
  const local = phone.startsWith('+254') ? `0${phone.slice(4)}` : phone;
  return local.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Not paid yet',
  pending: 'Awaiting confirmation',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayShort(day: number): string {
  return DAY_SHORT[day] ?? '';
}

/** "06:30" → "6:30 AM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (sorted.join() === '1,2,3,4,5,6') return 'Mon – Sat';
  if (sorted.join() === '1,2,3,4,5') return 'Mon – Fri';
  return sorted.map(dayShort).join(', ');
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
