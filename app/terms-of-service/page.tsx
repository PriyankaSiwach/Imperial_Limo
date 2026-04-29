export default function TermsOfServicePage() {
  return (
    <main className="confirmation-page">
      <div className="container confirmation-wrap">
        <div className="confirmation-summary">
          <span className="section-label">Imperial Limousine NY</span>
          <h1 className="section-title confirmation-main-title">Terms of <em>Service</em></h1>
          <div className="divider"></div>

          <p>
            <strong>Effective Date:</strong>{" "}
            <span className="confirmation-value">April 29, 2026</span>
          </p>

          <p>
            <strong>Booking and cancellation policy:</strong>{" "}
            <span className="confirmation-value">
              Reservations are confirmed after request review. Cancellations and changes should be made as early as possible. Late cancellations may incur fees.
            </span>
          </p>

          <p>
            <strong>Payment terms:</strong>{" "}
            <span className="confirmation-value">
              Payment is due according to the confirmed booking terms. Additional stops, waiting time, route changes, tolls, or extras may result in additional charges.
            </span>
          </p>

          <p>
            <strong>No-show policy:</strong>{" "}
            <span className="confirmation-value">
              If a passenger does not appear at the agreed pickup point within the allowed waiting period, the booking may be treated as a no-show and charged accordingly.
            </span>
          </p>

          <p>
            <strong>Liability limitations:</strong>{" "}
            <span className="confirmation-value">
              Imperial Limousine NY is not liable for delays or disruptions caused by traffic, weather, road closures, or events outside our reasonable control.
            </span>
          </p>

          <p>
            <strong>Passenger conduct:</strong>{" "}
            <span className="confirmation-value">
              Passengers must follow all safety rules and lawful conduct requirements. We may refuse service for unsafe, abusive, or unlawful behavior.
            </span>
          </p>

          <p>
            <strong>Pricing and availability:</strong>{" "}
            <span className="confirmation-value">
              Rates shown on the website are estimates unless otherwise confirmed. Pricing, service areas, and availability are subject to change without prior notice.
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
