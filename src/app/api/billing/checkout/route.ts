import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getUserById, updateUserStripe } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute({ rate: { bucket: "billing", max: 10, windowMs: 10 * 60_000 } }, async (request, user) => {
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
});
