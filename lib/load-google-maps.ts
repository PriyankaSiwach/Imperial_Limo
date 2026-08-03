/**
 * Loads the Google Maps JavaScript API once and resolves PlaceAutocompleteElement
 * via `google.maps.importLibrary("places")`.
 */

const BOOTSTRAP_FLAG = "__imperialMapsBootstrap";

type PlaceAutocompleteElementCtor = typeof google.maps.places.PlaceAutocompleteElement;

let inflight: Promise<PlaceAutocompleteElementCtor> | null = null;

type MapsWindow = typeof globalThis & {
  google?: typeof google;
  [BOOTSTRAP_FLAG]?: boolean;
};

function readGoogle(): typeof google | undefined {
  return (globalThis as MapsWindow).google;
}

/** Official dynamic-library bootstrap (sets `google.maps.importLibrary`). */
function bootstrapMapsImportLibrary(apiKey: string): void {
  const w = globalThis as MapsWindow;
  if (w[BOOTSTRAP_FLAG]) return;

  document.getElementById("imperial-google-maps-places")?.remove();
  document.getElementById("google-maps-js-api")?.remove();

  // prettier-ignore
  ((g: { key: string; v: string }) => {
    let h: Promise<void> | undefined;
    let a: HTMLScriptElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = w;
    b.google = b.google || {};
    const d = b.google.maps = b.google.maps || {};
    const r = new Set<string>();
    const e = new URLSearchParams();
    const u = () =>
      h ||
      (h = new Promise<void>((f, n) => {
        a = document.createElement("script");
        e.set("libraries", [...r].join(","));
        for (const k in g) {
          e.set(
            k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
            String((g as Record<string, string>)[k])
          );
        }
        e.set("callback", "google.maps.__ib__");
        a.src = `https://maps.googleapis.com/maps/api/js?${e}`;
        d.__ib__ = f;
        a.onerror = () => n(new Error("Google Maps JavaScript API could not load."));
        a.nonce = document.querySelector("script[nonce]")?.getAttribute("nonce") || "";
        document.head.append(a);
      }));
    if (d.importLibrary) {
      console.warn("The Google Maps JavaScript API only loads once. Ignoring duplicate bootstrap.");
    } else {
      d.importLibrary = (f: string, ...n: unknown[]) => r.add(f) && u().then(() => d.importLibrary(f, ...n));
    }
  })({ key: apiKey, v: "weekly" });

  w[BOOTSTRAP_FLAG] = true;
}

/**
 * Injects the Maps bootstrap (at most once) and resolves when
 * `google.maps.places.PlaceAutocompleteElement` is available.
 */
export function ensureGooglePlacesAutocomplete(apiKey: string): Promise<PlaceAutocompleteElementCtor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }

  const key = apiKey.trim();
  if (!key) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  const existing = readGoogle()?.maps?.places?.PlaceAutocompleteElement;
  if (typeof existing === "function") {
    return Promise.resolve(existing);
  }

  inflight ??= (async () => {
    bootstrapMapsImportLibrary(key);

    const g = readGoogle();
    if (!g?.maps?.importLibrary) {
      throw new Error("Google Maps importLibrary is not available after bootstrap");
    }

    await g.maps.importLibrary("places");

    const Ctor = readGoogle()?.maps?.places?.PlaceAutocompleteElement;
    if (typeof Ctor !== "function") {
      throw new Error("google.maps.places.PlaceAutocompleteElement is not available after script load");
    }
    return Ctor;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
