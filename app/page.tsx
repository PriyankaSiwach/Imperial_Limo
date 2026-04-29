"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pickupInputRef = useRef<HTMLInputElement | null>(null);
  const dropoffInputRef = useRef<HTMLInputElement | null>(null);
  const [booking, setBooking] = useState({
    pickupDate: "",
    pickupTime: "",
    pickupLocation: "",
    dropoffLocation: "",
    specialRequests: "",
  });
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "General Inquiry",
    message: "",
  });
  const [contactStatus, setContactStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSendingContact, setIsSendingContact] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pickupDate = params.get("pickupDate") || "";
    const pickupTime = params.get("pickupTime") || "";
    const pickupLocation = params.get("pickupLocation") || "";
    const dropoffLocation = params.get("dropoffLocation") || "";
    const specialRequests = params.get("specialRequests") || "";
    if (pickupDate || pickupTime || pickupLocation || dropoffLocation || specialRequests) {
      setBooking({ pickupDate, pickupTime, pickupLocation, dropoffLocation, specialRequests });
    }
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    const initAutocomplete = () => {
      const googleApi = (window as any).google;
      if (!googleApi?.maps?.places?.Autocomplete) return;

      const bindAutocomplete = (input: HTMLInputElement | null, field: "pickupLocation" | "dropoffLocation") => {
        if (!input) return;
        const autocomplete = new googleApi.maps.places.Autocomplete(input, {
          fields: ["formatted_address", "name"],
          types: ["geocode"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const formatted = place?.formatted_address || place?.name || input.value;
          setBooking((prev) => ({ ...prev, [field]: formatted }));
          input.value = formatted;
        });
      };

      bindAutocomplete(pickupInputRef.current, "pickupLocation");
      bindAutocomplete(dropoffInputRef.current, "dropoffLocation");
    };

    if ((window as any).google?.maps?.places) {
      initAutocomplete();
      return;
    }

    const scriptId = "google-places-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", initAutocomplete);
    return () => script?.removeEventListener("load", initAutocomplete);
  }, []);

  useEffect(() => {
    const cursor = document.getElementById("cursor");
    const ring = document.getElementById("cursorRing");
    if (!cursor || !ring) return;

    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      (cursor as HTMLElement).style.left = mx + "px";
      (cursor as HTMLElement).style.top = my + "px";
    };

    const animRing = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      (ring as HTMLElement).style.left = rx + "px";
      (ring as HTMLElement).style.top = ry + "px";
      requestAnimationFrame(animRing);
    };

    document.addEventListener("mousemove", onMouseMove);
    animRing();

    document.querySelectorAll("a, button, .service-item, .fleet-card").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        (cursor as HTMLElement).style.width = "16px";
        (cursor as HTMLElement).style.height = "16px";
        (ring as HTMLElement).style.width = "50px";
        (ring as HTMLElement).style.height = "50px";
        (ring as HTMLElement).style.borderColor = "rgba(201,168,76,0.8)";
      });
      el.addEventListener("mouseleave", () => {
        (cursor as HTMLElement).style.width = "8px";
        (cursor as HTMLElement).style.height = "8px";
        (ring as HTMLElement).style.width = "32px";
        (ring as HTMLElement).style.height = "32px";
        (ring as HTMLElement).style.borderColor = "rgba(201,168,76,0.5)";
      });
    });

    const nav = document.getElementById("navbar");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    document.getElementById("hero")?.classList.add("loaded");

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

    const countUp = (el: Element, target: number, suffix = "") => {
      let start = 0;
      const duration = 1800;
      const step = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        (el as HTMLElement).textContent = target >= 1000 ? current.toLocaleString() + suffix : current + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else
          (el as HTMLElement).textContent = target >= 1000 ? target.toLocaleString() + suffix : target + suffix;
      };
      requestAnimationFrame(step);
    };

    const statNums = document.querySelectorAll("[data-count]");
    const statObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const val = parseInt(el.dataset.count || "0", 10);
            const suffix = el.dataset.suffix || "";
            countUp(el, val, suffix);
            statObs.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    statNums.forEach((el) => statObs.observe(el));

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = (a as HTMLAnchorElement).getAttribute("href");
        if (!href) return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth" });
        }
      });
    });

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      statObs.disconnect();
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
    if (!booking.pickupLocation || !booking.dropoffLocation || !booking.pickupDate || !booking.pickupTime) {
      window.alert("Please fill pickup, dropoff, date, and time.");
      return;
    }
    const params = new URLSearchParams({
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime,
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation,
      specialRequests: booking.specialRequests,
    });
    router.push(`/confirmation?${params.toString()}`);
  };

  const handleContact = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
      setContactStatus({ type: "error", message: "Please complete all contact fields." });
      return;
    }

    try {
      setIsSendingContact(true);
      setContactStatus(null);
      const response = await fetch("/api/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to send message. Please try again.");
      }
      setContactStatus({ type: "success", message: "Message sent successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      setContactStatus({ type: "error", message });
    } finally {
      setIsSendingContact(false);
    }
  };

  return (
    <>

<div className="cursor" id="cursor"></div>
<div className="cursor-ring" id="cursorRing"></div>

{/* NAV */}
<nav id="navbar">
  <a href="#hero" className="nav-logo" onClick={() => setMobileNavOpen(false)}>
    <img src="/images/logo_1.png" alt="Imperial Limousine logo" className="nav-logo-image" />
    <span>Imperial Limousine</span>
  </a>
  <ul className="nav-links">
    <li><a href="#fleet">Fleet</a></li>
    <li><a href="#services">Services</a></li>
    <li><a href="#about">About</a></li>
    <li><a href="#contact">Contact</a></li>
  </ul>
  <a href="#book" className="nav-cta">Reserve Now</a>
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
      <a href="#fleet" onClick={() => setMobileNavOpen(false)}>
        Fleet
      </a>
    </li>
    <li>
      <a href="#services" onClick={() => setMobileNavOpen(false)}>
        Services
      </a>
    </li>
    <li>
      <a href="#book" onClick={() => setMobileNavOpen(false)}>
        Book
      </a>
    </li>
    <li>
      <a href="#about" onClick={() => setMobileNavOpen(false)}>
        About
      </a>
    </li>
    <li>
      <a href="#testimonials" onClick={() => setMobileNavOpen(false)}>
        Reviews
      </a>
    </li>
    <li>
      <a href="#contact" onClick={() => setMobileNavOpen(false)}>
        Contact
      </a>
    </li>
  </ul>
  <a href="#book" className="nav-cta nav-mobile-cta" onClick={() => setMobileNavOpen(false)}>
    Reserve Now
  </a>
</div>

{/* HERO */}
<section id="hero">
  <div className="hero-bg"></div>
  <div className="hero-grain"></div>
  <div className="hero-content">
    <h1 className="hero-title">Arrive in<br /><em>Absolute</em><br />Elegance</h1>
    <p className="hero-sub">Professional chauffeurs · Immaculate fleet · Uncompromising standards</p>
    <div className="hero-btns">
      <a href="#book" className="btn-primary">Reserve Your Ride</a>
      <a href="#fleet" className="btn-outline">View Our Fleet</a>
    </div>
  </div>
  <div className="hero-scroll">
    <span className="scroll-text">Scroll</span>
    <div className="scroll-line"></div>
  </div>
  <div className="hero-ticker">
    <div className="ticker-track" id="ticker">
      <span className="ticker-item">Cadillac Escalade</span><span className="ticker-dot"></span>
      <span className="ticker-item">Mercedes S-Class</span><span className="ticker-dot"></span>
      <span className="ticker-item">BMW 7 Series</span><span className="ticker-dot"></span>
      <span className="ticker-item">Lincoln Navigator</span><span className="ticker-dot"></span>
      <span className="ticker-item">NYC Airport Transfers</span><span className="ticker-dot"></span>
      <span className="ticker-item">Corporate Travel</span><span className="ticker-dot"></span>
      <span className="ticker-item">Event Transportation</span><span className="ticker-dot"></span>
      <span className="ticker-item">24/7 Availability</span><span className="ticker-dot"></span>
      <span className="ticker-item">Cadillac Escalade</span><span className="ticker-dot"></span>
      <span className="ticker-item">Mercedes S-Class</span><span className="ticker-dot"></span>
      <span className="ticker-item">BMW 7 Series</span><span className="ticker-dot"></span>
      <span className="ticker-item">Lincoln Navigator</span><span className="ticker-dot"></span>
      <span className="ticker-item">NYC Airport Transfers</span><span className="ticker-dot"></span>
      <span className="ticker-item">Corporate Travel</span><span className="ticker-dot"></span>
      <span className="ticker-item">Event Transportation</span><span className="ticker-dot"></span>
      <span className="ticker-item">24/7 Availability</span><span className="ticker-dot"></span>
    </div>
  </div>
</section>

{/* FLEET */}
<section id="fleet">
  <div className="container">
    <div className="fleet-header reveal">
      <span className="section-label">Our Vehicles</span>
      <h2 className="section-title">The <em>Finest</em> Fleet<br />in New York</h2>
      <div className="divider"></div>
      <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "500px", margin: "0 auto", lineHeight: 2, fontWeight: 300 }}>Every vehicle in our collection is meticulously maintained, detailed to perfection, and driven by professionals trained to the highest standard.</p>
    </div>
    <div className="fleet-grid reveal reveal-delay-1">
      <div className="fleet-card fleet-card-featured">
        <img src="/images/escalade2.png" alt="Black Cadillac Escalade" loading="lazy" />
        <div className="fleet-card-info">
          <span className="fleet-name">Cadillac Escalade ESV</span>
          <span className="fleet-type">Full-Size Luxury SUV · Up to 6 Passengers</span>
        </div>
      </div>
      <div className="fleet-card">
        <img src="/images/mercedes1.png" alt="Mercedes S-Class" loading="lazy" />
        <div className="fleet-card-info">
          <span className="fleet-name">Mercedes S-Class</span>
          <span className="fleet-type">Executive Sedan · Up to 3 Passengers</span>
        </div>
      </div>
      <div className="fleet-card">
        <img src="/images/escalade1.jpeg" alt="Black SUV" loading="lazy" />
        <div className="fleet-card-info">
          <span className="fleet-name">Cadillac Escalade Luxury</span>
          <span className="fleet-type">Premium Escalade SUV · Up to 6 Passengers</span>
        </div>
      </div>
      <div className="fleet-card">
        <img src="/images/bmw3.png" alt="BMW 7 Series" loading="lazy" />
        <div className="fleet-card-info">
          <span className="fleet-name">BMW 7 Series</span>
          <span className="fleet-type">Ultra-Luxury Sedan · Up to 3 Passengers</span>
        </div>
      </div>
      <div className="fleet-card">
        <img src="/images/mercedes_E.png" alt="Mercedes E-Class Business Sedan" loading="lazy" />
        <div className="fleet-card-info">
          <span className="fleet-name">Mercedes E-Class Business Sedan</span>
          <span className="fleet-type">Executive Sedan · Up to 3 Passengers</span>
        </div>
      </div>
    </div>
  </div>
