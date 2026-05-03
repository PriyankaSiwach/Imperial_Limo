import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const destination = req.nextUrl.searchParams.get("destination");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!origin || !destination || !key) {
    return NextResponse.json({ miles: null }, { status: 400 });
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${key}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ miles: null }, { status: 502 });
  }

  const data = await res.json();
  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK" || !element.distance?.value) {
    return NextResponse.json({ miles: null }, { status: 200 });
  }

  const miles = Number(element.distance.value) / 1609.344;
  return NextResponse.json({ miles: Number.isFinite(miles) ? miles : null });
}
