"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clampDurationHours, MAX_HOURLY_DURATION, MIN_HOURLY_DURATION, type TripType } from "@/lib/booking-price";
import { ensureGooglePlacesAutocomplete } from "@/lib/load-google-maps";

/** Avoid bare `google` (ReferenceError in strict bundles before / without Maps on `globalThis`). */
function readGoogleMapsFromGlobal(): typeof google | undefined {
  return (globalThis as unknown as { google?: typeof google }).google;
}

export default function ReservePage() {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tripType, setTripType] = useState<TripType>("oneway");

  const pickupInputRef = useRef<HTMLInputElement | null>(null);
  const dropoffInputRef = useRef<HTMLInputElement | null>(null);
  const pickupAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  /** Bumped when an address input mounts — retriggers bind after `await` with fresh `ref.current`. */
  const [placesAttachNonce, setPlacesAttachNonce] = useState(0);
  const onPickupAddressRef = useCallback((el: HTMLInputElement | null) => {
    pickupInputRef.current = el;
    if (el) setPlacesAttachNonce((n) => n + 1);
  }, []);
  const onDropoffAddressRef = useCallback((el: HTMLInputElement | null) => {
    dropoffInputRef.current = el;
    if (el) setPlacesAttachNonce((n) => n + 1);
  }, []);

  /** Maps + Places library finished loading — separate from bind so bind re-runs when this flips true. */
  const [mapsPlacesBootstrapped, setMapsPlacesBootstrapped] = useState(false);

  const [booking, setBooking] = useState({
    pickupDate: "",
    pickupTime: "",
    pickupLocation: "",
    dropoffLocation: "",
    specialRequests: "",
    durationHours: MIN_HOURLY_DURATION,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pickupDate = params.get("pickupDate") || "";
    const pickupTime = params.get("pickupTime") || "";
    const pickupLocation = params.get("pickupLocation") || "";
    const dropoffLocation = params.get("dropoffLocation") || "";
    const specialRequests = params.get("specialRequests") || "";
    const tt = params.get("tripType") === "hourly" ? "hourly" : "oneway";
    const dhRaw = parseInt(params.get("durationHours") || "", 10);
    const durationHours = Number.isFinite(dhRaw) ? clampDurationHours(dhRaw) : MIN_HOURLY_DURATION;
    setTripType(tt);
    if (pickupDate || pickupTime || pickupLocation || dropoffLocation || specialRequests || tt === "hourly") {
      setBooking((prev) => ({
        ...prev,
        pickupDate,
        pickupTime,
        pickupLocation,
        dropoffLocation,
        specialRequests,
        durationHours,
      }));
    }
  }, []);

  /** Load Maps + Places once on page load (independent of trip type / address fields). */
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
    if (!apiKey) {
      console.error(
        "[Reserve] Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to .env.local and restart the dev server (fully stop npm run dev, then start again)."
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureGooglePlacesAutocomplete(apiKey);
        if (cancelled) return;
        const gMaps = readGoogleMapsFromGlobal();
        if (!gMaps?.maps?.places?.Autocomplete) {
          console.error(
            "[Reserve] Google Places failed to load: google.maps.places.Autocomplete is not available after script load."
          );
          return;
        }
        setMapsPlacesBootstrapped(true);
        setPlacesAttachNonce((n) => n + 1);
      } catch (e) {
        console.error("[Reserve] Google Places failed to load:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Attach Autocomplete synchronously (no await) whenever the library is ready + DOM refs exist.
   * Re-runs when `mapsPlacesBootstrapped` becomes true (fixes one-way first load: no dependency on
   * toggling "By the hour" to trigger a second async bind).
   */
  useEffect(() => {
    const gMaps = readGoogleMapsFromGlobal();
    const AutocompleteCtor = gMaps?.maps?.places?.Autocomplete;
    if (!mapsPlacesBootstrapped || typeof AutocompleteCtor !== "function") return;

    const detach = () => {
      const g = readGoogleMapsFromGlobal();
      if (!g?.maps?.event) return;
      if (pickupAutocompleteRef.current) {
        g.maps.event.clearInstanceListeners(pickupAutocompleteRef.current);
        pickupAutocompleteRef.current = null;
      }
      if (dropoffAutocompleteRef.current) {
        g.maps.event.clearInstanceListeners(dropoffAutocompleteRef.current);
        dropoffAutocompleteRef.current = null;
      }
    };

    detach();

    const pickupEl = pickupInputRef.current;
    if (!pickupEl) {
      return () => {
        detach();
      };
    }

    const attachOptions = {
      fields: ["formatted_address", "name", "geometry"] as string[],
      types: ["geocode"] as string[],
    };

    pickupAutocompleteRef.current = new AutocompleteCtor(pickupEl, attachOptions);
    pickupAutocompleteRef.current.addListener("place_changed", () => {
      const ac = pickupAutocompleteRef.current;
      if (!ac) return;
      const place = ac.getPlace();
      const formatted = place?.formatted_address || place?.name || pickupEl.value;
      setBooking((prev) => ({ ...prev, pickupLocation: formatted }));
    });

    if (tripType === "oneway") {
      const dropEl = dropoffInputRef.current;
      if (dropEl) {
        dropoffAutocompleteRef.current = new AutocompleteCtor(dropEl, attachOptions);
        dropoffAutocompleteRef.current.addListener("place_changed", () => {
          const ac = dropoffAutocompleteRef.current;
          if (!ac) return;
          const place = ac.getPlace();
          const formatted = place?.formatted_address || place?.name || dropEl.value;
          setBooking((prev) => ({ ...prev, dropoffLocation: formatted }));
        });
      }
    }

    return () => {
      detach();
    };
  }, [mapsPlacesBootstrapped, tripType, placesAttachNonce]);

  useEffect(() => {
    const nav = document.getElementById("navbar");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll);

    const revealEls = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen]);

  const handleBooking = () => {
    const pickupLocation = pickupInputRef.current?.value?.trim() || booking.pickupLocation.trim();
    const dropoffLocation =
      tripType === "hourly" ? "" : dropoffInputRef.current?.value?.trim() || booking.dropoffLocation.trim();

    if (!pickupLocation || !booking.pickupDate || !booking.pickupTime) {
      window.alert("Please fill pick-up location, date, and time.");
      return;
    }
    if (tripType === "oneway" && !dropoffLocation) {
      window.alert("Please fill drop-off location for a one-way trip.");
      return;
    }
    if (tripType === "hourly") {
      const h = clampDurationHours(booking.durationHours);
      if (h < MIN_HOURLY_DURATION || h > MAX_HOURLY_DURATION) {
        window.alert(`Duration must be between ${MIN_HOURLY_DURATION} and ${MAX_HOURLY_DURATION} hours.`);
        return;
      }
    }
    const params = new URLSearchParams({
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime,
      pickupLocation,
      dropoffLocation,
      specialRequests: booking.specialRequests,
      tripType,
      ...(tripType === "hourly" ? { durationHours: String(clampDurationHours(booking.durationHours)) } : {}),
    });
    router.push(`/confirmation?${params.toString()}`);
  };

  return (
    <>
      {/* NAV */}
      <nav id="navbar">
        <a href="/" className="nav-logo" onClick={() => setMobileNavOpen(false)}>
          <img src="/images/logo_1.png" alt="Imperial Limousine logo" className="nav-logo-image" />
          <span>Imperial Limousine</span>
        </a>
        <ul className="nav-links">
          <li>
            <a href="/#fleet">Fleet</a>
          </li>
          <li>
            <a href="/#services">Services</a>
          </li>
          <li>
            <a href="/#about">About</a>
          </li>
          <li>
            <a href="/#contact">Contact</a>
          </li>
        </ul>
        <a href="/reserve" className="nav-cta">
          Reserve Now
        </a>
        <button
          type="button"
          className={`nav-toggle${mobileNavOpen ? " nav-toggle--open" : ""}`}
          aria-expanded={mobileNavOpen}
          aria-controls="nav-mobile"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileNavOpen((o) => !o)}
        >
          <span className="nav-toggle-bars" aria-hidden>
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
          </span>
        </button>
      </nav>
      <div
        id="nav-mobile"
        className={`nav-mobile${mobileNavOpen ? " nav-mobile--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!mobileNavOpen}
      >
        <button type="button" className="nav-mobile-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}>
          ×
        </button>
        <ul className="nav-mobile-links">
          <li>
            <a href="/#fleet" onClick={() => setMobileNavOpen(false)}>
              Fleet
            </a>
          </li>
          <li>
            <a href="/#services" onClick={() => setMobileNavOpen(false)}>
              Services
            </a>
          </li>
          <li>
            <a href="/reserve" onClick={() => setMobileNavOpen(false)}>
              Book
            </a>
          </li>
          <li>
            <a href="/#about" onClick={() => setMobileNavOpen(false)}>
              About
            </a>
          </li>
          <li>
            <a href="/#testimonials" onClick={() => setMobileNavOpen(false)}>
              Reviews
            </a>
          </li>
          <li>
            <a href="/#contact" onClick={() => setMobileNavOpen(false)}>
              Contact
            </a>
          </li>
        </ul>
        <a href="/reserve" className="nav-cta nav-mobile-cta" onClick={() => setMobileNavOpen(false)}>
          Reserve Now
        </a>
      </div>

      {/* BOOK — class reserve-page scopes mobile layout (form first) in globals.css */}
      <section id="book" className="reserve-page">
        <div className="container">
          <div className="book-layout">
            <div className="book-info">
              <span className="section-label reveal">Reservations</span>
              <h2 className="book-info-title reveal reveal-delay-1">
                Reserve<br />
                Your <em>Ride</em>
                <br />
                Today
              </h2>
              <div className="divider reveal reveal-delay-2"></div>
              <p className="book-info-text reveal reveal-delay-3">
                Every booking is confirmed within minutes, backed by our guarantee of punctuality and discretion. Your comfort is our command.
              </p>
              <div className="book-feature reveal reveal-delay-1">
                <div className="book-feature-icon">✈</div>
                <div className="book-feature-text">
                  <h4>Flight Tracking Included</h4>
                  <p>We monitor your flight in real-time. No extra charges for delays.</p>
                </div>
              </div>
              <div className="book-feature reveal reveal-delay-2">
                <div className="book-feature-icon">◆</div>
                <div className="book-feature-text">
                  <h4>Flat Rate Pricing</h4>
                  <p>Transparent pricing, no surge, no surprises. Quoted upfront.</p>
                </div>
              </div>
              <div className="book-feature reveal reveal-delay-3">
                <div className="book-feature-icon">☎</div>
                <div className="book-feature-text">
                  <h4>24/7 Concierge</h4>
                  <p>A real person, available around the clock, every day of the year.</p>
                </div>
              </div>
            </div>
            <div className="book-form reveal reveal-delay-2">
              <h3 className="form-title">Book a Reservation</h3>
              <div className="book-trip-toggle" role="group" aria-label="Trip type">
                <span className="book-trip-toggle-label">Trip type</span>
                <button
                  type="button"
                  className={`book-trip-toggle-btn${tripType === "oneway" ? " book-trip-toggle-btn--active" : ""}`}
                  aria-pressed={tripType === "oneway"}
                  onClick={() => setTripType("oneway")}
                >
                  One way
                </button>
                <button
                  type="button"
                  className={`book-trip-toggle-btn${tripType === "hourly" ? " book-trip-toggle-btn--active" : ""}`}
                  aria-pressed={tripType === "hourly"}
                  onClick={() => setTripType("hourly")}
                >
                  By the Hour
                </button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Pick-Up Date</label>
                  <input type="date" value={booking.pickupDate} onChange={(e) => setBooking((prev) => ({ ...prev, pickupDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Pick-Up Time</label>
                  <input type="time" value={booking.pickupTime} onChange={(e) => setBooking((prev) => ({ ...prev, pickupTime: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Pick-Up Location</label>
                <input
                  ref={onPickupAddressRef}
                  type="text"
                  name="pickupLocation"
                  autoComplete="off"
                  placeholder="Pick-up location"
                  value={booking.pickupLocation}
                  onChange={(e) => setBooking((prev) => ({ ...prev, pickupLocation: e.target.value }))}
                />
              </div>
              {tripType === "oneway" ? (
                <div className="form-group">
                  <label>Drop-Off Location</label>
                  <input
                    ref={onDropoffAddressRef}
                    type="text"
                    name="dropoffLocation"
                    autoComplete="off"
                    placeholder="Drop-off location"
                    value={booking.dropoffLocation}
                    onChange={(e) => setBooking((prev) => ({ ...prev, dropoffLocation: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="reserve-duration-hours">Duration (hours)</label>
                  <select
                    id="reserve-duration-hours"
                    value={clampDurationHours(booking.durationHours)}
                    onChange={(e) =>
                      setBooking((prev) => ({
                        ...prev,
                        durationHours: clampDurationHours(parseInt(e.target.value, 10)),
                      }))
                    }
                    autoComplete="off"
                    aria-label={`Hours between ${MIN_HOURLY_DURATION} and ${MAX_HOURLY_DURATION}`}
                  >
                    {Array.from(
                      { length: MAX_HOURLY_DURATION - MIN_HOURLY_DURATION + 1 },
                      (_, i) => MIN_HOURLY_DURATION + i
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} hours
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px", fontWeight: 300 }}>
                    Choose from {MIN_HOURLY_DURATION}–{MAX_HOURLY_DURATION} hours. Address autocomplete applies only to pick-up above.
                  </p>
                </div>
              )}
              <div className="form-group">
                <label>Special Requests</label>
                <textarea
                  placeholder="Child seat, extra stops, preferred route..."
                  value={booking.specialRequests}
                  onChange={(e) => setBooking((prev) => ({ ...prev, specialRequests: e.target.value }))}
                ></textarea>
              </div>
              <button className="form-submit" onClick={handleBooking}>
                Explore prices and vehicles →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="footer-top">
            <div>
              <a href="/" className="footer-logo">
                Imperial Limousine
              </a>
              <p className="footer-about">New York&apos;s premier black car service. Luxury, discretion, and professionalism on every journey since 2013.</p>
              <div className="footer-socials">
                <a className="social-btn" href="https://www.instagram.com/imperial_limousine_ny_" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  IG
                </a>
              </div>
            </div>
            <div className="footer-col">
              <h5>Services</h5>
              <ul>
                <li>
                  <a href="/#services">Airport Transfers</a>
                </li>
                <li>
                  <a href="/#services">Corporate Travel</a>
                </li>
                <li>
                  <a href="/#services">Events &amp; Galas</a>
                </li>
                <li>
                  <a href="/#services">City Tours</a>
                </li>
                <li>
                  <a href="/#services">Hourly Service</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>Company</h5>
              <ul>
                <li>
                  <a href="/#about">About Us</a>
                </li>
                <li>
                  <a href="/#fleet">Our Fleet</a>
                </li>
                <li>
                  <a href="/#testimonials">Reviews</a>
                </li>
                <li>
                  <a href="/#contact">Contact</a>
                </li>
                <li>
                  <a href="/reserve">Book Now</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>Contact</h5>
              <ul>
                <li>
                  <a href="tel:15166149134">1. 5166149134</a>
                </li>
                <li>
                  <a href="mailto:imperiallimony@gmail.com">imperiallimony@gmail.com</a>
                </li>
                <li>
                  <a href="mailto:reservations.imperiallimo@gmail.com">reservations.imperiallimo@gmail.com</a>
                </li>
                <li>
                  <a href="#">New York, NY 10001</a>
                </li>
                <li>
                  <a href="#">JFK · LGA · EWR · Hampton</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-copy">
              © 2025 <span>Imperial Limousine</span> Transportation. All rights reserved. New York City.
            </p>
            <div className="footer-legal">
              <a href="/privacy-policy">Privacy Policy</a>
              <a href="/terms-of-service">Terms of Service</a>
              <a href="#">Accessibility</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