</section>

{/* STATS */}
<div className="stats-bar">
  <div className="container">
    <div className="stats-grid">
      <div className="stat-item reveal">
        <span className="stat-num" data-count="12" data-suffix="">0</span>
        <span className="stat-label">Years in New York</span>
      </div>
      <div className="stat-item reveal reveal-delay-1">
        <span className="stat-num" data-count="50000" data-suffix="+">0</span>
        <span className="stat-label">Rides Completed</span>
      </div>
      <div className="stat-item reveal reveal-delay-2">
        <span className="stat-num" data-count="98" data-suffix="%">0</span>
        <span className="stat-label">% On-Time Rate</span>
      </div>
      <div className="stat-item reveal reveal-delay-3">
        <span className="stat-num" data-count="24" data-suffix="">0</span>
        <span className="stat-label">Hours Available</span>
      </div>
    </div>
  </div>
</div>

{/* SERVICES */}
<section id="services">
  <div className="container">
    <div className="services-layout">
      <div>
        <span className="section-label reveal">What We Offer</span>
        <h2 className="section-title reveal reveal-delay-1">Tailored<br />For <em>Every</em><br />Occasion</h2>
        <div className="divider reveal reveal-delay-2"></div>
        <ul className="service-list">
          <li className="service-item reveal reveal-delay-1">
            <span className="service-num">01</span>
            <div className="service-text">
              <h3>Airport Transfers</h3>
              <p>JFK, LaGuardia &amp; Newark. Flight tracking, meet & greet, waiting time included.</p>
            </div>
            <span className="service-arrow">→</span>
          </li>
          <li className="service-item reveal reveal-delay-2">
            <span className="service-num">02</span>
            <div className="service-text">
              <h3>Corporate Travel</h3>
              <p>Seamless executive transportation for meetings, roadshows, and daily commutes.</p>
            </div>
            <span className="service-arrow">→</span>
          </li>
          <li className="service-item reveal reveal-delay-3">
            <span className="service-num">03</span>
            <div className="service-text">
              <h3>Events &amp; Galas</h3>
              <p>Red carpet arrivals, weddings, Broadway shows, and private NYC events.</p>
            </div>
            <span className="service-arrow">→</span>
          </li>
          <li className="service-item reveal reveal-delay-4">
            <span className="service-num">04</span>
            <div className="service-text">
              <h3>City Tours</h3>
              <p>Explore New York in unparalleled comfort with a knowledgeable private chauffeur.</p>
            </div>
            <span className="service-arrow">→</span>
          </li>
          <li className="service-item reveal">
            <span className="service-num">05</span>
            <div className="service-text">
              <h3>Hourly As-Directed</h3>
              <p>Your personal driver, available by the hour for complete city flexibility.</p>
            </div>
            <span className="service-arrow">→</span>
          </li>
        </ul>
      </div>
      <div className="services-visual">
        <div className="services-img-wrap reveal">
          <img src="/images/chauffer.png" alt="Luxury chauffeur service NYC" loading="lazy" />
          <div className="services-img-accent"></div>
          <div className="services-img-label">Est. 2013 · New York</div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* BOOK */}
