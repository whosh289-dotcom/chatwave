import { useEffect, useState, useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Plus, Sparkles, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface Gif {
  id: string;
  url: string;
  artist_name?: string;
}

interface GifPickerProps {
  onPick: (url: string) => void;
}

// Curated reliable public GIFs (zero Giphy, direct CDN links)
const FALLBACK_GIFS: Gif[] = [
  { id: "f1", url: "https://media.tenor.com/aGj-frNYMFEAAAAM/cat-cat-dance.gif", artist_name: "Cat Dance" },
  { id: "f2", url: "https://media.tenor.com/WIv5hUoIVHIAAAAM/cat-yes-sir.gif", artist_name: "Yes Sir" },
  { id: "f3", url: "https://media.tenor.com/OAmsNF7THbsAAAAM/cat-dancing-cat.gif", artist_name: "Vibing Cat" },
  { id: "f4", url: "https://media.tenor.com/ejvK-0-pbH4AAAAM/shocked-shocked-cat.gif", artist_name: "Shocked" },
  { id: "f5", url: "https://media.tenor.com/Wid2X8CXwusAAAAM/screaming-cat-cat.gif", artist_name: "Screaming" },
  { id: "f6", url: "https://media.tenor.com/eKcXzYB0Eu8AAAAM/angry.gif", artist_name: "Angry Face" },
  { id: "f7", url: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif", artist_name: "Rotating Earth" },
  { id: "f8", url: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Newtons_cradle_animation_book.gif", artist_name: "Newton's Cradle" },
  { id: "f9", url: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Muybridge_race_horse_animated.gif", artist_name: "Running Horse" },
  { id: "f10", url: "https://upload.wikimedia.org/wikipedia/commons/2/25/3Ring_release_animation.gif", artist_name: "Chain Reaction" }
];

const CATEGORIES = [
  { label: "Trending", query: "trending" },
  { label: "😂 Laugh", query: "laugh" },
  { label: "🐱 Cats", query: "cat" },
  { label: "🎉 Party", query: "party" },
  { label: "👍 Yes", query: "yes" },
  { label: "❤️ Love", query: "love" },
  { label: "🔥 Wow", query: "wow" }
];

export function GifPicker({ onPick }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>(FALLBACK_GIFS);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("trending");
  const [view, setView] = useState<"browse" | "add">("browse");
  const { user } = useAuth();

  // Custom sticker upload state
  const [customUrl, setCustomUrl] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const fetchGifs = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const q = searchQuery.trim();
      const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(q || 'trending')}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setGifs(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Server GIF search failed, trying fallback:", err);
    }

    // Try DB custom stickers if available
    try {
      const res = await fetch('/api/stickers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setGifs([...data, ...FALLBACK_GIFS]);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // If query matches fallback filter
    if (searchQuery.trim() && searchQuery !== "trending") {
      const filtered = FALLBACK_GIFS.filter(g =>
        g.artist_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setGifs(filtered.length > 0 ? filtered : FALLBACK_GIFS);
    } else {
      setGifs(FALLBACK_GIFS);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGifs("trending");
  }, [fetchGifs]);

  // Debounce user search
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      fetchGifs(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, fetchGifs]);

  const handleCategoryClick = (cat: { label: string; query: string }) => {
    setActiveCategory(cat.query);
    setQuery("");
    fetchGifs(cat.query);
  };

  const handleAddCustomSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !user) return;
    setAddingCustom(true);
    try {
      const res = await fetch('/api/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: customUrl.trim(),
          artistName: customArtist.trim() || 'Custom Sticker',
          userId: user.id
        })
      });
      if (res.ok) {
        setView("browse");
        setCustomUrl("");
        setCustomArtist("");
        fetchGifs("trending");
      }
    } catch (err) {
      console.error("Failed to add sticker", err);
    } finally {
      setAddingCustom(false);
    }
  };

  return (
    <div className="w-[340px] sm:w-[380px] bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl flex flex-col p-3 gap-2.5 overflow-hidden text-card-foreground select-none">
      {view === "browse" ? (
        <>
          {/* Header & Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search GIFs & stickers..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-9 text-xs rounded-xl bg-background/60 border-border/50 focus-visible:ring-1"
                autoFocus
              />
            </div>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("add")}
                className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary shrink-0"
                title="Add custom sticker"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Quick Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.query}
                onClick={() => handleCategoryClick(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-colors ${
                  activeCategory === cat.query && !query
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* GIF Grid */}
          <ScrollArea className="h-64 rounded-xl pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs">Finding GIFs...</span>
              </div>
            ) : gifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-center p-4">
                <AlertCircle className="w-6 h-6 opacity-40" />
                <p className="text-xs">No GIFs found for "{query}"</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setQuery(""); fetchGifs("trending"); }}
                  className="text-xs mt-1"
                >
                  Show Trending
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onPick(g.url)}
                    className="group relative rounded-xl overflow-hidden aspect-video bg-muted/40 border border-white/5 hover:border-primary/50 hover:ring-2 hover:ring-primary/40 transition-all flex items-center justify-center"
                  >
                    <img
                      src={g.url}
                      alt={g.artist_name || "GIF"}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        // If image fails to load, gracefully hide the card
                        (e.target as HTMLElement).parentElement?.classList.add("hidden");
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                      <p className="text-[10px] text-white font-medium truncate w-full text-left">
                        {g.artist_name || "GIF"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      ) : (
        /* Inline Add Custom Sticker View */
        <form onSubmit={handleAddCustomSticker} className="flex flex-col gap-3 py-1">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setView("browse")}
              className="h-7 w-7 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h4 className="text-xs font-semibold">Add Custom GIF / Sticker</h4>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium block mb-1">GIF Image URL</label>
              <Input
                placeholder="https://example.com/sticker.gif"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="h-8 text-xs rounded-xl"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium block mb-1">Title / Caption (optional)</label>
              <Input
                placeholder="e.g. Happy Cat"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                className="h-8 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView("browse")}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!customUrl.trim() || addingCustom}
              className="text-xs h-8 rounded-xl font-medium"
            >
              {addingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Sticker
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
