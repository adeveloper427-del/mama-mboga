import type { Role } from '@/types/models';

/** Landing screen for each role after sign-in. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'seller':
      return '/seller/dashboard';
    case 'admin':
      return '/admin/overview';
    default:
      return '/home';
  }
}
