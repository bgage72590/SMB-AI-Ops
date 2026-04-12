import { NextResponse } from "next/server";
import { getUserById } from "./store";
import { checkTrial } from "./trial";
import type { User } from "./types";

/**
 * Check if the user's trial has expired. Returns a 403 response if writes
 * are blocked, or null if the user is allowed to proceed.
 */
export function trialGuardResponse(user: User): NextResponse | null {
  const fresh = getUserById(user.id);
  if (!fresh) return null;

  const trial = checkTrial(fresh);
  if (trial.writeBlocked) {
    return NextResponse.json(
      {
        error: "trial_expired",
        message:
          "Your free trial has ended. Upgrade your plan to continue.",
      },
      { status: 403 }
    );
  }
  return null;
}
