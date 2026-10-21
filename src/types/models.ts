/**
 * Domain models. These mirror the PostgreSQL tables in supabase/schema.sql
 * (camelCase here, snake_case in the database), so swapping the local data
 * store for Supabase only changes the service layer.
 */

export type ID = string;
/** ISO-8601 timestamp string. */
export type Timestamp = string;

// ─── Users ──────────────────────────────────────────────────────────────────

export type Role = 'customer' | 'seller' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export interface User {
  id: ID;
  role: Role;
  fullName: string;
  email: string;
  phone: string; // stored normalised: +2547XXXXXXXX
  avatarUrl?: string;
  /** Service area the user shops in / sells from (e.g. "Kilimani"). */
  area?: string;
  status: AccountStatus;
  createdAt: Timestamp;
}

export interface OperatingHours {
  open: string; // "06:30"
  close: string; // "19:00"
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
}

export interface SellerProfile {
  /** Same as the owning user's id (one shop per seller). */
  id: ID;
  businessName: string;
  description: string;
  logoUrl?: string;
  coverUrl?: string;
  area: string;
  addressLine: string;
  landmark?: string;
  phone: string;
  hours: OperatingHours;
  /** Manual switch: the seller can pause orders (e.g. sold out for the day). */
  acceptingOrders: boolean;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryFee: number;
  minOrder: number;
  verified: boolean;
  rating: number;
  ratingCount: number;
  createdAt: Timestamp;
}

/** Seller profile joined with live computed state for display. */
export interface Shop extends SellerProfile {
  ownerName: string;
  isOpenNow: boolean;
  productCount: number;
  status: AccountStatus;
}

export interface Address {
  id: ID;
  userId: ID;
  label: string; // Home, Work…
  area: string;
  addressLine: string;
  landmark?: string;
  phone: string;
  isDefault: boolean;
  createdAt: Timestamp;
}

// ─── Catalogue ──────────────────────────────────────────────────────────────

export interface Category {
  id: ID;
  name: string;
  swahili: string;
  icon: string; // Ionicons glyph name
  color: string;
  tint: string;
  imageUrl?: string;
  sortOrder: number;
}

export const UNITS = ['kg', 'bunch', 'piece', 'heap', 'dozen', 'tray', 'gorogoro', 'packet'] as const;
export type Unit = (typeof UNITS)[number];

export interface Product {
  id: ID;
  sellerId: ID;
  categoryId: ID;
  name: string;
  description: string;
  price: number; // KSh per unit
  unit: Unit;
  stock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  /** Seller's manual availability switch (independent of stock). */
  isAvailable: boolean;
  isDeleted: boolean;
  soldCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unavailable';

/** Product joined with the data a customer needs to see. */
export interface ProductView extends Product {
  sellerName: string;
  sellerArea: string;
  sellerRating: number;
  sellerOpen: boolean;
  categoryName: string;
  stockState: StockState;
}

export type InventoryReason =
  | 'initial'
  | 'restock'
  | 'adjustment'
  | 'spoilage'
  | 'order_reserved'
  | 'order_released';

export interface StockMovement {
  id: ID;
  productId: ID;
  sellerId: ID;
  change: number; // + adds stock, − removes stock
  balanceAfter: number;
  reason: InventoryReason;
  note?: string;
  orderId?: ID;
  createdAt: Timestamp;
}

// ─── Orders & payments ──────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type Fulfilment = 'delivery' | 'pickup';
export type PaymentMethod = 'cash' | 'mpesa';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface AddressSnapshot {
  label: string;
  area: string;
  addressLine: string;
  landmark?: string;
  phone: string;
}

export interface StatusEvent {
  status: OrderStatus;
  at: Timestamp;
  note?: string;
}

export interface Order {
  id: ID;
  code: string; // human-friendly reference, e.g. MM-10024
  customerId: ID;
  sellerId: ID;
  status: OrderStatus;
  fulfilment: Fulfilment;
  deliveryAddress?: AddressSnapshot;
  note?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** True once stock has been deducted for this order (on acceptance). */
  stockReserved: boolean;
  history: StatusEvent[];
  cancelReason?: string;
  reviewed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderItem {
  id: ID;
  orderId: ID;
  productId: ID;
  productName: string;
  imageUrl?: string;
  unit: Unit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDetails extends Order {
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  shopName: string;
  shopPhone: string;
  shopArea: string;
  shopAddress: string;
  shopLogoUrl?: string;
}

export interface Payment {
  id: ID;
  orderId: ID;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  /** Provider reference, e.g. M-Pesa receipt number, once integrated. */
  reference?: string;
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Engagement ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'order_new'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_status'
  | 'order_completed'
  | 'order_cancelled'
  | 'low_stock'
  | 'out_of_stock'
  | 'message'
  | 'review'
  | 'system';

export interface AppNotification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  orderId?: ID;
  productId?: ID;
  conversationId?: ID;
  read: boolean;
  createdAt: Timestamp;
}

export interface Conversation {
  id: ID;
  customerId: ID;
  sellerId: ID;
  lastMessage: string;
  lastMessageAt: Timestamp;
  unreadByCustomer: number;
  unreadBySeller: number;
  createdAt: Timestamp;
}

export interface ConversationView extends Conversation {
  title: string; // the other party's name
  avatarUrl?: string;
  unread: number; // for the viewing user
}

export interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  body: string;
  createdAt: Timestamp;
}

export type FavoriteTarget = 'product' | 'seller';

export interface Favorite {
  id: ID;
  userId: ID;
  targetType: FavoriteTarget;
  targetId: ID;
  createdAt: Timestamp;
}

export interface Review {
  id: ID;
  orderId: ID;
  customerId: ID;
  sellerId: ID;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: Timestamp;
}
