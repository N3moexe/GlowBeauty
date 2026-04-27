import { useState, useEffect } from "react";
import { Search, Loader, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/ProductCard";

interface AISearchProps {
  onClose?: () => void;
}

export default function AISearch({ onClose }: AISearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: searchResults, isLoading } = trpc.ai.search.intelligentSearch.useQuery(
    { query, limit: 20 },
    { enabled: !!query && query.length > 0 }
  );

  const { data: suggestionsList } = trpc.ai.search.getSearchSuggestions.useQuery(
    { query, limit: 5 },
    { enabled: query.length >= 2 }
  );

  useEffect(() => {
    setSuggestions(suggestionsList || []);
  }, [suggestionsList]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <Search className="h-5 w-5" />
          </div>
          <Input
            type="text"
            placeholder="Recherchez avec l'IA... (ex: 'Je cherche un téléphone pas cher')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            className="pl-16 pr-4 py-3 text-lg"
            autoFocus
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader className="h-5 w-5 animate-spin text-crimson" />
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg z-10">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Search Results */}
      {query && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-crimson" />
              <span className="ml-3 text-muted-foreground">Recherche en cours...</span>
            </div>
          ) : searchResults && searchResults.products.length > 0 ? (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                <p className="text-sm text-muted-foreground">
                  Intention détectée: <strong>{searchResults.intent}</strong> • {searchResults.count} résultat
                  {searchResults.count > 1 ? "s" : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {searchResults.products.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ) : query ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun produit trouvé pour "{query}"</p>
              <p className="text-sm text-muted-foreground mt-2">Essayez une autre recherche</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Trending Searches */}
      {!query && (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Recherche Intelligente</h3>
          <p className="text-muted-foreground mb-6">
            Utilisez le langage naturel pour trouver exactement ce que vous cherchez
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["téléphone pas cher", "vêtements pour femme", "électroménager", "chaussures de sport"].map(
              (example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery(example)}
                  className="text-xs"
                >
                  {example}
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
