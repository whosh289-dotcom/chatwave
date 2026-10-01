import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, LogOut, MessageCircle, Lock, Users, Pin, BellOff, Settings } from "lucide-react";
import { format } from "date-fns";
import ConversationInvites from "@/components/ConversationInvites";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { toast } from "sonner";

interface ConversationPreview {
  id: string;
  name: string | null;
  otherUsers: { display_name: string | null; user_id: string }[];
  lastMessage?: { content: string; created_at: string };
  is_private: boolean;
  memberCount: number;
  unread: number;
  pinned: boolean;
  muted: boolean;
  lastReadAt: string;
}

interface ChatSidebarProps {
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

const ChatSidebar = ({ selectedConversation, onSelectConversation, onNewConversation }: ChatSidebarProps) => {
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [search, setSearch] = useState("");

  const fetchConversations = async () => {
    if (!user) return;

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at, pinned, muted_until")
      .eq("user_id", user.id);

    if (!participations?.length) { setConversations([]); return; }

    const convIds = participations.map((p) => p.conversation_id);

    // Batch all four queries in parallel
    const [convsRes, allPartsRes, lastMsgsRes, unreadMsgsRes] = await Promise.all([
      supabase.from("conversations").select("id, is_private, name").in("id", convIds),
      supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds),
      supabase.from("messages").select("conversation_id, content, created_at, gif_url, sender_id").in("conversation_id", convIds).order("created_at", { ascending: false }),
      supabase.from("messages").select("id, conversation_id, created_at, sender_id").in("conversation_id", convIds).neq("sender_id", user.id),
    ]);

    const convs = convsRes.data || [];
    const allParts = allPartsRes.data || [];
    const allMsgs = lastMsgsRes.data || [];
    const unreadMsgs = unreadMsgsRes.data || [];

    // Collect all other user ids and fetch their profiles in one go
    const otherIds = Array.from(new Set(allParts.filter((p) => p.user_id !== user.id).map((p) => p.user_id)));
    const profilesRes = otherIds.length
      ? await supabase.from("profiles").select("display_name, user_id").in("user_id", otherIds)
      : { data: [] as { display_name: string | null; user_id: string }[] };
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));

    // Latest message per conversation (messages came back ordered desc)
    const lastMsgMap = new Map<string, typeof allMsgs[number]>();
    for (const m of allMsgs) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
    }

    const previews: ConversationPreview[] = participations.map((part) => {
      const convId = part.conversation_id;
      const convData = convs.find((c) => c.id === convId);
      const otherParts = allParts.filter((p) => p.conversation_id === convId && p.user_id !== user.id);
      const otherUsers = otherParts.map((p) => profileMap.get(p.user_id) || { display_name: null, user_id: p.user_id });
      const lastMsg = lastMsgMap.get(convId);
      const unread = unreadMsgs.filter((m) => m.conversation_id === convId && (!part.last_read_at || m.created_at > part.last_read_at)).length;
      const memberCount = allParts.filter((p) => p.conversation_id === convId).length;

      return {
        id: convId,
        name: convData?.name || null,
        otherUsers,
        lastMessage: lastMsg ? {
          content: lastMsg.gif_url ? "📷 GIF" : (lastMsg.content || ""),
          created_at: lastMsg.created_at,
        } : undefined,
        is_private: convData?.is_private || false,
        memberCount,
        unread,
        pinned: part.pinned ?? false,
        muted: part.muted_until ? new Date(part.muted_until) > new Date() : false,
        lastReadAt: part.last_read_at,
      };
    }).filter((p) => p.otherUsers.length > 0 || p.memberCount > 1);

    previews.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return tb - ta;
    });
    setConversations(previews);
  };

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("sidebar-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => fetchConversations())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants" }, () => fetchConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    if (c.name?.toLowerCase().includes(q)) return true;
    return c.otherUsers.some((u) => u.display_name?.toLowerCase().includes(q));
  });

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getConvDisplayName = (conv: ConversationPreview) => {
    if (conv.name) return conv.name;
    return conv.otherUsers.map((u) => u.display_name || "Unknown").join(", ");
  };

  const togglePin = async (conv: ConversationPreview) => {
    if (!user) return;
    await supabase
      .from("conversation_participants")
      .update({ pinned: !conv.pinned })
      .eq("conversation_id", conv.id)
      .eq("user_id", user.id);
    fetchConversations();
  };

  const toggleMute = async (conv: ConversationPreview) => {
    if (!user) return;
    const muted_until = conv.muted ? null : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    await supabase
      .from("conversation_participants")
      .update({ muted_until })
      .eq("conversation_id", conv.id)
      .eq("user_id", user.id);
    fetchConversations();
  };

  const blockUser = async (otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId });
    if (error) toast.error(error.message);
    else toast.success("User blocked");
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-5 border-b border-border/40">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary stroke-[2.5]" />
            </div>
            <h1 className="text-[19px] font-bold font-heading tracking-tight">ChatApp</h1>
          </div>
          <div className="flex gap-1.5 items-center">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={onNewConversation} className="h-9 w-9 rounded-full bg-secondary hover:bg-secondary/80">
              <Plus className="w-4 h-4 text-secondary-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search messages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-primary rounded-xl" />
        </div>
      </div>

      <ConversationInvites onAccepted={(id) => { onSelectConversation(id); fetchConversations(); }} />

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat to get going!</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ContextMenu key={conv.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${selectedConversation === conv.id ? "bg-secondary" : ""}`}
                >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {conv.memberCount > 2 ? <Users className="w-4 h-4" /> : getInitials(conv.otherUsers[0]?.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-medium text-sm truncate">{getConvDisplayName(conv)}</p>
                    {conv.is_private && <Lock className="w-3 h-3 text-primary shrink-0" />}
                    {conv.pinned && <Pin className="w-3 h-3 text-muted-foreground shrink-0" />}
                    {conv.muted && <BellOff className="w-3 h-3 text-muted-foreground shrink-0" />}
                  </div>
                  {conv.lastMessage && (
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-1">
                      {format(new Date(conv.lastMessage.created_at), "HH:mm")}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-xs truncate ${conv.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {conv.lastMessage?.content || "No messages yet"}
                  </p>
                  {conv.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center shrink-0">
                      {conv.unread > 99 ? "99+" : conv.unread}
                    </span>
                  )}
                </div>
              </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={() => togglePin(conv)}>
                  <Pin className="w-3.5 h-3.5 mr-2" />{conv.pinned ? "Unpin" : "Pin"}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => toggleMute(conv)}>
                  <BellOff className="w-3.5 h-3.5 mr-2" />{conv.muted ? "Unmute" : "Mute"}
                </ContextMenuItem>
                {conv.memberCount === 2 && conv.otherUsers[0]?.user_id && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive" onClick={() => blockUser(conv.otherUsers[0].user_id)}>
                      Block {conv.otherUsers[0].display_name || "user"}
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
