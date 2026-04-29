"use client";

import { useMemo, useState, useEffect } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type VehicleKey = "eclass" | "sclass" | "escalade" | "suburban" | "bmw7";

const VEHICLE_META: Record<VehicleKey, { label: string; image: string; perMile: number }> = {
  eclass: { label: "Mercedes-Benz E class- Business Sedan", image: "/images/mercedes_E.png", perMile: 4 },
  sclass: { label: "Mercedes-Benz S Class- Executive Sedan", image: "/images/mercedes1.png", perMile: 7 },
  escalade: { label: "Cadillac Escalade ESV-Van/SUV", image: "/images/escalade2.png", perMile: 5.5 },
  suburban: { label: "Chevrolet Suburban- Van/SUV", image: "/images/suburban.png", perMile: 5 },
  bmw7: { label: "BMW 7 series- Executive Sedan", image: "/images/bmw3.png", perMile: 7 },
};

const FLAT_RATES = {
  jfk: { eclass: 130, escalade: 210, suburban: 180, sclass: 280, bmw7: 280 },
  ewr: { eclass: 130, escalade: 210, suburban: 180, sclass: 280, bmw7: 280 },
  hpn: { eclass: 220, sclass: 380, suburban: 300, escalade: 300, bmw7: 380 },
  lga: { eclass: 110, sclass: 220, escalade: 170, suburban: 150, bmw7: 220 },
} as const;
const TAX_MULTIPLIER = 1.08;

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

function ConfirmationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [drivingMiles, setDrivingMiles] = useState<number | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleKey>("eclass");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const booking = useMemo(
    () => ({
      pickupDate: params.get("pickupDate") || "",
      pickupTime: params.get("pickupTime") || "",
      pickupLocation: params.get("pickupLocation") || "",
      dropoffLocation: params.get("dropoffLocation") || "",
      specialRequests: params.get("specialRequests") || "",
    }),
    [params]
  );

  const routeKey = detectFlatRoute(booking.pickupLocation, booking.dropoffLocation);

  useEffect(() => {
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
  }, [booking.pickupLocation, booking.dropoffLocation, routeKey]);

  const priceByVehicle = useMemo(() => {
    const vehicles = Object.keys(VEHICLE_META) as VehicleKey[];
    if (routeKey) {
      return vehicles.reduce((acc, key) => {
        const flat = FLAT_RATES[routeKey][key];
        const total = Math.round(flat * TAX_MULTIPLIER);
        acc[key] = {
          base: flat,
          total,
          note: "Flat airport transfer pricing applied.",
        };
        return acc;
      }, {} as Record<VehicleKey, { base: number; total: number; note: string }>);
    }
    const miles = drivingMiles ?? 0;
    return vehicles.reduce((acc, key) => {
      const rate = VEHICLE_META[key].perMile;
      const estimated = Math.max(95, Math.round(miles * rate));
      const total = Math.round(estimated * TAX_MULTIPLIER);
      acc[key] = {
        base: estimated,
        total,
        note: miles > 0 ? `Driving distance ${miles.toFixed(1)} miles at $${rate}/mile.` : "Distance Matrix unavailable, minimum fare applied.",
      };
      return acc;
    }, {} as Record<VehicleKey, { base: number; total: number; note: string }>);
  }, [routeKey, drivingMiles]);

  const chosen = priceByVehicle[selectedVehicle];

  const handleCheckout = async () => {
    if (!firstName || !lastName || !phone || !email) {
      window.alert("Please enter first name, last name, phone, and email before payment.");
      return;
    }

    try {
      setPaymentError("");
      setIsPaying(true);
      const reservationRes = await fetch("/api/send-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          phone,
          email,
          vehicle: VEHICLE_META[selectedVehicle].label,
          pickupAddress: booking.pickupLocation,
          dropoffAddress: booking.dropoffLocation,
          date: booking.pickupDate,
          time: booking.pickupTime,
          specialRequests: booking.specialRequests,
          totalPrice: chosen.total,
        }),
      });
      if (!reservationRes.ok) {
        throw new Error("Reservation email failed. Please try again.");
      }

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleName: VEHICLE_META[selectedVehicle].label,
          finalPrice: chosen.total,
        }),
      });
      if (!response.ok) {
        throw new Error("Unable to create checkout session");
      }
      const data = (await response.json()) as { sessionId: string; url?: string | null };
      if (!data.url) {
        throw new Error("Checkout URL missing");
      }
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment redirection failed";
      setPaymentError(message);
    } finally {
      setIsPaying(false);
    }
  };

  const handleGoBack = () => {
    const params = new URLSearchParams({
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime,
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation,
      specialRequests: booking.specialRequests,
    });
    router.push(`/?${params.toString()}#book`);
  };

  return (
    <main className="confirmation-page">
      <div className="container confirmation-wrap">
        <div className="confirmation-summary">
          <span className="section-label">Pricing &amp; Confirmation</span>
          <h1 className="section-title confirmation-main-title">Your <em>Trip</em> &amp; Live Pricing</h1>
          <div className="divider"></div>
          <p><strong>Pick-Up:</strong> <span className="confirmation-value">{booking.pickupLocation || "Not provided"}</span></p>
          <p><strong>Drop-Off:</strong> <span className="confirmation-value">{booking.dropoffLocation || "Not provided"}</span></p>
          <p><strong>Date:</strong> <span className="confirmation-value">{booking.pickupDate || "Not provided"}</span></p>
          <p><strong>Time:</strong> <span className="confirmation-value">{booking.pickupTime || "Not provided"}</span></p>
          <p><strong>Pricing Mode:</strong> <span className="confirmation-value">{routeKey ? "Flat airport route rate" : "Distance Matrix per-mile pricing"}</span></p>
        </div>

        <div className="confirmation-card">
          <div className="confirmation-grid">
            {(Object.keys(VEHICLE_META) as VehicleKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`confirmation-vehicle-card ${selectedVehicle === key ? "selected" : ""}`}
                onClick={() => setSelectedVehicle(key)}
              >
                <img src={VEHICLE_META[key].image} alt={VEHICLE_META[key].label} className="confirmation-vehicle" />
                <p className="confirmation-vehicle-title">{VEHICLE_META[key].label}</p>
                <p className="confirmation-price-small">${priceByVehicle[key].total} <span className="price-incl-note">incl. taxes &amp; fees</span></p>
              </button>
            ))}
          </div>
          <div className="confirmation-price">${chosen.total} <span className="confirmation-price-note">incl. taxes &amp; fees</span></div>
          <div className="confirmation-breakdown">
            <p><strong>Selected vehicle:</strong> <span className="confirmation-value">{VEHICLE_META[selectedVehicle].label}</span></p>
            <p><strong>Base fare:</strong> <span className="confirmation-value">${chosen.base}</span></p>
            <p><strong>Total:</strong> <span className="confirmation-value">${chosen.total}</span></p>
            <p><strong>Driving distance:</strong> <span className="confirmation-value">{chosen.note}</span></p>
            {booking.specialRequests ? <p><strong>Special requests:</strong> <span className="confirmation-value">{booking.specialRequests}</span></p> : null}
          </div>
          <div className="confirmation-name-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jonathan" />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Whitmore" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (516) 614-9134" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
            </div>
          </div>
          <div className="confirmation-actions">
            <button className="btn-primary" onClick={handleCheckout} disabled={isPaying}>{isPaying ? "Redirecting..." : "Confirm & Pay"}</button>
            <button className="btn-outline" onClick={handleGoBack}>Go Back</button>
          </div>
          {paymentError ? <p className="status-error">{paymentError}</p> : null}
        </div>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<main className="confirmation-page"><div className="container confirmation-wrap"><div className="confirmation-summary"><span className="section-label">Pricing &amp; Confirmation</span><h1 className="section-title">Loading...</h1></div></div></main>}>
      <ConfirmationContent />
    </Suspense>
  );
}
