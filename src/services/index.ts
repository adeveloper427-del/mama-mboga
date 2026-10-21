/**
 * The app's API surface. Screens and hooks import from here only — never from
 * src/backend — so replacing the local store with Supabase is contained to
 * this folder.
 */
export * as addresses from './addressService';
export * as admin from './adminService';
export * as auth from './authService';
export * as catalog from './catalogService';
export * as favorites from './favoriteService';
export * as inventory from './inventoryService';
export * as location from './locationService';
export * as messages from './messageService';
export * as notifications from './notificationService';
export * as orders from './orderService';
export * as payments from './paymentService';
export * as products from './productService';
export * as reviews from './reviewService';
export * as shop from './shopService';
export * as stats from './statsService';
export * as storage from './storageService';
export { ApiError, toApiError } from './api';
export type { ErrorCode } from './api';
