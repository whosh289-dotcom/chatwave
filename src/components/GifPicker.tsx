import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
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

export function GifPicker({ onPick }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [allGifs, setAllGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customArtist, setCustomArtist] = useState("");

  const loadStickers = () => {
    const endpoint = user ? `/api/stickers?userId=${user.id}` : '/api/stickers';
    fetch(endpoint)
      .then(r => r.json())
      .then(data => {
        setAllGifs(data || []);
        setGifs(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadStickers();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setGifs(allGifs);
    } else {
      setGifs(allGifs.filter(g => g.artist_name?.toLowerCase().includes(query.toLowerCase())));
    }
  }, [query, allGifs]);

  const handleAddSticker = async () => {
    if (!customUrl || !user) return;
    try {
      await fetch('/api/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: customUrl,
          artistName: customArtist || 'Custom Sticker',
          userId: user.id,
        }),
      });
      setShowAddDialog(false);
      setCustomUrl('');
      setCustomArtist('');
      loadStickers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-80 p-2 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Input
          autoFocus
          placeholder="Search Custom Stickers/GIFs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 flex-1"
        />
        {user && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            aria-label="Add custom sticker"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

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

      {/* Add Sticker Dialog */}
      {user && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Custom Sticker</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input
                placeholder="Sticker GIF URL"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full"
              />
              <Input
                placeholder="Artist / Credit (optional)"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                className="w-full"
              />
            </div>
            <DialogFooter className="flex justify-end space-x-2 mt-4">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddSticker}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
