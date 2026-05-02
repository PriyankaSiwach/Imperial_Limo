import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { clampDurationHours, computeTotalUsd, isVehicleKey, totalUsdToStripeCents } from "@/lib/booking-price";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }

  const body = (await req.json()) as {
    tripType?: string;
    pickupLocation?: string;
    dropoffLocation?: string;
    durationHours?: number;
    vehicleKey?: string;
  };

  const pickup = body.pickupLocation?.trim() || "";
  const dropoff = body.dropoffLocation?.trim() || "";
  const vehicleKey = body.vehicleKey?.trim() || "";
  const tripType = body.tripType === "hourly" ? "hourly" : "oneway";

  if (!isVehicleKey(vehicleKey)) {
    return NextResponse.json({ error: "Invalid booking parameters" }, { status: 400 });
  }

  if (tripType === "hourly") {
    if (!pickup) {
      return NextResponse.json({ error: "Pick-up location is required" }, { status: 400 });
    }
  } else if (!pickup || !dropoff) {
    return NextResponse.json({ error: "Pick-up and drop-off are required" }, { status: 400 });
  }

  try {
    const totalUsd =
      tripType === "hourly"
        ? await computeTotalUsd({
            tripType: "hourly",
            durationHours: clampDurationHours(Number(body.durationHours)),
            vehicleKey,
            pickupLocation: pickup,
          })
        : await computeTotalUsd({ pickupLocation: pickup, dropoffLocation: dropoff, vehicleKey });
    const amountCents = totalUsdToStripeCents(totalUsd);

    if (amountCents < 50) {
      return NextResponse.json({ error: "Amount too small" }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        vehicleKey,
        tripType,
        pickup: pickup.slice(0, 400),
        dropoff: tripType === "hourly" ? `hourly:${clampDurationHours(Number(body.durationHours))}` : dropoff.slice(0, 400),
      },
      description: `Imperial Limousine — ${vehicleKey}`,
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json({ error: "No client secret" }, { status: 500 });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amountCents,
    });
  } catch (e) {
    console.error("[create-payment-intent]", e);
    const message = e instanceof Error ? e.message : "Failed to create payment";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
