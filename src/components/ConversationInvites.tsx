import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, Shield } from "lucide-react";
import { toast } from "sonner";

interface Invite {
  id: string;
  conversation_id: string;
  inviter_id: string;
  status: string;
  created_at: string;
  inviterName?: string;
}

interface ConversationInvitesProps {
  onAccepted: (conversationId: string) => void;
}

const ConversationInvites = ({ onAccepted }: ConversationInvitesProps) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);

  const fetchInvites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversation_invites")
      .select("*")
      .eq("invitee_id", user.id)
      .eq("status", "pending");

    if (!data?.length) { setInvites([]); return; }

    const enriched: Invite[] = [];
    for (const inv of data) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", inv.inviter_id)
        .single();
      enriched.push({ ...inv, inviterName: profile?.display_name || "Unknown" });
    }
    setInvites(enriched);
  };

  useEffect(() => {
    fetchInvites();
    const channel = supabase
      .channel("invites-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_invites" }, () => fetchInvites())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleRespond = async (invite: Invite, accept: boolean) => {
    const { error } = await supabase
      .from("conversation_invites")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", invite.id);

    if (error) { toast.error("Failed to respond"); return; }

    if (accept) {
      // Add as participant
      const { error: partErr } = await supabase
        .from("conversation_participants")
        .insert({ conversation_id: invite.conversation_id, user_id: user!.id });

      if (partErr) { toast.error("Failed to join conversation"); return; }

      toast.success("Joined conversation!");
      onAccepted(invite.conversation_id);
    } else {
      toast.success("Invite declined");
    }
    fetchInvites();
  };

  if (invites.length === 0) return null;

  return (
    <div className="border-b border-border">
      <div className="px-4 py-2 flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Shield className="w-3 h-3" />
        Pending Invites
      </div>
      {invites.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-accent/20 text-accent text-sm font-medium">
              {inv.inviterName?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{inv.inviterName}</p>
            <p className="text-xs text-muted-foreground">Invited you to chat</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-accent" onClick={() => handleRespond(inv, true)}>
              <Check className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRespond(inv, false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationInvites;
