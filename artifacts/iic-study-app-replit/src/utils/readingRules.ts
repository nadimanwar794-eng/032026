import { User, SystemSettings } from '../types';

/**
 * Checks whether sequential page reading rule is strictly enforced for a user.
 * - Free users: ALWAYS ON (must read previous page completely to unlock next page).
 * - Basic & Ultra users: Configurable (can turn ON/OFF themselves in Profile Settings).
 * - Admin / Sub-Admin: Always bypassed.
 */
export const isSequentialReadingEnforced = (
  user?: User | null,
  settings?: SystemSettings | null
): boolean => {
  if (!user) return true;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
  if (isAdmin) return false;

  const isVip = Boolean(
    user.isPremium && (user.subscriptionLevel === 'BASIC' || user.subscriptionLevel === 'ULTRA')
  );

  if (isVip) {
    // Basic & Ultra users can toggle it OFF for themselves in Settings
    if (user.sequentialReadingDisabled === true) {
      return false;
    }
    // Default for VIP: Follows admin setting or default ON
    return settings?.enforceSequentialPages !== false;
  }

  // Free users: ALWAYS ON
  return true;
};
