import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface Gif {
  id: string;
  url: string;
  artist_name?: string;
}

interface GifPickerProps {
  onPick: (url: string) => void;
}

export function GifPicker({ onPick }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [allGifs, setAllGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stickers')
      .then(r => r.json())
      .then(data => {
        setAllGifs(data || []);
        setGifs(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setGifs(allGifs);
    } else {
      setGifs(allGifs.filter(g => g.artist_name?.toLowerCase().includes(query.toLowerCase())));
    }
  }, [query, allGifs]);

  return (
    <div className="w-80 p-2 space-y-2">
      <Input
        autoFocus
        placeholder="Search Custom Stickers/GIFs..."
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
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((g) => (
              <button
                key={g.id}
                onClick={() => onPick(g.url)}
                className="group relative rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all aspect-video bg-black/20 flex items-center justify-center"
              >
                <img src={g.url} alt="Sticker" className="w-full h-full object-cover" loading="lazy" />
                {g.artist_name && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-[10px] text-white/90 text-center truncate">By {g.artist_name}</p>
                  </div>
                )}
              </button>
            ))}
            {gifs.length === 0 && (
              <p className="col-span-2 text-center text-xs text-muted-foreground py-8">
                No stickers found
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
