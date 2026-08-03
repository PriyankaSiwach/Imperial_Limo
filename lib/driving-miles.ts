/** Driving distance helpers (Routes API + Places/OSRM fallback). */

const METERS_PER_MILE = 1609.344;
/** NYC-area road factor for great-circle miles when no router is available. */
const ROAD_FACTOR = 1.35;

export type FetchDrivingMilesOptions = {
  /** Browser Referer/Origin — required when the Maps key uses HTTP referrer restrictions. */
  referer?: string | null;
};

type LatLng = { lat: number; lng: number };

function mapsApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    ""
  );
}

function defaultReferer(): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.endsWith("/") ? site : `${site}/`;
  return "https://imperiallimony.com/";
}

function requestHeaders(fieldMask: string, referer?: string | null): Record<string, string> {
  const key = mapsApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": key,
    "X-Goog-FieldMask": fieldMask,
  };
  const ref = (referer?.trim() || defaultReferer() || "").trim();
  if (ref) {
    headers.Referer = ref;
    try {
      headers.Origin = new URL(ref).origin;
    } catch {
      /* ignore */
    }
  }
  return headers;
}

function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function geocodeWithPlaces(address: string, referer?: string | null): Promise<LatLng | null> {
  const key = mapsApiKey();
  if (!key || !address.trim()) return null;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: requestHeaders("places.location,places.formattedAddress", referer),
    body: JSON.stringify({ textQuery: address.trim(), maxResultCount: 1 }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    places?: { location?: { latitude?: number; longitude?: number } }[];
  };
  const loc = data?.places?.[0]?.location;
  if (typeof loc?.latitude !== "number" || typeof loc?.longitude !== "number") return null;
  return { lat: loc.latitude, lng: loc.longitude };
}

async function fetchMilesViaRoutesApi(
  origin: string,
  destination: string,
  referer?: string | null
): Promise<number | null> {
  const key = mapsApiKey();
  if (!key) return null;

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: requestHeaders("routes.distanceMeters", referer),
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      units: "IMPERIAL",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      detail = errBody?.error?.message || "";
    } catch {
      /* ignore */
    }
    console.warn("[fetchDrivingMiles] Routes API unavailable:", res.status, detail);
    return null;
  }

  const data = (await res.json()) as { routes?: { distanceMeters?: number }[] };
  const meters = data?.routes?.[0]?.distanceMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) return null;
  return meters / METERS_PER_MILE;
}

async function fetchMilesViaOsrm(from: LatLng, to: LatLng): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { code?: string; routes?: { distance?: number }[] };
    if (data.code !== "Ok") return null;
    const meters = data.routes?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) return null;
    return meters / METERS_PER_MILE;
  } catch {
    return null;
  }
}

/**
 * Returns driving distance in miles between two addresses.
 * 1) Routes API (preferred)
 * 2) Places geocode + OSRM driving route
 * 3) Places geocode + road-adjusted great-circle
 */
export async function fetchDrivingMiles(
  origin: string,
  destination: string,
  options: FetchDrivingMilesOptions = {}
): Promise<number | null> {
  const fromAddr = origin.trim();
  const toAddr = destination.trim();
  if (!fromAddr || !toAddr || !mapsApiKey()) return null;

  const referer = options.referer;
  const viaRoutes = await fetchMilesViaRoutesApi(fromAddr, toAddr, referer);
  if (viaRoutes != null) return viaRoutes;

  const [from, to] = await Promise.all([
    geocodeWithPlaces(fromAddr, referer),
    geocodeWithPlaces(toAddr, referer),
  ]);
  if (!from || !to) return null;

  const viaOsrm = await fetchMilesViaOsrm(from, to);
  if (viaOsrm != null) return viaOsrm;

  const approx = haversineMiles(from, to) * ROAD_FACTOR;
  return Number.isFinite(approx) && approx > 0 ? approx : null;
}
