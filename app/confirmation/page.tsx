"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  clampDurationHours,
  HOURLY_RATE_USD,
  MAX_HOURLY_DURATION,
  MIN_HOURLY_DURATION,
  TEST_RIDE_BASE_USD,
  type TripType,
  type VehicleKey,
} from "@/lib/booking-price";

const VEHICLE_META: Record<VehicleKey, { label: string; image: string; perMile: number }> = {
  eclass: { label: "Mercedes-Benz E-Class", image: "/images/mercedes_E.png", perMile: 4 },
  sclass: { label: "Mercedes-Benz S Class- Executive Sedan", image: "/images/mercedes1.png", perMile: 7 },
  escalade: { label: "Cadillac Escalade ESV-Van/SUV", image: "/images/escalade2.png", perMile: 5.5 },
  suburban: { label: "Chevrolet Suburban- Van/SUV", image: "/images/suburban.png", perMile: 5 },
  bmw7: { label: "BMW 7 series- Executive Sedan", image: "/images/bmw3.png", perMile: 7 },
  testride: { label: "Test Ride", image: "/images/mercedes_E.png", perMile: 1 },
};

function vehicleKeysForConfirmation(): VehicleKey[] {
  const keys = Object.keys(VEHICLE_META) as VehicleKey[];
  if (process.env.NODE_ENV === "development") return keys;
  return keys.filter((k) => k !== "testride");
}

function testRidePriceRow(): { base: number; total: number; note: string } {
  const total = Math.round(TEST_RIDE_BASE_USD * TAX_MULTIPLIER);
  return {
    base: TEST_RIDE_BASE_USD,
    total,
    note: "Development test vehicle — flat $2 base fare before tax.",
  };
}

const FLAT_RATES = {
  jfk: { eclass: 130, escalade: 210, suburban: 180, sclass: 280, bmw7: 280 },
  ewr: { eclass: 130, escalade: 210, suburban: 180, sclass: 280, bmw7: 280 },
  hpn: { eclass: 220, sclass: 380, suburban: 300, escalade: 300, bmw7: 380 },
  lga: { eclass: 110, sclass: 220, escalade: 170, suburban: 150, bmw7: 220 },
} as const;
const TAX_MULTIPLIER = 1.08;

/** Official Stripe CardElement styling — PCI-compliant hosted fields. */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#FAFAF8",
      fontFamily: "Montserrat, system-ui, sans-serif",
      fontSize: "16px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#8A6B28" },
      iconColor: "#C9A84C",
    },
    invalid: {
      color: "#d66b6b",
      iconColor: "#d66b6b",
    },
  },
  hidePostalCode: true,
};

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function detectFlatRoute(pickup: string, dropoff: string): keyof typeof FLAT_RATES | null {
  const pickupAirport = detectAirport(pickup);
  const dropoffAirport = detectAirport(dropoff);
  const pickupIsManhattan = containsManhattan(pickup);
  const dropoffIsManhattan = containsManhattan(dropoff);

  if (pickupAirport && dropoffIsManhattan) return pickupAirport;
  if (dropoffAirport && pickupIsManhattan) return dropoffAirport;
  return null;
}

