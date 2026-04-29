import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  console.log("[send-contact] Route called. GMAIL_USER exists:", Boolean(gmailUser), "GMAIL_APP_PASSWORD exists:", Boolean(gmailPassword));
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

  const body = (await req.json()) as { name?: string; email?: string; subject?: string; message?: string };
  const name = body.name?.trim() || "";
  const email = body.email?.trim() || "";
  const subject = body.subject?.trim() || "";
  const message = body.message?.trim() || "";

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const adminSend = await transporter.sendMail({
    from: gmailUser,
    to: "imperiallimony@gmail.com",
    subject: `New Contact Message — ${subject} — ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br/>${message.replace(/\n/g, "<br/>")}</p>
      </div>
    `,
  });
  console.log("[send-contact] Admin email response:", adminSend);

  const customerSend = await transporter.sendMail({
    from: gmailUser,
    to: email,
    subject: "Your request has been received — Imperial Limo NY",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Thank you for contacting Imperial Limo NY</h2>
        <p>We received your message and someone from our team will reach out shortly.</p>
        <p>— Imperial Limo NY team</p>
      </div>
    `,
  });
  console.log("[send-contact] Customer confirmation response:", customerSend);

  return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[send-contact] SMTP error:", error);
    const message = error instanceof Error ? error.message : "Failed to send contact emails";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
