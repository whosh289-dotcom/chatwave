import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

const modules = import.meta.glob("/src/**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProjectCodeDialog = ({ open, onOpenChange }: Props) => {
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || code) return;
    let cancelled = false;
    (async () => {
      const paths = Object.keys(modules).sort();
      const parts = await Promise.all(
        paths.map(async (p) => {
          try {
            const src = await modules[p]();
            return `// ===== ${p} =====\n${src}`;
          } catch {
            return `// ===== ${p} (unavailable) =====`;
          }
        })
      );
      if (!cancelled) setCode(parts.join("\n\n"));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-6">
            <span>Project source code</span>
            <Button size="sm" variant="outline" onClick={handleCopy} disabled={!code}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? "Copied" : "Copy all"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[65vh] rounded-md border bg-muted/40">
          <pre className="p-4 text-xs leading-relaxed whitespace-pre font-mono">
            <code>{code || "Loading source files..."}</code>
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectCodeDialog;
