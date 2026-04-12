import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getUserById, updateUserStripe } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = requireUserForApi();
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

  const body = await request.json().catch(() => ({}));
  const priceId = body.priceId as string | undefined;
  if (!priceId) {
    return NextResponse.json({ error: "missing_price_id" }, { status: 400 });
  }

  const stripe = getStripe();
  const fresh = getUserById(user.id);
  if (!fresh) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  let customerId = fresh.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: fresh.email,
      name: fresh.name,
      metadata: { userId: fresh.id },
    });
    customerId = customer.id;
    updateUserStripe(fresh.id, { stripeCustomerId: customerId });
  }

  const origin = new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/settings?billing=canceled`,
    metadata: { userId: fresh.id },
  });

  return NextResponse.json({ url: session.url });
}
