import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  console.log("[send-reservation] Route called. GMAIL_USER exists:", Boolean(gmailUser), "GMAIL_APP_PASSWORD exists:", Boolean(gmailPassword));
  if (!gmailUser || !gmailPassword) {
    return NextResponse.json({ error: "Missing GMAIL_USER or GMAIL_APP_PASSWORD" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });
  const body = (await req.json()) as {
    name?: string;
    phone?: string;
    email?: string;
    vehicle?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    date?: string;
    time?: string;
    specialRequests?: string;
    totalPrice?: number;
  };

  const name = body.name?.trim() || "";
  const phone = body.phone?.trim() || "";
  const email = body.email?.trim() || "";
  const vehicle = body.vehicle?.trim() || "";
  const pickupAddress = body.pickupAddress?.trim() || "";
  const dropoffAddress = body.dropoffAddress?.trim() || "";
  const date = body.date?.trim() || "";
  const time = body.time?.trim() || "";
  const specialRequests = body.specialRequests?.trim() || "None";
  const totalPrice = body.totalPrice;

  if (!name || !phone || !email || !vehicle || !pickupAddress || !dropoffAddress || !date || !time || typeof totalPrice !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const adminSend = await transporter.sendMail({
    from: gmailUser,
    to: "reservations.imperiallimo@gmail.com",
    subject: `New Reservation Request — ${vehicle} — ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Reservation Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Vehicle:</strong> ${vehicle}</p>
        <p><strong>Pickup Address:</strong> ${pickupAddress}</p>
        <p><strong>Dropoff Address:</strong> ${dropoffAddress}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Special Requests:</strong> ${specialRequests}</p>
        <p><strong>Total Price (incl. tax):</strong> $${totalPrice}</p>
      </div>
    `,
  });
  console.log("[send-reservation] Admin email response:", adminSend);

  const customerSend = await transporter.sendMail({
    from: gmailUser,
    to: email,
    subject: "Your request has been received — Imperial Limo NY",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Thank you for your reservation request</h2>
        <p>We received your booking details and someone from our team will reach out shortly.</p>
        <p>— Imperial Limo NY team</p>
      </div>
    `,
  });
  console.log("[send-reservation] Customer confirmation response:", customerSend);

  return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[send-reservation] SMTP error:", error);
    const message = error instanceof Error ? error.message : "Failed to send reservation emails";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
