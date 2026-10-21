/**
 * Database rows (snake_case) → app models (camelCase), plus the select
 * strings that fetch each view with its related rows in one request.
 */
import type {
  Address,
  AppNotification,
  Category,
  Conversation,
  Message,
  Order,
  OrderDetails,
  OrderItem,
  Payment,
  Product,
  ProductView,
  Review,
  SellerProfile,
  Shop,
  StockMovement,
  User,
} from '@/types/models';

import { isShopOpenNow, stockStateOf } from './domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const hhmm = (t: string | null | undefined) => (t ?? '00:00').slice(0, 5);

export function toUser(r: Row): User {
  return {
    id: r.id,
    role: r.role,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone ?? '',
    avatarUrl: opt(r.avatar_url),
    area: opt(r.area),
    status: r.status,
    createdAt: r.created_at,
  };
}

export function toSellerProfile(r: Row): SellerProfile {
  return {
    id: r.id,
    businessName: r.business_name,
    description: r.description ?? '',
    logoUrl: opt(r.logo_url),
    coverUrl: opt(r.cover_url),
    area: r.area,
    addressLine: r.address_line,
    landmark: opt(r.landmark),
    phone: r.phone,
    hours: { open: hhmm(r.open_time), close: hhmm(r.close_time), days: r.open_days ?? [] },
    acceptingOrders: r.accepting_orders,
    offersDelivery: r.offers_delivery,
    offersPickup: r.offers_pickup,
    deliveryFee: r.delivery_fee,
    minOrder: r.min_order,
    verified: r.verified,
    rating: Number(r.rating ?? 0),
    ratingCount: r.rating_count ?? 0,
    createdAt: r.created_at,
  };
}

/** A shop with its owner and live product count. */
export const SHOP_SELECT = '*, owner:profiles(full_name, status), products(count)';

export function toShop(r: Row): Shop {
  const s = toSellerProfile(r);
  return {
    ...s,
    ownerName: r.owner?.full_name ?? '',
    status: r.owner?.status ?? 'suspended',
    isOpenNow: isShopOpenNow(s),
    productCount: r.products?.[0]?.count ?? 0,
  };
}

export function toCategory(r: Row): Category {
  return {
    id: r.id,
    name: r.name,
    swahili: r.swahili,
    icon: r.icon,
    color: r.color,
    tint: r.tint,
    imageUrl: opt(r.image_url),
    sortOrder: r.sort_order,
  };
}

export function toProduct(r: Row): Product {
  return {
    id: r.id,
    sellerId: r.seller_id,
    categoryId: r.category_id,
    name: r.name,
    description: r.description ?? '',
    price: r.price,
    unit: r.unit,
    stock: r.stock,
    lowStockThreshold: r.low_stock_threshold,
    imageUrl: opt(r.image_url),
    isAvailable: r.is_available,
    isDeleted: r.is_deleted,
    soldCount: r.sold_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** A product with the shop and category details a customer sees. */
export const PRODUCT_SELECT =
  '*, seller:sellers(business_name, area, rating, accepting_orders, open_time, close_time, open_days), category:categories(name)';

export function toProductView(r: Row): ProductView {
  const p = toProduct(r);
  const s = r.seller;
  return {
    ...p,
    sellerName: s?.business_name ?? 'Unknown shop',
    sellerArea: s?.area ?? '',
    sellerRating: Number(s?.rating ?? 0),
    sellerOpen: s
      ? isShopOpenNow({
          acceptingOrders: s.accepting_orders,
          hours: { open: hhmm(s.open_time), close: hhmm(s.close_time), days: s.open_days ?? [] },
        })
      : false,
    categoryName: r.category?.name ?? '',
    stockState: stockStateOf(p),
  };
}

export function toStockMovement(r: Row): StockMovement {
  return {
    id: r.id,
    productId: r.product_id,
    sellerId: r.seller_id,
    change: r.change,
    balanceAfter: r.balance_after,
    reason: r.reason,
    note: opt(r.note),
    orderId: opt(r.order_id),
    createdAt: r.created_at,
  };
}

export function toOrder(r: Row): Order {
  return {
    id: r.id,
    code: r.code,
    customerId: r.customer_id,
    sellerId: r.seller_id,
    status: r.status,
    fulfilment: r.fulfilment,
    deliveryAddress: opt(r.delivery_address),
    note: opt(r.note),
    subtotal: r.subtotal,
    deliveryFee: r.delivery_fee,
    total: r.total,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    stockReserved: r.stock_reserved,
    history: r.history ?? [],
    cancelReason: opt(r.cancel_reason),
    reviewed: r.reviewed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toOrderItem(r: Row): OrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    productName: r.product_name,
    imageUrl: opt(r.image_url),
    unit: r.unit,
    unitPrice: r.unit_price,
    quantity: r.quantity,
    lineTotal: r.line_total,
  };
}

/** An order with its items, customer and shop. */
export const ORDER_SELECT =
  '*, items:order_items(*), customer:profiles(full_name, phone), shop:sellers(business_name, phone, area, address_line, landmark, logo_url, cover_url)';

export function toOrderDetails(r: Row): OrderDetails {
  const shop = r.shop;
  return {
    ...toOrder(r),
    items: (r.items ?? []).map(toOrderItem),
    customerName: r.customer?.full_name ?? 'Customer',
    customerPhone: r.customer?.phone ?? '',
    shopName: shop?.business_name ?? 'Shop',
    shopPhone: shop?.phone ?? '',
    shopArea: shop?.area ?? '',
    shopAddress: shop ? [shop.address_line, shop.landmark].filter(Boolean).join(' · ') : '',
    shopLogoUrl: opt(shop?.logo_url ?? shop?.cover_url),
  };
}

export function toPayment(r: Row): Payment {
  return {
    id: r.id,
    orderId: r.order_id,
    method: r.method,
    amount: r.amount,
    status: r.status,
    reference: opt(r.reference),
    phone: opt(r.phone),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toAddress(r: Row): Address {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    area: r.area,
    addressLine: r.address_line,
    landmark: opt(r.landmark),
    phone: r.phone,
    isDefault: r.is_default,
    createdAt: r.created_at,
  };
}

export function toNotification(r: Row): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    orderId: opt(r.order_id),
    productId: opt(r.product_id),
    conversationId: opt(r.conversation_id),
    read: r.read,
    createdAt: r.created_at,
  };
}

export function toConversation(r: Row): Conversation {
  return {
    id: r.id,
    customerId: r.customer_id,
    sellerId: r.seller_id,
    lastMessage: r.last_message,
    lastMessageAt: r.last_message_at,
    unreadByCustomer: r.unread_by_customer,
    unreadBySeller: r.unread_by_seller,
    createdAt: r.created_at,
  };
}

export function toMessage(r: Row): Message {
  return { id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at };
}

export function toReview(r: Row): Review {
  return {
    id: r.id,
    orderId: r.order_id,
    customerId: r.customer_id,
    sellerId: r.seller_id,
    customerName: r.customer_name,
    rating: r.rating,
    comment: r.comment ?? '',
    createdAt: r.created_at,
  };
}
