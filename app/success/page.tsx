export default function SuccessPage() {
  return (
    <main className="confirmation-page">
      <div className="container confirmation-wrap">
        <div className="confirmation-summary">
          <span className="section-label">Payment Success</span>
          <h1 className="section-title confirmation-main-title">Booking <em>Confirmed</em></h1>
          <div className="divider"></div>
          <p>
            <strong>Status:</strong> <span className="confirmation-value">Your payment was completed successfully.</span>
          </p>
          <p>
            <strong>Next Step:</strong> <span className="confirmation-value">Our concierge will contact you shortly with trip details.</span>
          </p>
        </div>
      </div>
    </main>
  );
}
