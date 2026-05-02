import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { clampDurationHours, computeTotalUsd, isVehicleKey, totalUsdToStripeCents } from "@/lib/booking-price";
import { sendReservationEmails } from "@/lib/reservation-mail";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }

  const body = (await req.json()) as {
    paymentIntentId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    vehicleKey?: string;
    vehicleLabel?: string;
    pickupLocation?: string;
    dropoffLocation?: string;
    pickupDate?: string;
    pickupTime?: string;
    specialRequests?: string;
    tripType?: string;
    durationHours?: number;
  };

  const paymentIntentId = body.paymentIntentId?.trim();
  const firstName = body.firstName?.trim() || "";
  const lastName = body.lastName?.trim() || "";
  const phone = body.phone?.trim() || "";
  const email = body.email?.trim() || "";
  const vehicleKey = body.vehicleKey?.trim() || "";
  const vehicleLabel = body.vehicleLabel?.trim() || "";
  const pickupLocation = body.pickupLocation?.trim() || "";
  const dropoffLocation = body.dropoffLocation?.trim() || "";
  const pickupDate = body.pickupDate?.trim() || "";
  const pickupTime = body.pickupTime?.trim() || "";
  const specialRequests = body.specialRequests?.trim() || "None";
  const tripType = body.tripType === "hourly" ? "hourly" : "oneway";

  if (!paymentIntentId || !firstName || !lastName || !phone || !email) {
    return NextResponse.json({ error: "Missing contact or payment information" }, { status: 400 });
  }
  if (!isVehicleKey(vehicleKey) || !vehicleLabel) {
    return NextResponse.json({ error: "Invalid vehicle" }, { status: 400 });
  }
  if (!pickupLocation || !pickupDate || !pickupTime) {
    return NextResponse.json({ error: "Incomplete trip details" }, { status: 400 });
  }
  if (tripType === "oneway" && !dropoffLocation) {
    return NextResponse.json({ error: "Incomplete trip details" }, { status: 400 });
  }

  const expectedUsd =
    tripType === "hourly"
      ? await computeTotalUsd({
          tripType: "hourly",
          durationHours: clampDurationHours(Number(body.durationHours)),
          vehicleKey,
          pickupLocation,
        })
      : await computeTotalUsd({
          pickupLocation,
          dropoffLocation,
          vehicleKey,
        });
  const expectedCents = totalUsdToStripeCents(expectedUsd);

  const stripe = new Stripe(stripeKey);
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return NextResponse.json({ error: "Invalid payment reference" }, { status: 400 });
  }

  if (pi.status !== "succeeded") {
    return NextResponse.json({ error: "Payment has not completed successfully" }, { status: 400 });
  }

  if (pi.amount !== expectedCents) {
    return NextResponse.json({ error: "Payment amount does not match booking" }, { status: 400 });
  }

  try {
    await sendReservationEmails({
      name: `${firstName} ${lastName}`.trim(),
      phone,
      email,
      vehicle: vehicleLabel,
      pickupAddress: pickupLocation,
      dropoffAddress: tripType === "hourly" ? "Hourly as-directed (see duration)" : dropoffLocation,
      date: pickupDate,
      time: pickupTime,
      specialRequests,
      totalPrice: expectedUsd,
      tripType,
      durationHours: tripType === "hourly" ? clampDurationHours(Number(body.durationHours)) : undefined,
    });
  } catch (e) {
    console.error("[finalize-paid-reservation] email", e);
    const message = e instanceof Error ? e.message : "Failed to send confirmation email";
    return NextResponse.json(
      { error: `Payment succeeded but email failed: ${message}. Please contact us with your receipt.` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
