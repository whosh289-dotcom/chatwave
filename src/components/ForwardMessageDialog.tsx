import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (!parts) return;
      const opts: ConvOption[] = [];
      for (const p of parts) {
        if (p.conversation_id === excludeConversationId) continue;
        const { data: conv } = await supabase.from("conversations").select("name").eq("id", p.conversation_id).single();
        const { data: others } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", p.conversation_id)
          .neq("user_id", user.id);
        let label = conv?.name || "";
        if (!label && others?.length) {
          const names: string[] = [];
          for (const o of others) {
            const { data: pr } = await supabase.from("profiles").select("display_name").eq("user_id", o.user_id).single();
            names.push(pr?.display_name || "Unknown");
          }
          label = names.join(", ");
        }
        opts.push({ id: p.conversation_id, label: label || "Untitled", isGroup: (others?.length ?? 0) > 1 });
      }
      setConvs(opts);
    })();
  }, [open, user, excludeConversationId]);

  const forward = async (toConvId: string) => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: toConvId,
      sender_id: user.id,
      content: messageContent,
      gif_url: gifUrl,
      message_type: gifUrl ? "gif" : "text",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Forwarded");
      onOpenChange(false);
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