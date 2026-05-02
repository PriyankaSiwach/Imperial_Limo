import nodemailer from "nodemailer";

export type ReservationMailPayload = {
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  pickupAddress: string;
  dropoffAddress: string;
  date: string;
  time: string;
  specialRequests: string;
  totalPrice: number;
  /** When set, booking is hourly as-directed instead of point-to-point. */
  tripType?: "oneway" | "hourly";
  durationHours?: number;
};

export async function sendReservationEmails(payload: ReservationMailPayload): Promise<void> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPassword) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
  });

  const {
    name,
    phone,
    email,
    vehicle,
    pickupAddress,
    dropoffAddress,
    date,
    time,
    specialRequests,
    totalPrice,
    tripType,
    durationHours,
  } = payload;

  const serviceLine =
    tripType === "hourly" && durationHours != null
      ? `<p><strong>Service:</strong> Hourly as-directed (${escapeHtml(String(durationHours))} hours)</p>`
      : `<p><strong>Dropoff Address:</strong> ${escapeHtml(dropoffAddress)}</p>`;

  await transporter.sendMail({
    from: gmailUser,
    to: "reservations.imperiallimo@gmail.com",
    subject: `New Reservation Request — ${vehicle} — ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Reservation Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Vehicle:</strong> ${escapeHtml(vehicle)}</p>
        <p><strong>Pickup Address:</strong> ${escapeHtml(pickupAddress)}</p>
        ${serviceLine}
        <p><strong>Date:</strong> ${escapeHtml(date)}</p>
        <p><strong>Time:</strong> ${escapeHtml(time)}</p>
        <p><strong>Special Requests:</strong> ${escapeHtml(specialRequests)}</p>
        <p><strong>Total Price (incl. tax):</strong> $${totalPrice}</p>
      </div>
    `,
  });

  await transporter.sendMail({
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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
