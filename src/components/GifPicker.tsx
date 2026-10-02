import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

// Public GIPHY beta key — free for development. Replace with your own production key when needed.
const GIPHY_KEY = "dc6zaTOxFJmzC";

interface Gif {
  id: string;
  url: string;
  preview: string;
}

interface GifPickerProps {
  onPick: (url: string) => void;
}

export function GifPicker({ onPick }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const endpoint = query.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
        const res = await fetch(endpoint);
        const json = await res.json();

        const fallback = [
          { id: "1", url: "https://media.giphy.com/media/l41YkxvU8c7J7Bba0/giphy.gif", preview: "https://media.giphy.com/media/l41YkxvU8c7J7Bba0/200w.gif" },
          { id: "2", url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif", preview: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/200w.gif" },
          { id: "3", url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", preview: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif" },
          { id: "5", url: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif", preview: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/200w.gif" },
        ];

        if (json.meta?.status === 403 || json.meta?.status === 401) {
          setGifs(fallback);
        } else {
          setGifs(
            (json.data || []).map((g: any) => ({
              id: g.id,
              url: g.images.original.url,
              preview: g.images.fixed_width_small.url,
            }))
          );
        }
      } catch {
        setGifs(fallback);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="w-80 p-2 space-y-2">
      <Input
        autoFocus
        placeholder="Search GIFs..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9"
      />
      <ScrollArea className="h-72">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {gifs.map((g) => (
              <button
                key={g.id}
                onClick={() => onPick(g.url)}
                className="rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all"
              >
                <img src={g.preview} alt="GIF" className="w-full h-auto" loading="lazy" />
              </button>
            ))}
            {gifs.length === 0 && (
              <p className="col-span-3 text-center text-xs text-muted-foreground py-8">
                No GIFs found
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}