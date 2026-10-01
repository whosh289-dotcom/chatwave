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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
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
  const { user, accounts, switchAccount, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [search, setSearch] = useState("");

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/conversations?userId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const { conversations: convs } = await res.json();
      
      convs.sort((a: any, b: any) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return tb - ta;
      });
      setConversations(convs);
    } catch (e) {
      console.error(e);
      setConversations([]);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2.5 px-2 hover:bg-muted/50 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Avatar className="w-9 h-9 rounded-xl">
                    <AvatarFallback className="bg-transparent text-primary font-bold">
                      {user?.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-bold font-heading tracking-tight leading-tight">
                    {user?.username || "Account"}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Switch Account
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2 rounded-xl border border-border shadow-2xl">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
                Your Accounts
              </DropdownMenuLabel>
              {accounts.map(acc => (
                <DropdownMenuItem 
                  key={acc.id} 
                  onClick={() => switchAccount(acc.id)}
                  className={`flex items-center gap-2 p-2 cursor-pointer rounded-lg mb-1 ${acc.id === user?.id ? "bg-primary/10" : ""}`}
                >
                  <Avatar className="w-6 h-6 rounded-md">
                    <AvatarFallback className="bg-primary/20 text-xs text-primary font-bold">
                      {acc?.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`font-medium text-sm ${acc.id === user?.id ? "text-primary" : ""}`}>
                    {acc?.username || "Account"}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem 
                onClick={() => window.location.href = "/auth?add=true"}
                className="flex items-center gap-2 p-2 cursor-pointer rounded-lg text-primary font-medium"
              >
                <Plus className="w-4 h-4" /> Add Account
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={signOut}
                className="flex items-center gap-2 p-2 cursor-pointer rounded-lg text-destructive focus:text-destructive font-medium"
              >
                <LogOut className="w-4 h-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex gap-1.5 items-center">
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="h-9 w-9 rounded-full hover:bg-secondary/80">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNewConversation} className="h-9 w-9 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground">
              <Plus className="w-4 h-4" />
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
    <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

export default ChatSidebar;
