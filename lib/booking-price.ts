/** Shared server/client-safe pricing for reservations (must match confirmation UI). */

export type VehicleKey = "eclass" | "sclass" | "escalade" | "suburban" | "bmw7";

const FLAT_RATES = {
  jfk: { eclass: 130, escalade: 210, suburban: 180, sclass: 280, bmw7: 280 },
  ewr: { eclass: 130, escalade: 210, suburban: 180, sclass: 280, bmw7: 280 },
  hpn: { eclass: 220, sclass: 380, suburban: 300, escalade: 300, bmw7: 380 },
  lga: { eclass: 110, sclass: 220, escalade: 170, suburban: 150, bmw7: 220 },
} as const;

const TAX_MULTIPLIER = 1.08;

const PER_MILE: Record<VehicleKey, number> = {
  eclass: 4,
  sclass: 7,
  escalade: 5.5,
  suburban: 5,
  bmw7: 7,
};

function containsManhattan(text: string): boolean {
  return text.toLowerCase().includes("manhattan");
}

function detectAirport(text: string): keyof typeof FLAT_RATES | null {
  const value = text.toLowerCase();
  if (value.includes("jfk") || value.includes("john f. kennedy")) return "jfk";
  if (value.includes("ewr") || value.includes("newark")) return "ewr";
  if (value.includes("hpn") || value.includes("white plains") || value.includes("westchester")) return "hpn";
  if (value.includes("lga") || value.includes("laguardia")) return "lga";
  return null;
}

export function detectFlatRoute(pickup: string, dropoff: string): keyof typeof FLAT_RATES | null {
  const pickupAirport = detectAirport(pickup);
  const dropoffAirport = detectAirport(dropoff);
  const pickupIsManhattan = containsManhattan(pickup);
  const dropoffIsManhattan = containsManhattan(dropoff);

  if (pickupAirport && dropoffIsManhattan) return pickupAirport;
  if (dropoffAirport && pickupIsManhattan) return dropoffAirport;
  return null;
}

async function fetchDrivingMiles(origin: string, destination: string): Promise<number | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) return null;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${key}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    rows?: { elements?: { status: string; distance?: { value: number } }[] }[];
  };
  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK" || !element.distance?.value) return null;

  const miles = Number(element.distance.value) / 1609.344;
  return Number.isFinite(miles) ? miles : null;
}

/** Total charged in USD (integer dollars after tax), matching confirmation page. */
export async function computeTotalUsd(params: {
  pickupLocation: string;
  dropoffLocation: string;
  vehicleKey: VehicleKey;
}): Promise<number> {
  const routeKey = detectFlatRoute(params.pickupLocation, params.dropoffLocation);
  if (routeKey) {
    const flat = FLAT_RATES[routeKey][params.vehicleKey];
    return Math.round(flat * TAX_MULTIPLIER);
  }

  const miles = await fetchDrivingMiles(params.pickupLocation, params.dropoffLocation);
  const m = miles ?? 0;
  const rate = PER_MILE[params.vehicleKey];
  const estimated = Math.max(95, Math.round(m * rate));
  return Math.round(estimated * TAX_MULTIPLIER);
}

export function isVehicleKey(v: string): v is VehicleKey {
  return v === "eclass" || v === "sclass" || v === "escalade" || v === "suburban" || v === "bmw7";
}

export function totalUsdToStripeCents(usd: number): number {
  return Math.round(usd * 100);
}
