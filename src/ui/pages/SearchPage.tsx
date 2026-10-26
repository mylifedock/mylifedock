import { useEffect, useState } from "react";
import { universalSearch, type SearchResult, type SearchResultType } from "../../application/searchService";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageHeader";
import { resultDestination, type Destination } from "../navigation";

const TYPE_LABELS: Record<SearchResultType, string> = {
  document: "Document",
  product: "Product",
  warranty: "Warranty",
  insurance: "Insurance",
  finance: "Account",
  subscription: "Subscription",
  vehicle: "Vehicle",
  property: "Property",
  reminder: "Reminder",
  secret: "Secret",
  medical: "Medical",
};

export function SearchPage({
  query,
  onQueryChange,
  onOpen,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onOpen: (destination: Destination) => void;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        setIsSearching(true);
        setResults(await universalSearch(query));
      } catch {
        showToast("Search failed", "error");
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [query, showToast]);

  return (
    <div className="page-container fade-in">
      <PageHeader title="Search" subtitle="Find anything in your vault, including family members' records." />

      <input
        type="search"
        className="search-page-input"
        placeholder="Search documents, policies, accounts, people…"
        aria-label="Search your vault"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoFocus
      />

      {isSearching && <div className="muted-text" role="status">Searching...</div>}

      {!isSearching && query.trim() && results.length === 0 && (
        <div className="empty-state">No results for "{query}"</div>
      )}

      <div className="search-results">
        {results.map((r) => (
          <button key={`${r.type}-${r.id}`} type="button" className="search-result" onClick={() => onOpen(resultDestination(r))}>
            <span className="search-result-type">{TYPE_LABELS[r.type]}</span>
            <span className="search-result-text">
              <strong>{r.title}</strong>
              <small>{r.subtitle}</small>
            </span>
            <span className="search-result-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SearchPage;
