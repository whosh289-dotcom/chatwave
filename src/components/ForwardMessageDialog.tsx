import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Forward } from "lucide-react";
import { toast } from "sonner";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  gifUrl: string | null;
  excludeConversationId: string;
}

interface ConvOption {
  id: string;
  label: string;
  isGroup: boolean;
}

export function ForwardMessageDialog({ open, onOpenChange, messageContent, gifUrl, excludeConversationId }: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvOption[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      try {
        const res = await fetch(`/api/conversations?userId=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const opts: ConvOption[] = [];
        for (const c of data.conversations) {
          if (c.id === excludeConversationId) continue;
          let label = c.name || "";
          if (!label && c.otherUsers?.length) {
            label = c.otherUsers.map((u: any) => u.display_name).join(", ");
          }
          opts.push({ 
            id: c.id, 
            label: label || "Untitled", 
            isGroup: (c.otherUsers?.length ?? 0) > 1 || c.memberCount > 2 
          });
        }
        setConvs(opts);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open, user, excludeConversationId]);

  const forward = async (toConvId: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: toConvId,
          senderId: user.id,
          content: messageContent,
          gifUrl: gifUrl
        })
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to forward");
      } else {
        toast.success("Forwarded");
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2"><Forward className="w-4 h-4" /> Forward to…</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="space-y-1">
            {convs.length === 0 && <p className="text-sm text-muted-foreground p-3 text-center">No other conversations</p>}
            {convs.map((c) => (
              <Button key={c.id} variant="ghost" className="w-full justify-start gap-2 h-11" onClick={() => forward(c.id)}>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {c.isGroup ? <Users className="w-3.5 h-3.5" /> : c.label.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{c.label}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}