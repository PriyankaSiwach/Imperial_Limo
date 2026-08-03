/** Shared server/client-safe pricing for reservations (must match confirmation UI). */

import { fetchDrivingMiles } from "@/lib/driving-miles";

export type VehicleKey = "eclass" | "sclass" | "escalade" | "suburban" | "bmw7" | "testride";

export type TripType = "oneway" | "hourly";

/** Hourly as-directed rates (USD per hour, before tax). */
export const HOURLY_RATE_USD: Record<VehicleKey, number> = {
  eclass: 90,
  sclass: 160,
  escalade: 120,
  suburban: 100,
  bmw7: 160,
  /** Present for typing; totals use {@link TEST_RIDE_BASE_USD} in development only. */
  testride: 2,
};

/** Dev-only test vehicle flat base fare (USD before tax). */
export const TEST_RIDE_BASE_USD = 2;

export const MIN_HOURLY_DURATION = 2;
export const MAX_HOURLY_DURATION = 24;

/** One-way base fare before per-mile and tax (airport additive pricing + non-airport floor). */
export const BASE_FARE_USD = 95;

export const TAX_MULTIPLIER = 1.08;

export const PER_MILE: Record<VehicleKey, number> = {
  eclass: 3.96,
  sclass: 6.3,
  escalade: 4.95,
  suburban: 4.5,
  bmw7: 6.3,
  testride: 0.9,
};

const FLAT_RATES = {
  jfk: { eclass: 129, escalade: 189, suburban: 162, sclass: 252, bmw7: 252 },
  ewr: { eclass: 129, escalade: 189, suburban: 162, sclass: 252, bmw7: 252 },
  hpn: { eclass: 218, sclass: 342, suburban: 270, escalade: 270, bmw7: 342 },
  lga: { eclass: 109, sclass: 198, escalade: 153, suburban: 135, bmw7: 198 },
} as const;

export type AirportKey = keyof typeof FLAT_RATES;

export function clampDurationHours(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_HOURLY_DURATION;
  return Math.min(MAX_HOURLY_DURATION, Math.max(MIN_HOURLY_DURATION, n));
}

function containsManhattan(text: string): boolean {
  return text.toLowerCase().includes("manhattan");
}

/** Detect JFK / LGA / EWR / HPN from free-form Places formatted addresses. */
export function detectAirport(text: string): AirportKey | null {
  const value = text.toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();

  // ZIP codes commonly returned by Places for these airports (formattedAddress often omits the name).
  if (/\b11430\b/.test(value)) return "jfk";
  if (/\b11371\b/.test(value)) return "lga";
  if (/\b07114\b/.test(value) || /\b07105\b/.test(value)) return "ewr";
  if (/\b10604\b/.test(value)) return "hpn";

  if (
    value.includes("jfk") ||
    value.includes("john f kennedy") ||
    value.includes("kennedy international") ||
    value.includes("kennedy airport")
  ) {
    return "jfk";
  }
  if (
    value.includes("ewr") ||
    value.includes("newark liberty") ||
    value.includes("newark airport") ||
    (value.includes("newark") && value.includes("airport"))
  ) {
    return "ewr";
  }
  if (
    value.includes("hpn") ||
    value.includes("westchester county airport") ||
    value.includes("white plains airport") ||
    (value.includes("westchester") && value.includes("airport"))
  ) {
    return "hpn";
  }
  if (value.includes("lga") || value.includes("laguardia") || value.includes("la guardia")) {
    return "lga";
  }
  return null;
}

/** True when pickup or dropoff is a known airport address. */
export function involvesAirport(pickup: string, dropoff: string): boolean {
  return detectAirport(pickup) !== null || detectAirport(dropoff) !== null;
}

export function detectFlatRoute(pickup: string, dropoff: string): AirportKey | null {
  const pickupAirport = detectAirport(pickup);
  const dropoffAirport = detectAirport(dropoff);
  const pickupIsManhattan = containsManhattan(pickup);
  const dropoffIsManhattan = containsManhattan(dropoff);

  if (pickupAirport && dropoffIsManhattan) return pickupAirport;
  if (dropoffAirport && pickupIsManhattan) return dropoffAirport;
  return null;
}

/**
 * Airport one-way (non-Manhattan-flat): base + miles×rate, before tax.
 * Non-airport one-way: max(base, miles×rate), before tax.
 */
export function oneWayFareBeforeTax(params: {
  miles: number;
  vehicleKey: VehicleKey;
  airportTrip: boolean;
}): number {
  const rate = PER_MILE[params.vehicleKey];
  const mileage = Math.round(Math.max(0, params.miles) * rate);
  if (params.airportTrip) return BASE_FARE_USD + mileage;
  return Math.max(BASE_FARE_USD, mileage);
}

export type ComputeTotalUsdParams =
  | {
      tripType: "hourly";
      durationHours: number;
      vehicleKey: VehicleKey;
      pickupLocation?: string;
      dropoffLocation?: string;
    }
  | {
      tripType?: "oneway";
      pickupLocation: string;
      dropoffLocation: string;
      vehicleKey: VehicleKey;
      /** Forwarded browser Referer for Routes API when the Maps key is referrer-restricted. */
      referer?: string | null;
    };

/** Total charged in USD (integer dollars after tax), matching confirmation page. */
export async function computeTotalUsd(params: ComputeTotalUsdParams): Promise<number> {
  if (params.vehicleKey === "testride") {
    return Math.round(TEST_RIDE_BASE_USD * TAX_MULTIPLIER);
  }

  if (params.tripType === "hourly") {
    const hours = clampDurationHours(params.durationHours);
    const hourly = HOURLY_RATE_USD[params.vehicleKey];
    const base = hours * hourly;
    return Math.round(base * TAX_MULTIPLIER);
  }

  const routeKey = detectFlatRoute(params.pickupLocation, params.dropoffLocation);
  if (routeKey) {
    const flat = FLAT_RATES[routeKey][params.vehicleKey];
    return Math.round(flat * TAX_MULTIPLIER);
  }

  const miles =
    (await fetchDrivingMiles(params.pickupLocation, params.dropoffLocation, {
      referer: params.referer,
    })) ?? 0;
  const airportTrip = involvesAirport(params.pickupLocation, params.dropoffLocation);
  const estimated = oneWayFareBeforeTax({
    miles,
    vehicleKey: params.vehicleKey,
    airportTrip,
  });
  return Math.round(estimated * TAX_MULTIPLIER);
}

export function isVehicleKey(v: string): v is VehicleKey {
  if (v === "testride") return process.env.NODE_ENV === "development";
  return v === "eclass" || v === "sclass" || v === "escalade" || v === "suburban" || v === "bmw7";
}

export function totalUsdToStripeCents(usd: number): number {
  return Math.round(usd * 100);
}

/** Flat Manhattan↔airport rates (exported for confirmation UI). */
export const AIRPORT_FLAT_RATES = FLAT_RATES;
