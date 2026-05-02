/** Loads Maps JS API once (recommended `loading=async` + dynamic `importLibrary`). */

let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const key = apiKey.trim();
  if (!key) return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));

  if (window.google?.maps?.importLibrary) return Promise.resolve();

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const id = "google-maps-js-api";
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly`;
        script.onerror = () => reject(new Error("Google Maps JavaScript API failed to load"));
        document.head.appendChild(script);
      }

      const finish = () => resolve();
      if (window.google?.maps?.importLibrary) {
        finish();
        return;
      }
      script.addEventListener("load", finish, { once: true });
    });
  }

  return loadPromise;
}
