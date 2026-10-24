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
      "100% on-device IndexedDB storage",
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
  standalone?: boolean;
}

export function PillarsSlideshow({ onComplete, standalone = false }: PillarsSlideshowProps) {
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

  return (
    <div
      className="pillars-slideshow"
      style={{
        background: "rgba(15, 23, 42, 0.75)",
        border: "1px solid rgba(56, 189, 248, 0.25)",
        borderRadius: "14px",
        padding: "24px 20px",
        boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(12px)",
        textAlign: "center",
        maxWidth: "540px",
        margin: "0 auto 20px auto",
      }}
    >
      {/* Slide Badge */}
      <div
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: "999px",
          background: "rgba(56, 189, 248, 0.12)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          color: "#38bdf8",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          marginBottom: "14px",
        }}
      >
        {slide.badge}
      </div>

      {/* Slide Icon */}
      <div
        style={{
          fontSize: "44px",
          marginBottom: "10px",
          lineHeight: 1,
        }}
      >
        {slide.icon}
      </div>

      {/* Slide Title */}
      <h3
        style={{
          fontSize: "20px",
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
          margin: "0 auto 16px auto",
          maxWidth: "460px",
        }}
      >
        {slide.description}
      </p>

      {/* Highlights List */}
      <div
        style={{
          background: "rgba(10, 15, 29, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "8px",
          padding: "10px 14px",
          margin: "0 auto 18px auto",
          textAlign: "left",
          maxWidth: "420px",
        }}
      >
        {slide.highlights.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12.5px",
              color: "#94a3b8",
              marginBottom: idx < slide.highlights.length - 1 ? "6px" : "0",
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
          marginBottom: "18px",
        }}
      >
        {PILLARS.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            style={{
              width: currentSlide === idx ? "24px" : "8px",
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

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
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
        ) : (
          <div style={{ width: "85px" }} />
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
            fontWeight: 600,
            border: "none",
            borderRadius: "6px",
            fontSize: "13.5px",
            padding: "8px 18px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
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