<section id="book">
  <div className="container">
    <div className="book-layout">
      <div className="book-info">
        <span className="section-label reveal">Reservations</span>
        <h2 className="book-info-title reveal reveal-delay-1">Reserve<br />Your <em>Ride</em><br />Today</h2>
        <div className="divider reveal reveal-delay-2"></div>
        <p className="book-info-text reveal reveal-delay-3">Every booking is confirmed within minutes, backed by our guarantee of punctuality and discretion. Your comfort is our command.</p>
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
          <input ref={pickupInputRef} type="text" placeholder="Address, hotel, or airport terminal" value={booking.pickupLocation} onChange={(e) => setBooking((prev) => ({ ...prev, pickupLocation: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Drop-Off Location</label>
          <input ref={dropoffInputRef} type="text" placeholder="Address, hotel, or airport terminal" value={booking.dropoffLocation} onChange={(e) => setBooking((prev) => ({ ...prev, dropoffLocation: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Special Requests</label>
          <textarea placeholder="Child seat, extra stops, preferred route..." value={booking.specialRequests} onChange={(e) => setBooking((prev) => ({ ...prev, specialRequests: e.target.value }))}></textarea>
        </div>
        <button className="form-submit" onClick={handleBooking}>Explore Prices →</button>
      </div>
    </div>
  </div>
</section>

{/* ABOUT */}
<section id="about">
  <div className="about-bg-text">IMPERIAL</div>
  <div className="container">
    <div className="about-layout">
      <div className="about-images reveal">
        <div className="about-img-main">
          <img src="/images/chauffer3.png" alt="Professional chauffeur" loading="lazy" />
        </div>
        <div className="about-img-secondary">
          <img src="/images/bmw1.png" alt="BMW 7 Series interior" loading="lazy" />
        </div>
        <div className="about-badge">
          <span className="about-badge-num">12+</span>
          <span className="about-badge-text">Years of Excellence</span>
        </div>
      </div>
      <div className="about-text">
        <span className="section-label reveal">Our Story</span>
        <h2 className="section-title reveal reveal-delay-1">New York's<br /><em>Standard</em> of<br />Luxury</h2>
        <div className="divider reveal reveal-delay-2"></div>
        <p className="about-body reveal reveal-delay-2">Founded on the streets of Manhattan in 2013, Imperial Limousine was built on a singular conviction: that true luxury is found in the details. From the temperature of your cabin to the silence of your journey, every element is curated with intention.</p>
        <p className="about-body reveal reveal-delay-3">Our fleet of all-black vehicles — impeccably maintained and driven by livery-licensed professionals — serves the city's most discerning clients, from Wall Street executives to visiting heads of state.</p>
        <div className="about-values reveal reveal-delay-4">
          <div className="value-item">
            <h4>Discretion</h4>
            <p>Your privacy is sacred. We never discuss our clients.</p>
          </div>
          <div className="value-item">
            <h4>Punctuality</h4>
            <p>We don't just meet your schedule — we anticipate it.</p>
          </div>
          <div className="value-item">
            <h4>Presentation</h4>
            <p>Uniformed, immaculate, and always professional.</p>
          </div>
          <div className="value-item">
            <h4>Reliability</h4>
            <p>Available 24/7, 365 days a year, rain or shine.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* TESTIMONIALS */}
<section id="testimonials">
  <div className="container">
    <div className="testimonials-header reveal">
      <span className="section-label">Client Testimonials</span>
      <h2 className="section-title">Trusted by <em>New York's</em><br />Most Demanding</h2>
      <div className="divider"></div>
    </div>
    <div className="testimonials-grid">
      <div className="testimonial-card reveal reveal-delay-1">
        <span className="testimonial-quote">"</span>
        <span className="stars">★★★★★</span>
        <p className="testimonial-text">Imperial Limousine is the only car service I trust when I have clients in from overseas. Impeccably dressed driver, spotless Escalade, and they handled my client's tight airport connection without a single issue.</p>
        <div className="testimonial-author">
          <div className="author-avatar">M</div>
          <div>
            <span className="author-name">Marcus T.</span>
            <span className="author-title">Managing Director, Midtown Finance</span>
          </div>
        </div>
      </div>
      <div className="testimonial-card reveal reveal-delay-2">
        <span className="testimonial-quote">"</span>
        <span className="stars">★★★★★</span>
        <p className="testimonial-text">We used Imperial Limousine for our entire wedding weekend — from rehearsal dinner to the post-reception send-off. The coordination was flawless. The S-Class was gorgeous. Every guest was impressed.</p>
        <div className="testimonial-author">
          <div className="author-avatar">S</div>
          <div>
            <span className="author-name">Serena &amp; David</span>
            <span className="author-title">Tribeca Wedding, September 2024</span>
          </div>
        </div>
      </div>
      <div className="testimonial-card reveal reveal-delay-3">
        <span className="testimonial-quote">"</span>
        <span className="stars">★★★★★</span>
        <p className="testimonial-text">I've had car services across 40 cities. Imperial Limousine is simply the best in New York. The driver knew my preferences before I said a word — quiet, climate-controlled, and waiting exactly where I needed him.</p>
        <div className="testimonial-author">
          <div className="author-avatar">R</div>
          <div>
            <span className="author-name">Rebecca L.</span>
            <span className="author-title">Partner, Upper East Side Law Firm</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* CONTACT */}
<section id="contact">
  <div className="container">
    <div className="contact-layout">
      <div className="contact-info">
        <span className="section-label reveal">Get In Touch</span>
        <h2 className="section-title reveal reveal-delay-1">We're Always<br /><em>On Call</em></h2>
        <div className="divider reveal reveal-delay-2"></div>
        <p style={{ fontSize: "13px", lineHeight: 2, color: "var(--muted)", fontWeight: 300, marginBottom: "48px" }} className="reveal reveal-delay-3">Whether you need an immediate pickup, want to arrange corporate accounts, or simply have questions — our concierge team is standing by around the clock.</p>
        <div className="contact-item reveal reveal-delay-1">
          <div className="contact-icon">☎</div>
          <div>
            <h4>Phone &amp; Text</h4>
            <p>1. 5166149134</p>
          </div>
        </div>
        <div className="contact-item reveal reveal-delay-2">
          <div className="contact-icon">✉</div>
          <div>
            <h4>Email</h4>
            <p>imperiallimony@gmail.com<br />reservations.imperiallimo@gmail.com</p>
          </div>
        </div>
        <div className="contact-item reveal reveal-delay-3">
          <div className="contact-icon">◎</div>
          <div>
            <h4>Service Area</h4>
            <p>New York City &amp; Tri-State Area<br />JFK · LGA · EWR · HPN · Hampton</p>
          </div>
        </div>
      </div>
      <div className="contact-form-wrap reveal reveal-delay-2">
        <h3 className="form-title" style={{ marginBottom: "32px" }}>Send a Message</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input type="text" placeholder="Your full name" value={contactForm.name} onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="your@email.com" value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label>Subject</label>
          <select value={contactForm.subject} onChange={(e) => setContactForm((prev) => ({ ...prev, subject: e.target.value }))}>
            <option>General Inquiry</option>
            <option>Corporate Account</option>
            <option>Booking Modification</option>
            <option>Fleet &amp; Pricing</option>
            <option>Other</option>
          </select>
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea placeholder="How can we assist you?" style={{ minHeight: "160px" }} value={contactForm.message} onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))}></textarea>
        </div>
        <button className="form-submit" onClick={handleContact} disabled={isSendingContact}>{isSendingContact ? "Sending..." : "Send Message →"}</button>
        {contactStatus ? <p className={contactStatus.type === "success" ? "status-success" : "status-error"}>{contactStatus.message}</p> : null}
      </div>
    </div>
  </div>
</section>

{/* FOOTER */}
<footer>
  <div className="container">
    <div className="footer-top">
      <div>
        <a href="#hero" className="footer-logo">Imperial Limousine</a>
        <p className="footer-about">New York's premier black car service. Luxury, discretion, and professionalism on every journey since 2013.</p>
        <div className="footer-socials">
          <a className="social-btn" href="https://www.instagram.com/imperial_limousine_ny_" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
        </div>
      </div>
      <div className="footer-col">
        <h5>Services</h5>
        <ul>
          <li><a href="#services">Airport Transfers</a></li>
          <li><a href="#services">Corporate Travel</a></li>
          <li><a href="#services">Events &amp; Galas</a></li>
          <li><a href="#services">City Tours</a></li>
          <li><a href="#services">Hourly Service</a></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Company</h5>
        <ul>
          <li><a href="#about">About Us</a></li>
          <li><a href="#fleet">Our Fleet</a></li>
          <li><a href="#testimonials">Reviews</a></li>
          <li><a href="#contact">Contact</a></li>
          <li><a href="#book">Book Now</a></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Contact</h5>
        <ul>
          <li><a href="tel:15166149134">1. 5166149134</a></li>
          <li><a href="mailto:imperiallimony@gmail.com">imperiallimony@gmail.com</a></li>
          <li><a href="mailto:reservations.imperiallimo@gmail.com">reservations.imperiallimo@gmail.com</a></li>
          <li><a href="#">New York, NY 10001</a></li>
          <li><a href="#">JFK · LGA · EWR · Hampton</a></li>
        </ul>
      </div>
    </div>
    <div className="footer-bottom">
      <p className="footer-copy">© 2025 <span>Imperial Limousine</span> Transportation. All rights reserved. New York City.</p>
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
