import { NextRequest, NextResponse } from "next/server";
import { fetchDrivingMiles } from "@/lib/driving-miles";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const destination = req.nextUrl.searchParams.get("destination");

  if (!origin || !destination) {
    return NextResponse.json({ miles: null }, { status: 400 });
  }

  const referer = req.headers.get("referer") || req.headers.get("origin");
  const miles = await fetchDrivingMiles(origin, destination, { referer });
  return NextResponse.json({ miles });
}
