import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const body = (await req.json()) as { vehicleName?: string; finalPrice?: number };
  const vehicleName = body.vehicleName?.trim();
  const finalPrice = body.finalPrice;

  if (!vehicleName || typeof finalPrice !== "number" || finalPrice <= 0) {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || "http://localhost:3000";
  const unitAmount = Math.round(finalPrice * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${vehicleName} Ride`,
            description: "Imperial Limousine booking",
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/confirmation`,
  });

  return NextResponse.json({ sessionId: session.id, url: session.url });
}
