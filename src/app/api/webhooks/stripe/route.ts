import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured, priceToPlanTier } from "@/lib/stripe";
import { getUserByStripeCustomerId, updateUserStripe } from "@/lib/store";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.customer && session.subscription) {
        const customerId = typeof session.customer === "string"
          ? session.customer
          : session.customer.id;
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price?.id;
        const tier = priceId ? priceToPlanTier(priceId) : "starter";

        const user = getUserByStripeCustomerId(customerId);
        if (user) {
          updateUserStripe(user.id, {
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId ?? null,
            subscriptionStatus: sub.status,
            planTier: tier,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string"
        ? sub.customer
        : sub.customer.id;

      const user = getUserByStripeCustomerId(customerId);
      if (!user) break;

      if (sub.status === "canceled" || sub.status === "unpaid") {
        updateUserStripe(user.id, {
          subscriptionStatus: sub.status,
          planTier: "free",
          stripeSubscriptionId: null,
          stripePriceId: null,
        });
      } else {
        const priceId = sub.items.data[0]?.price?.id;
        const tier = priceId ? priceToPlanTier(priceId) : user.planTier;
        updateUserStripe(user.id, {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId ?? null,
          subscriptionStatus: sub.status,
          planTier: tier,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
      if (customerId) {
        const user = getUserByStripeCustomerId(customerId);
        if (user) {
          updateUserStripe(user.id, { subscriptionStatus: "past_due" });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