async function getDrivingMiles(origin: string, destination: string): Promise<number | null> {
  const url = `/api/distance?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { miles: number | null };
  const miles = data.miles;
  return typeof miles === "number" && Number.isFinite(miles) ? miles : null;
}

function emailLooksValid(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type Booking = {
  pickupDate: string;
  pickupTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  specialRequests: string;
  tripType: TripType;
  durationHours: number;
};

type StripePaymentBlockProps = {
  clientSecret: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  vehicleLabel: string;
  vehicleKey: VehicleKey;
  booking: Booking;
  onError: (message: string) => void;
};

function StripePaymentBlock({
  clientSecret,
  firstName,
  lastName,
  phone,
  email,
  vehicleLabel,
  vehicleKey,
  booking,
  onError,
}: StripePaymentBlockProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [cardKind, setCardKind] = useState<"credit" | "debit">("credit");
  const [cardComplete, setCardComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  const fieldsOk =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length >= 7 &&
    emailLooksValid(email);

  const canSubmit = fieldsOk && cardComplete && Boolean(stripe && elements);

  const handlePay = useCallback(async () => {
    if (!stripe || !elements || !canSubmit) return;
    const card = elements.getElement(CardElement);
    if (!card) {
      onError("Card fields are not ready. Please refresh and try again.");
      return;
    }

    setBusy(true);
    onError("");

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) {
        onError(error.message || "Your card could not be processed.");
        return;
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        onError("Payment did not complete. Please try again.");
        return;
      }

      const fin = await fetch("/api/finalize-paid-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          vehicleKey,
          vehicleLabel,
          pickupLocation: booking.pickupLocation,
          dropoffLocation: booking.dropoffLocation,
          pickupDate: booking.pickupDate,
          pickupTime: booking.pickupTime,
          specialRequests: booking.specialRequests.trim() || "None",
          tripType: booking.tripType,
          durationHours: booking.tripType === "hourly" ? clampDurationHours(booking.durationHours) : undefined,
        }),
      });

      const data = (await fin.json().catch(() => ({}))) as { error?: string };
      if (!fin.ok) {
        onError(data.error || "Booking could not be finalized after payment.");
        return;
      }

      router.push("/success");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [
    stripe,
    elements,
    canSubmit,
    clientSecret,
    firstName,
    lastName,
    phone,
    email,
    vehicleKey,
    vehicleLabel,
    booking,
    router,
    onError,
  ]);

  return (
    <div className="confirmation-stripe-block">
      <div className="payment-secure-header">
        <IconLock className="payment-secure-header-icon" />
        <span>Secure Checkout</span>
      </div>

      <h3 className="confirmation-payment-heading">Payment</h3>
      <p className="confirmation-payment-hint">
        Your card details are entered in Stripe&apos;s secure fields. We only charge when you confirm.
      </p>

      <div className="payment-method-selector" role="group" aria-label="Card type">
        <button
          type="button"
          className={`payment-method-btn${cardKind === "credit" ? " payment-method-btn--active" : ""}`}
          aria-pressed={cardKind === "credit"}
          onClick={() => setCardKind("credit")}
        >
          Credit Card
        </button>
        <button
          type="button"
          className={`payment-method-btn${cardKind === "debit" ? " payment-method-btn--active" : ""}`}
          aria-pressed={cardKind === "debit"}
          onClick={() => setCardKind("debit")}
        >
          Debit Card
        </button>
      </div>

      <div className="form-group payment-card-field-group">
        <label>Card details</label>
        <div className="stripe-element-wrap stripe-card-element-wrap">
          <CardElement options={CARD_ELEMENT_OPTIONS} onChange={(e) => setCardComplete(e.complete)} />
        </div>
      </div>

      <ul className="payment-trust-badges" aria-label="Security">
        <li className="payment-trust-badge">
          <IconLock className="payment-trust-icon" />
          <span>256-bit SSL Encrypted</span>
        </li>
        <li className="payment-trust-badge">
          <span className="payment-trust-stripe-mark" aria-hidden>
            stripe
          </span>
          <span>Secured by Stripe</span>
        </li>
        <li className="payment-trust-badge">
          <IconShield className="payment-trust-icon" />
          <span>PCI DSS Compliant</span>
        </li>
      </ul>

      <button
        type="button"
        className="btn-primary confirmation-pay-btn"
        disabled={!canSubmit || busy}
        onClick={handlePay}
      >
        {busy ? "Processing…" : "Confirm & Pay"}
      </button>
    </div>
  );
}

function ConfirmationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [drivingMiles, setDrivingMiles] = useState<number | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleKey>("eclass");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piLoading, setPiLoading] = useState(false);
  const [piLoadError, setPiLoadError] = useState("");

  /** Inlined at build — identical on server and first client paint (avoids hydration mismatch). */
  const publishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
  const hasPublishableKey = publishableKey.length > 0;

  /** loadStripe uses browser APIs — initialize only after mount so SSR and hydration match. */
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  useEffect(() => {
    if (!hasPublishableKey) return;
    setStripePromise(loadStripe(publishableKey));
  }, [hasPublishableKey, publishableKey]);

  const booking = useMemo(() => {
    const tripType: TripType = params.get("tripType") === "hourly" ? "hourly" : "oneway";
    const dhRaw = parseInt(params.get("durationHours") || "", 10);
    return {
      pickupDate: params.get("pickupDate") || "",
      pickupTime: params.get("pickupTime") || "",
      pickupLocation: params.get("pickupLocation") || "",
      dropoffLocation: params.get("dropoffLocation") || "",
      specialRequests: params.get("specialRequests") || "",
      tripType,
      durationHours: Number.isFinite(dhRaw) ? clampDurationHours(dhRaw) : MIN_HOURLY_DURATION,
    };
  }, [params]);

  const routeKey =
    booking.tripType === "hourly" ? null : detectFlatRoute(booking.pickupLocation, booking.dropoffLocation);

  useEffect(() => {
    if (booking.tripType === "hourly") {
      setDrivingMiles(null);
      return;
    }
    if (routeKey) return;
    let cancelled = false;
    (async () => {
      const miles = await getDrivingMiles(booking.pickupLocation, booking.dropoffLocation);
      if (cancelled) return;
      setDrivingMiles(miles);
    })().catch(() => setDrivingMiles(null));

    return () => {
      cancelled = true;
    };
  }, [booking.pickupLocation, booking.dropoffLocation, routeKey, booking.tripType]);

  const priceByVehicle = useMemo(() => {
    const vehicles = vehicleKeysForConfirmation();
    if (booking.tripType === "hourly") {
      const h = clampDurationHours(booking.durationHours);
      return vehicles.reduce(
        (acc, key) => {
          if (key === "testride") {
            acc[key] = testRidePriceRow();
            return acc;
          }
          const hourly = HOURLY_RATE_USD[key];
          const base = h * hourly;
          const total = Math.round(base * TAX_MULTIPLIER);
          acc[key] = {
            base,
            total,
            note: `${h} hour(s) at $${hourly}/hr (hourly as-directed).`,
          };
          return acc;
        },
        {} as Record<VehicleKey, { base: number; total: number; note: string }>
      );
    }
    if (routeKey) {
      return vehicles.reduce(
        (acc, key) => {
          if (key === "testride") {
            acc[key] = testRidePriceRow();
            return acc;
          }
          const flat = FLAT_RATES[routeKey][key];
          const total = Math.round(flat * TAX_MULTIPLIER);
          acc[key] = {
            base: flat,
            total,
            note: "Flat airport transfer pricing applied.",
          };
          return acc;
        },
        {} as Record<VehicleKey, { base: number; total: number; note: string }>
      );
    }
    const miles = drivingMiles ?? 0;
    return vehicles.reduce(
      (acc, key) => {
        if (key === "testride") {
          acc[key] = testRidePriceRow();
          return acc;
        }
        const rate = VEHICLE_META[key].perMile;
        const estimated = Math.max(95, Math.round(miles * rate));
        const total = Math.round(estimated * TAX_MULTIPLIER);
        acc[key] = {
          base: estimated,
          total,
          note:
            miles > 0
              ? `Driving distance ${miles.toFixed(1)} miles at $${rate}/mile.`
              : "Distance Matrix unavailable, minimum fare applied.",
        };
        return acc;
      },
      {} as Record<VehicleKey, { base: number; total: number; note: string }>
    );
  }, [booking.tripType, booking.durationHours, routeKey, drivingMiles]);

  const chosen = priceByVehicle[selectedVehicle];

  useEffect(() => {
    if (booking.tripType === "hourly") {
      if (!booking.pickupLocation.trim()) {
        setClientSecret(null);
        setPiLoadError("Pick-up location is required to load payment.");
        return;
      }
      const h = clampDurationHours(booking.durationHours);
      if (h < MIN_HOURLY_DURATION || h > MAX_HOURLY_DURATION) {
        setClientSecret(null);
        setPiLoadError(`Duration must be between ${MIN_HOURLY_DURATION} and ${MAX_HOURLY_DURATION} hours.`);
        return;
      }
    } else if (!booking.pickupLocation.trim() || !booking.dropoffLocation.trim()) {
      setClientSecret(null);
      setPiLoadError("Pick-up and drop-off are required to load payment.");
      return;
    }

    let cancelled = false;
    (async () => {
      setPiLoading(true);
      setPiLoadError("");
      setClientSecret(null);
      try {
        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripType: booking.tripType,
            pickupLocation: booking.pickupLocation,
            dropoffLocation: booking.dropoffLocation,
            durationHours:
              booking.tripType === "hourly" ? clampDurationHours(booking.durationHours) : undefined,
            vehicleKey: selectedVehicle,
          }),
        });
        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.clientSecret) {
          setPiLoadError(data.error || "Could not initialize payment.");
          return;
        }
        setClientSecret(data.clientSecret);
        setPaymentError("");
      } catch {
        if (!cancelled) setPiLoadError("Could not initialize payment.");
      } finally {
        if (!cancelled) setPiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [booking.pickupLocation, booking.dropoffLocation, booking.tripType, booking.durationHours, selectedVehicle]);

  const handleGoBack = () => {
    const q = new URLSearchParams({
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime,
      pickupLocation: booking.pickupLocation,
      specialRequests: booking.specialRequests,
    });
    if (booking.tripType === "hourly") {
      q.set("tripType", "hourly");
      q.set("durationHours", String(clampDurationHours(booking.durationHours)));
    } else {
      q.set("dropoffLocation", booking.dropoffLocation);
    }
    router.push(`/reserve?${q.toString()}`);
  };

  return (
    <main className="confirmation-page" suppressHydrationWarning>
      <div className="container confirmation-wrap">
        <div className="confirmation-summary">
          <span className="section-label">Pricing &amp; Confirmation</span>
          <h1 className="section-title confirmation-main-title">
            Your <em>Trip</em> &amp; Live Pricing
          </h1>
          <div className="divider"></div>
          <p>
            <strong>Pick-Up:</strong> <span className="confirmation-value">{booking.pickupLocation || "Not provided"}</span>
          </p>
          {booking.tripType === "hourly" ? (
            <p>
              <strong>Service:</strong>{" "}
              <span className="confirmation-value">Hourly as-directed (no drop-off)</span>
            </p>
          ) : (
            <p>
              <strong>Drop-Off:</strong> <span className="confirmation-value">{booking.dropoffLocation || "Not provided"}</span>
            </p>
          )}
          <p>
            <strong>Date:</strong> <span className="confirmation-value">{booking.pickupDate || "Not provided"}</span>
          </p>
          <p>
            <strong>Time:</strong> <span className="confirmation-value">{booking.pickupTime || "Not provided"}</span>
          </p>
          <p>
            <strong>Pricing Mode:</strong>{" "}
            <span className="confirmation-value">
              {booking.tripType === "hourly"
                ? "Hourly as-directed rate (incl. tax)"
                : routeKey
                  ? "Flat airport route rate"
                  : "Distance Matrix per-mile pricing"}
            </span>
          </p>
        </div>

        <div className="confirmation-card">
          {booking.tripType === "hourly" ? (
            <div className="confirmation-hourly-rate-panel">
              <h3 className="confirmation-hourly-rate-heading">Hourly rate</h3>
              <p className="confirmation-hourly-rate-line">
                <strong>Duration:</strong>{" "}
                <span className="confirmation-value">{clampDurationHours(booking.durationHours)} hours</span>
                <span className="confirmation-hourly-rate-range"> ({MIN_HOURLY_DURATION}–{MAX_HOURLY_DURATION} hr)</span>
              </p>
              <p className="confirmation-hourly-rate-note">
                Hourly as-directed service has no separate drop-off—your vehicle and chauffeur remain with you for the booked
                time. Totals on each vehicle card include taxes &amp; fees.
              </p>
              <div className="confirmation-hourly-rate-highlight">
                <span className="confirmation-hourly-rate-label">{VEHICLE_META[selectedVehicle].label}</span>
                <span className="confirmation-hourly-rate-amount">
                  {selectedVehicle === "testride" ? (
                    <>
                      Flat ${TEST_RIDE_BASE_USD} base before tax (dev test) → <strong>${chosen.base}</strong>
                    </>
                  ) : (
                    <>
                      ${HOURLY_RATE_USD[selectedVehicle]}/hr × {clampDurationHours(booking.durationHours)} hrs →{" "}
                      <strong>${chosen.base}</strong> base before tax
                    </>
                  )}
                </span>
              </div>
            </div>
          ) : null}
          <div className="confirmation-grid">
            {vehicleKeysForConfirmation().map((key) => (
              <button
                key={key}
                type="button"
                className={`confirmation-vehicle-card ${selectedVehicle === key ? "selected" : ""}`}
                onClick={() => setSelectedVehicle(key)}
              >
                <img src={VEHICLE_META[key].image} alt={VEHICLE_META[key].label} className="confirmation-vehicle" />
                <span className="confirmation-vehicle-title">{VEHICLE_META[key].label}</span>
                <span className="confirmation-price-small">
                  ${priceByVehicle[key].total} <span className="price-incl-note">incl. taxes &amp; fees</span>
                </span>
              </button>
            ))}
          </div>
          <div className="confirmation-price">
            ${chosen.total} <span className="confirmation-price-note">incl. taxes &amp; fees</span>
          </div>
          <div className="confirmation-breakdown">
            <p>
              <strong>Selected vehicle:</strong> <span className="confirmation-value">{VEHICLE_META[selectedVehicle].label}</span>
            </p>
            <p>
              <strong>Base fare:</strong> <span className="confirmation-value">${chosen.base}</span>
            </p>
            <p>
              <strong>Total:</strong> <span className="confirmation-value">${chosen.total}</span>
            </p>
            <p>
              <strong>{booking.tripType === "hourly" ? "Quote detail:" : "Driving distance:"}</strong>{" "}
              <span className="confirmation-value">{chosen.note}</span>
            </p>
            {booking.specialRequests ? (
              <p>
                <strong>Special requests:</strong> <span className="confirmation-value">{booking.specialRequests}</span>
              </p>
            ) : null}
          </div>

          <div className="confirmation-name-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" autoComplete="tel" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                />
              </div>
            </div>
          </div>

          {!hasPublishableKey ? (
            <p className="status-error">Payment is unavailable: add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment.</p>
          ) : !stripePromise ? (
            <p className="confirmation-payment-hint">Preparing secure payment…</p>
          ) : piLoadError ? (
            <p className="status-error">{piLoadError}</p>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} key={clientSecret} options={{ clientSecret }}>
              <StripePaymentBlock
                clientSecret={clientSecret}
                firstName={firstName}
                lastName={lastName}
                phone={phone}
                email={email}
                vehicleLabel={VEHICLE_META[selectedVehicle].label}
                vehicleKey={selectedVehicle}
                booking={booking}
                onError={setPaymentError}
              />
            </Elements>
          ) : (
            <p className="confirmation-payment-hint">Loading secure payment…</p>
          )}

          <div className="confirmation-actions confirmation-actions-after-pay">
            <button type="button" className="btn-outline" onClick={handleGoBack}>
              Go Back
            </button>
          </div>
          {paymentError ? <p className="status-error">{paymentError}</p> : null}
        </div>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="confirmation-page" suppressHydrationWarning>
          <div className="container confirmation-wrap">
            <div className="confirmation-summary">
              <span className="section-label">Pricing &amp; Confirmation</span>
              <h1 className="section-title">Loading...</h1>
            </div>
          </div>
        </main>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
