import { useState, useEffect, useRef } from "react";
import { universalSearch, type SearchResult } from "../../application/searchService";
import { useToast } from "../components/Toast";

// Web Speech API types
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export function SearchPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { showToast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Show whatever we have so far
        setQuery(finalTranscript || interimTranscript);
      };

      recognitionRef.current.onerror = () => {
        showToast("Voice search connection lost", "error");
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [showToast]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        showToast("Voice search not supported in this browser.", "error");
        return;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        // Handle case where it's already started
      }
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        setIsSearching(true);
        const res = await universalSearch(query);
        setResults(res);
      } catch {
        showToast("Search failed", "error");
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, showToast]);

  function handleResultClick(type: string) {
    if (!onNavigate) return;
    
    let targetPage: string | undefined;
    switch (type) {
      case "document": targetPage = "documents"; break;
      case "product": targetPage = "products"; break;
      case "finance": targetPage = "finance"; break;
      case "vehicle":
      case "property": targetPage = "assets"; break;
      case "coverage": targetPage = "products"; break;
      case "reminder": targetPage = "reminders"; break;
      case "secret": targetPage = "secrets"; break;
      case "medical": targetPage = "medical"; break;
      default: targetPage = undefined;
    }

    if (targetPage) {
      onNavigate(targetPage);
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Universal Search</h1>
          <p className="page-subtitle">Instantly find documents, products, assets, and more.</p>
        </div>
      </div>

      <div style={{ marginBottom: "24px", position: "relative" }}>
        <input
          type="search"
          placeholder="Search your vault..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "16px",
            paddingRight: "60px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "#151b2b",
            color: "#fff",
          }}
          autoFocus
        />
        <button
          onClick={toggleListening}
          title="Voice Search"
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: isListening ? "var(--color-primary)" : "#7a8ba8",
            cursor: "pointer",
            fontSize: "24px"
          }}
        >
          {isListening ? "🎙️" : "🎤"}
        </button>
      </div>

      {isSearching && <div style={{ color: "#7a8ba8" }}>Searching...</div>}

      {!isSearching && query && results.length === 0 && (
        <div className="empty-state">No results found for "{query}"</div>
      )}

      <div className="grid-list">
        {results.map((r) => (
          <div 
            key={r.id} 
            className="card fade-in"
            onClick={() => handleResultClick(r.type)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleResultClick(r.type); } }}
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div className="card-header">
              <h3>{r.title}</h3>
              <span className="status-badge active">{r.type.toUpperCase()}</span>
            </div>
            <div className="card-body">
              <p>{r.subtitle}</p>
              <div style={{ marginTop: "12px", fontSize: "13.5px", fontWeight: 600, color: "var(--color-primary)" }}>
                Click to view in {r.type}s →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchPage;
