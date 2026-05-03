/**
 * Loads the Google Maps JavaScript API with the Places library once.
 * Script URL: https://maps.googleapis.com/maps/api/js?key=…&libraries=places
 */

const SCRIPT_ID = "imperial-google-maps-places";

let inflight: Promise<void> | null = null;

function hasPlacesAutocomplete(): boolean {
  return (
    typeof (globalThis as unknown as { google?: typeof google }).google?.maps?.places?.Autocomplete === "function"
  );
}

/**
 * Injects the Maps script (with `libraries=places`) at most once and resolves when
 * `google.maps.places.Autocomplete` is available.
 */
export function ensureGooglePlacesAutocomplete(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const key = apiKey.trim();
  if (!key) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  if (hasPlacesAutocomplete()) return Promise.resolve();

  inflight ??= new Promise<void>((resolve, reject) => {
    const finishOk = () => {
      if (hasPlacesAutocomplete()) resolve();
      else reject(new Error("Google Maps loaded but google.maps.places.Autocomplete is not available"));
    };

    /** Older loader tag (no `libraries=places`) — remove so we can inject the correct script. */
    document.getElementById("google-maps-js-api")?.remove();

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (hasPlacesAutocomplete()) {
        finishOk();
        return;
      }
      existing.addEventListener("load", () => finishOk(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps JavaScript API failed to load")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.addEventListener("load", () => finishOk(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Google Maps JavaScript API failed to load")),
      { once: true }
    );
    document.head.appendChild(script);
  }).finally(() => {
    inflight = null;
  });

  return inflight;
}
