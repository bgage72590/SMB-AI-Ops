import type { User } from "./types";

export interface TrialStatus {
  /** User is on an active paid plan (not trial). */
  isPaid: boolean;
  /** User has an active trial that hasn't expired. */
  isTrialing: boolean;
  /** Trial has expired and user has not paid. */
  isExpired: boolean;
  /** Days remaining on trial. 0 if expired or paid. */
  daysRemaining: number;
  /** Whether write operations should be blocked. */
  writeBlocked: boolean;
}

export function checkTrial(user: User): TrialStatus {
  const isPaid =
    user.subscriptionStatus === "active" ||
    user.planTier === "starter" ||
    user.planTier === "pro";

  if (isPaid) {
    return {
      isPaid: true,
      isTrialing: false,
      isExpired: false,
      daysRemaining: 0,
      writeBlocked: false,
    };
  }

  if (!user.trialEndsAt) {
    return {
      isPaid: false,
      isTrialing: false,
      isExpired: false,
      daysRemaining: 0,
      writeBlocked: false,
    };
  }

  const now = Date.now();
  const endsAt = new Date(user.trialEndsAt).getTime();
  const msRemaining = endsAt - now;

  if (msRemaining <= 0) {
    return {
      isPaid: false,
      isTrialing: false,
      isExpired: true,
      daysRemaining: 0,
      writeBlocked: true,
    };
  }

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return {
    isPaid: false,
    isTrialing: true,
    isExpired: false,
    daysRemaining,
    writeBlocked: false,
  };
}
