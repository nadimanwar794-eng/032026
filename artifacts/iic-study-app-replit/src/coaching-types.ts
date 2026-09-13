// IIC Coaching Ecosystem — Core Types

export type CoachingRole = 'COACHING_SUPER_ADMIN' | 'COACHING_ADMIN' | 'COACHING_SUB_ADMIN';

export interface CoachingSession {
  id: string;
  coachingId: string;
  name: string;       // e.g. "2024-25", "2025-26"
  startDate: string;  // ISO date
  endDate: string;    // ISO date
  active: boolean;
  createdAt: string;
}

export type CoachingSubscriptionTier = 'WEEKLY' | 'MONTHLY' | '3_MONTHLY' | 'YEARLY';

export const COACHING_SUBSCRIPTION_PLANS: Record<CoachingSubscriptionTier, { label: string; days: number; price: number }> = {
  WEEKLY:    { label: 'Weekly',    days: 7,   price: 200  },
  MONTHLY:   { label: 'Monthly',   days: 30,  price: 500  },
  '3_MONTHLY': { label: '3 Monthly', days: 90,  price: 1400 },
  YEARLY:    { label: 'Yearly',    days: 365, price: 5000 },
};

export interface CoachingSubscription {
  status: 'active' | 'inactive' | 'suspended';
  tier?: CoachingSubscriptionTier;     // subscription plan tier
  monthlyAmount: number;               // kept for backward compat
  paidUntil?: string;                  // ISO date
  lastPaidDate?: string;
  lastPaidAmount?: number;
  paymentNotes?: string;
  assignedAt?: string;
}

export interface CoachingCentre {
  id: string;
  name: string;
  code: string;          // short code e.g. "SUCCESS_PT"
  emoji?: string;
  address?: string;
  phone?: string;
  adminEmail: string;    // primary admin email
  adminUid?: string;     // firebase auth uid of admin
  tagline?: string;
  bannerColor?: string;  // hex color
  subscription: CoachingSubscription;
  active: boolean;
  locked?: boolean;
  lockCode?: string;
  lockCodeActive?: boolean;
  createdAt: string;
  createdBy: string;     // super admin uid
  totalStudents?: number;
}

export interface CoachingUserProfile {
  uid: string;
  coachingId: string;
  role: CoachingRole;
  name: string;
  email: string;
  createdAt: string;
}
