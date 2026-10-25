import { useState } from "react";

interface PillarSlide {
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
}

const PILLARS: PillarSlide[] = [
  {
    icon: "🛡️",
    badge: "PILLAR 1: SOVEREIGN PRIVACY",
    title: "Zero Server Access",
    subtitle: "Your data lives exclusively on your device",
    description:
      "We operate zero central servers, zero cloud databases, and zero tracking analytics. Your personal files, financial accounts, and health records never leave your local hardware unencrypted.",
    highlights: [
      "100% on-device local storage",
      "No developer backdoors or cloud telemetry",
      "Zero server accounts required",
    ],
  },
  {
    icon: "🔐",
    badge: "PILLAR 2: MATHEMATICAL DEFENSE",
    title: "Client-Side Zero-Knowledge",
    subtitle: "Bank-grade AES-256-GCM local encryption",
    description:
      "Every document, prescription, and secret is encrypted in RAM using AES-256-GCM before touching disk. Only your master passphrase or 24-word recovery key holds the decryption math.",
    highlights: [
      "PBKDF2 with 100,000 hash iterations",
      "Unique 12-byte cryptographic IV per entity",
      "Unreadable to cloud providers & developers",
    ],
  },
  {
    icon: "📴",
    badge: "PILLAR 3: RESILIENCE & OWNERSHIP",
    title: "100% Sovereign & Offline-First",
    subtitle: "Instant access anywhere, zero internet needed",
    description:
      "Search records, scan receipts with local WebAssembly OCR, and access emergency life kits on flights or during network outages. Your life dock remains with you forever.",
    highlights: [
      "Full offline functionality guaranteed",
      "On-device OCR without external API calls",
      "One-click encrypted backup export (.mldv)",
    ],
  },
];

interface PillarsSlideshowProps {
  onComplete?: () => void;
  onSkip?: () => void;
  standalone?: boolean;
}

export function PillarsSlideshow({ onComplete, onSkip, standalone = false }: PillarsSlideshowProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slide = PILLARS.at(currentSlide) ?? PILLARS[0];

  function handleNext() {
    if (currentSlide < PILLARS.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else if (onComplete) {
      onComplete();
    }
  }

  function handlePrev() {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  }

  function handleSkip() {
    if (onSkip) {
      onSkip();
    } else if (onComplete) {
      onComplete();
    }
  }

  return (
    <div
      className="pillars-slideshow"
      style={{
        background: "rgba(15, 23, 42, 0.85)",
        border: "1px solid rgba(56, 189, 248, 0.25)",
        borderRadius: "16px",
        padding: "26px 22px",
        boxShadow: "0 14px 34px -5px rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(12px)",
        textAlign: "center",
        maxWidth: "540px",
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* Top Header: Badge + Skip Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            padding: "4px 12px",
            borderRadius: "999px",
            background: "rgba(56, 189, 248, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#38bdf8",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {slide.badge}
        </div>

        {(onSkip || onComplete) && !standalone ? (
          <button
            type="button"
            className="text-button"
            onClick={handleSkip}
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              fontWeight: 500,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>Skip</span>
            <span aria-hidden="true">➔</span>
          </button>
        ) : null}
      </div>

      {/* Slide Icon */}
      <div
        style={{
          fontSize: "48px",
          marginBottom: "12px",
          lineHeight: 1,
        }}
      >
        {slide.icon}
      </div>

      {/* Slide Title */}
      <h3
        style={{
          fontSize: "21px",
          fontWeight: 700,
          color: "#f8fafc",
          margin: "0 0 6px 0",
        }}
      >
        {slide.title}
      </h3>

      {/* Subtitle */}
      <p
        style={{
          color: "#38bdf8",
          fontSize: "13.5px",
          fontWeight: 600,
          margin: "0 0 12px 0",
        }}
      >
        {slide.subtitle}
      </p>

      {/* Description */}
      <p
        style={{
          color: "#cbd5e1",
          fontSize: "13.5px",
          lineHeight: "1.55",
          margin: "0 auto 18px auto",
          maxWidth: "460px",
        }}
      >
        {slide.description}
      </p>

      {/* Highlights List */}
      <div
        style={{
          background: "rgba(10, 15, 29, 0.65)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "10px",
          padding: "12px 16px",
          margin: "0 auto 20px auto",
          textAlign: "left",
          maxWidth: "430px",
        }}
      >
        {slide.highlights.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12.5px",
              color: "#cbd5e1",
              marginBottom: idx < slide.highlights.length - 1 ? "8px" : "0",
            }}
          >
            <span style={{ color: "#4ade80", fontWeight: "bold" }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Navigation Dots */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        {PILLARS.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            style={{
              width: currentSlide === idx ? "26px" : "8px",
              height: "8px",
              borderRadius: "4px",
              background: currentSlide === idx ? "#38bdf8" : "rgba(255, 255, 255, 0.2)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}
          />
        ))}
      </div>

      {/* Action Buttons: Prev/Skip on left, Next/Get Started on right */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {currentSlide > 0 ? (
          <button
            type="button"
            className="secondary-button"
            onClick={handlePrev}
            style={{ fontSize: "13px", padding: "8px 16px" }}
          >
            ← Previous
          </button>
        ) : (onSkip || onComplete) && !standalone ? (
          <button
            type="button"
            className="secondary-button"
            onClick={handleSkip}
            style={{ fontSize: "13px", padding: "8px 16px", color: "#94a3b8" }}
          >
            Skip
          </button>
        ) : (
          <div style={{ width: "80px" }} />
        )}

        {standalone && onComplete ? (
          <button
            type="button"
            className="secondary-button"
            onClick={onComplete}
            style={{ fontSize: "13px", padding: "8px 16px" }}
          >
            Close
          </button>
        ) : null}

        <button
          type="button"
          className="pillar-action-btn"
          onClick={handleNext}
          style={{
            background: "#38bdf8",
            color: "#0f172a",
            fontWeight: 700,
            border: "none",
            borderRadius: "8px",
            fontSize: "13.5px",
            padding: "9px 20px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(56, 189, 248, 0.3)",
          }}
        >
          <span>{currentSlide === PILLARS.length - 1 ? "Get Started" : "Next Pillar"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

export default PillarsSlideshow;
