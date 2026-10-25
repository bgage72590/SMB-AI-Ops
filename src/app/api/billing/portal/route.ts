import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getUserById } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 }
    );
  }

  const fresh = getUserById(user.id);
  if (!fresh?.stripeCustomerId) {
    return NextResponse.json(
      { error: "no_stripe_customer" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: fresh.stripeCustomerId,
    return_url: `${origin}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
