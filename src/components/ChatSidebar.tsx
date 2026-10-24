import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, LogOut, MessageCircle, Lock, Users, Pin, BellOff, Settings, Sparkles, User, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import ConversationInvites from "@/components/ConversationInvites";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ConversationPreview {
  id: string;
  name: string | null;
  logo_url: string | null;
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
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "direct" | "groups">("all");

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
    // Tab filter
    if (filterTab === "unread" && c.unread <= 0) return false;
    if (filterTab === "direct" && c.memberCount > 2) return false;
    if (filterTab === "groups" && c.memberCount <= 2) return false;

    if (!search) return true; // Always show if no search
    const q = search.toLowerCase();
    if (c.name && c.name.toLowerCase().includes(q)) return true;
    return c.otherUsers.some((u) => u.display_name && u.display_name.toLowerCase().includes(q));
  });

  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unread || 0), 0);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getAvatarGradient = (name: string | null) => {
    const gradients = [
      "from-indigo-500/25 to-purple-500/20 text-indigo-300 border-indigo-500/20",
      "from-cyan-500/25 to-blue-500/20 text-cyan-300 border-cyan-500/20",
      "from-emerald-500/25 to-teal-500/20 text-emerald-300 border-emerald-500/20",
      "from-rose-500/25 to-pink-500/20 text-rose-300 border-rose-500/20",
      "from-amber-500/25 to-orange-500/20 text-amber-300 border-amber-500/20",
    ];
    if (!name) return gradients[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  const getConvDisplayName = (conv: ConversationPreview) => {
    if (conv.name) return conv.name;
    return conv.otherUsers.map((u) => u.display_name || "Unknown").join(", ");
  };

  const togglePin = async (conv: ConversationPreview) => {
    toast.info("Pinning will be enabled in the next update!");
  };

  const toggleMute = async (conv: ConversationPreview) => {
    toast.info("Muting will be enabled in the next update!");
  };

  const blockUser = async (otherUserId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerId: user.id, blockedId: otherUserId })
      });
      if (!res.ok) throw new Error("Failed to block");
      toast.success("User reported and blocked successfully!");
      window.dispatchEvent(new CustomEvent("user-blocked", { detail: { userId: otherUserId } }));
    } catch (e) {
      toast.error("Failed to block user");
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Top Header & Account Switcher */}
      <div className="p-3.5 border-b border-white/[0.08]">
        <div className="flex items-center justify-between mb-3.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl border border-white/[0.08] hover:border-white/[0.15] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.2)] transition-all backdrop-blur-md">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/25 border border-white/15 flex items-center justify-center p-0.5 shadow-sm">
                  <Avatar className="w-full h-full rounded-[6px]">
                    <AvatarFallback className="bg-transparent text-indigo-200 font-semibold font-heading text-xs">
                      {(user?.username || (user as any)?.displayName || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[13px] font-semibold font-heading text-white tracking-tight leading-tight flex items-center gap-1.5">
                    {user?.username || (user as any)?.displayName || "Account"}
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                  </span>
                  <span className="text-[10px] text-white/45 font-medium tracking-wide">
                    Switch profile
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-1.5 rounded-xl border border-white/10 bg-[#0c0d15]/95 backdrop-blur-2xl shadow-2xl">
              <DropdownMenuLabel className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mb-1 px-2 py-1">
                Active Profiles
              </DropdownMenuLabel>
              {accounts.map(acc => (
                <DropdownMenuItem 
                  key={acc.id} 
                  onClick={() => switchAccount(acc.id)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg mb-0.5 text-white/80 hover:text-white transition-all ${acc.id === user?.id ? "bg-indigo-500/15 border border-indigo-500/30 text-white font-medium" : "hover:bg-white/[0.06]"}`}
                >
                  <Avatar className="w-6 h-6 rounded-md border border-white/10">
                    <AvatarFallback className="bg-indigo-500/20 text-[11px] text-indigo-300 font-semibold">
                      {(acc?.username || (acc as any)?.displayName || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`text-xs truncate ${acc.id === user?.id ? "text-indigo-200 font-semibold" : ""}`}>
                    {acc?.username || (acc as any)?.displayName || "Account"}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />
              <DropdownMenuItem 
                onClick={() => window.location.href = "/auth?add=true"}
                className="flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-500/15 font-medium text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={signOut}
                className="flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 font-medium text-xs"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex gap-1.5 items-center">
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] transition-all" title="Settings">
              <Settings className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNewConversation} className="h-8 w-8 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)] transition-all" title="New conversation">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <Input 
            placeholder="Search conversations..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-8 h-8 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] focus-visible:border-indigo-400/60 focus-visible:ring-1 focus-visible:ring-indigo-400/40 rounded-xl text-xs text-white placeholder:text-white/40 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          />
        </div>

        {/* Figma Smart Animate Filter Tabs */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar py-0.5 relative">
          {(
            [
              { id: "all", label: "All" },
              { id: "unread", label: "Unread", count: totalUnreadCount },
              { id: "direct", label: "Direct" },
              { id: "groups", label: "Groups" },
            ] as const
          ).map((tab) => {
            const isActive = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`relative px-3 py-1 rounded-full text-[11px] font-medium font-heading transition-colors shrink-0 flex items-center gap-1.5 z-10 ${
                  isActive ? "text-white font-semibold" : "text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="figma-active-tab-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 bg-indigo-500/25 border border-indigo-500/40 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.25)] -z-10"
                  />
                )}
                {!isActive && (
                  <div className="absolute inset-0 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-full -z-10" />
                )}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm"
                  >
                    {tab.count}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ConversationInvites onAccepted={(id) => { onSelectConversation(id); fetchConversations(); }} />

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-indigo-400/50" />
            </div>
            <p className="text-xs font-heading font-medium text-white/70">No conversations</p>
            <p className="text-[11px] text-white/40 mt-1">Start a fresh conversation above!</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = selectedConversation === conv.id;
            const displayName = getConvDisplayName(conv);
            const avatarGrad = getAvatarGradient(displayName);
            return (
              <ContextMenu key={conv.id}>
                <ContextMenuTrigger asChild>
                  <motion.button
                    whileHover={{ x: 2, scale: 1.008 }}
                    whileTap={{ scale: 0.992 }}
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left border ${
                      isSelected
                        ? "bg-indigo-500/20 border-indigo-400/40 shadow-[0_4px_20px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] text-white backdrop-blur-md"
                        : "bg-white/[0.025] hover:bg-white/[0.065] border-white/[0.05] hover:border-white/[0.12] text-white/80 hover:text-white backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className={`h-9 w-9 rounded-lg border p-0.5 bg-gradient-to-tr ${avatarGrad}`}>
                        {conv.logo_url ? (
                          <AvatarImage src={conv.logo_url} alt={displayName} className="object-cover rounded-[6px]" />
                        ) : null}
                        <AvatarFallback className="bg-transparent text-xs font-semibold font-heading">
                          {conv.memberCount > 2 ? <Users className="w-4 h-4" /> : getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] border-2 border-[#090a10]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`font-heading text-[12.5px] font-semibold truncate ${isSelected ? "text-white" : "text-white/90"}`}>
                            {displayName}
                          </p>
                          {conv.is_private && <Lock className="w-3 h-3 text-white/40 shrink-0" />}
                          {conv.pinned && <Pin className="w-3 h-3 text-indigo-400 shrink-0" />}
                          {conv.muted && <BellOff className="w-3 h-3 text-white/30 shrink-0" />}
                        </div>
                        {conv.lastMessage && (
                          <span className="text-[10px] font-mono text-white/40 shrink-0 ml-1">
                            {format(new Date(conv.lastMessage.created_at), "HH:mm")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-[11.5px] truncate ${conv.unread > 0 ? "text-white font-medium" : "text-white/45"}`}>
                          {conv.lastMessage?.content || "No messages yet"}
                        </p>
                        {conv.unread > 0 && (
                          <span className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[10px] font-mono font-bold rounded-full h-4 min-w-4 px-1.5 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                            {conv.unread > 99 ? "99+" : conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48 bg-[#0c0d14]/90 backdrop-blur-2xl border border-white/10 rounded-xl p-1 shadow-2xl">
                  <ContextMenuItem onClick={() => togglePin(conv)} className="text-xs text-white/80 hover:text-white rounded-lg">
                    <Pin className="w-3.5 h-3.5 mr-2 text-indigo-400" />{conv.pinned ? "Unpin" : "Pin"}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => toggleMute(conv)} className="text-xs text-white/80 hover:text-white rounded-lg">
                    <BellOff className="w-3.5 h-3.5 mr-2 text-white/50" />{conv.muted ? "Unmute" : "Mute"}
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-white/[0.08]" />
                  <ContextMenuItem className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg" onClick={async () => {
                    try {
                      await fetch('/api/conversations/leave', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ conversationId: conv.id, userId: user?.id }) });
                      fetchConversations();
                    } catch (e) {}
                  }}>
                    <LogOut className="w-3.5 h-3.5 mr-2" />Leave Chat
                  </ContextMenuItem>
                  {conv.memberCount === 2 && conv.otherUsers[0]?.user_id && (
                    <>
                      <ContextMenuSeparator className="bg-white/[0.08]" />
                      <ContextMenuItem className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg" onClick={() => blockUser(conv.otherUsers[0].user_id)}>
                        Report & Block {conv.otherUsers[0].display_name || "user"}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            );
          })
        )}
      </div>
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

export default ChatSidebar;
