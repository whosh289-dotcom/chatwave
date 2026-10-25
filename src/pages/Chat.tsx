import { useState, useEffect } from "react";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { 
  MessageSquare, Hash, AtSign, Users, Bookmark, SlidersHorizontal, 
  ChevronDown, Plus, MoreHorizontal, Radio, Phone, Bell, LayoutGrid, 
  Eye, Download, Pin, ArrowRight, ChevronRight, Check, Sparkles, Send, 
  Bold, Code2, Smile, Lock, ShieldCheck, Globe, X, Minimize2, Maximize2, 
  ExternalLink, Settings, Volume2, Mic, MicOff, Video, VideoOff, Search,
  FileText, FolderGit2, Palette, FileCode, CheckCheck, RefreshCw, ThumbsUp, Heart, Rocket
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const Chat = () => {
  const { user } = useAuth();
  
  // Real conversations from D1
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [poppedOutConversation, setPoppedOutConversation] = useState<string | null>(null);

  // Navigation tab state
  const [activeNavTab, setActiveNavTab] = useState<"workspace" | "channels" | "direct" | "colleagues" | "artifacts">("workspace");
  const [search, setSearch] = useState("");

  // Voice Huddle State
  const [inVoiceHuddle, setInVoiceHuddle] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Right Inspector Drawer Toggle
  const [showRightInspector, setShowRightInspector] = useState(true);
  
  // Dialogs
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch real conversations from D1
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

      // Auto-select first conversation if none selected
      if (!selectedConversation && convs.length > 0) {
        setSelectedConversation(convs[0].id);
      }
    } catch (e) {
      console.error("Error fetching conversations:", e);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Keyboard shortcut listener (⌘K, ⌘N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowNewDialog(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getConvDisplayName = (conv: ConversationPreview) => {
    if (conv.name) return conv.name;
    const names = conv.otherUsers.map((u) => u.display_name || "User").join(", ");
    return names || "Direct Message";
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      "from-indigo-500 to-purple-600",
      "from-cyan-500 to-blue-600",
      "from-emerald-500 to-teal-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Filter channels vs direct messages
  const channels = conversations.filter(c => !c.is_private || c.name || c.memberCount > 2);
  const directMessages = conversations.filter(c => c.is_private && !c.name && c.memberCount <= 2);

  const selectedConvObj = conversations.find(c => c.id === selectedConversation);
  const selectedTitle = selectedConvObj ? getConvDisplayName(selectedConvObj) : "general";

  return (
    <div className="flex h-screen w-full bg-[#080911] text-white overflow-hidden select-none font-sans">
      
      {/* ======================================================== */}
      {/* COLUMN 1: LEFT NAVIGATION RAIL (Width ~220px)            */}
      {/* ======================================================== */}
      <div className="w-[220px] shrink-0 border-r border-[#1a1d2e] bg-[#07080e] flex flex-col justify-between p-3.5 z-20">
        <div className="flex flex-col gap-4">
          
          {/* Traffic Lights & ChatWave Logo */}
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[#6c5ce7] flex items-center justify-center">
                <MessageSquare className="w-3 h-3 text-white fill-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white font-heading">
                ChatWave
              </span>
            </div>
          </div>

          {/* Quick Switch Input */}
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              readOnly
              onClick={() => setShowNewDialog(true)}
              placeholder="Quick switch (⌘K)"
              className="w-full bg-[#121422] border border-[#1e2235] hover:border-[#2a2f4a] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-white/40 cursor-pointer transition-colors"
            />
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-1 mt-1">
            <button
              onClick={() => setActiveNavTab("workspace")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "workspace"
                  ? "bg-[#5b5bf7] text-white shadow-[0_4px_20px_rgba(91,91,247,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Workspace Stream</span>
            </button>

            <button
              onClick={() => {
                setActiveNavTab("channels");
                if (channels.length > 0) setSelectedConversation(channels[0].id);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "channels"
                  ? "bg-[#5b5bf7] text-white shadow-[0_4px_20px_rgba(91,91,247,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Hash className="w-4 h-4" />
              <span>Channels & Topics</span>
            </button>

            <button
              onClick={() => {
                setActiveNavTab("direct");
                if (directMessages.length > 0) setSelectedConversation(directMessages[0].id);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "direct"
                  ? "bg-[#5b5bf7] text-white shadow-[0_4px_20px_rgba(91,91,247,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <AtSign className="w-4 h-4" />
              <span>Direct Threads</span>
            </button>

            <button
              onClick={() => setActiveNavTab("colleagues")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "colleagues"
                  ? "bg-[#5b5bf7] text-white shadow-[0_4px_20px_rgba(91,91,247,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Colleagues</span>
            </button>

            <button
              onClick={() => setActiveNavTab("artifacts")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "artifacts"
                  ? "bg-[#5b5bf7] text-white shadow-[0_4px_20px_rgba(91,91,247,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Pinned Artifacts</span>
            </button>
          </div>
        </div>

        {/* Bottom Real User Card */}
        <div className="bg-[#121422] border border-[#1e2235] p-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="w-8 h-8 rounded-full border border-purple-500/40">
                <AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-xs font-bold">
                  {(user?.username || "U")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#121422]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate leading-tight">
                {user?.username || (user as any)?.displayName || "User"}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-medium">
                ONLINE • 14ms
              </span>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="text-white/40 hover:text-white p-1 rounded transition-colors"
            title="Account Preferences"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUMN 2: WORKSPACE & CHANNELS/DMs (Width ~230px)        */}
      {/* ======================================================== */}
      <div className="w-[230px] shrink-0 border-r border-[#1a1d2e] bg-[#0a0b14] flex flex-col justify-between p-3.5 z-10">
        <div className="flex flex-col gap-4 overflow-y-auto">
          
          {/* Workspace Switcher Card */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white">
                {(user?.username || "A")[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Workspace</span>
                  <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 font-semibold">
                    ENTERPRISE PRO
                  </span>
                </div>
                <span className="text-[9px] font-mono text-white/40">WORKSPACE SYNC v4.18.2</span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          </div>

          {/* CHANNELS SECTION */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold">
              <span>Channels</span>
              <button 
                onClick={() => setShowNewDialog(true)}
                className="hover:text-white p-0.5 rounded transition-colors"
                title="Create Channel"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {channels.length === 0 ? (
              <button
                onClick={() => setShowNewDialog(true)}
                className="w-full text-left px-2.5 py-2 text-[11px] text-white/40 hover:text-white/70 italic rounded-lg transition-colors"
              >
                + Create first channel
              </button>
            ) : (
              channels.map((conv) => {
                const isSelected = selectedConversation === conv.id;
                const name = conv.name || "channel";
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[#25203d] border border-[#4a3b75] text-white"
                        : "text-white/60 hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Hash className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        Active
                      </span>
                    )}
                    {!isSelected && conv.unread > 0 && (
                      <span className="text-[10px] font-mono text-white/80 bg-indigo-500/30 px-1.5 py-0.2 rounded shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* DIRECT MESSAGES SECTION */}
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold">
              <span>Direct Messages</span>
              <button 
                onClick={() => setShowNewDialog(true)}
                className="hover:text-white p-0.5 rounded transition-colors"
                title="New Direct Message"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>

            {directMessages.length === 0 ? (
              <button
                onClick={() => setShowNewDialog(true)}
                className="w-full text-left px-2.5 py-2 text-[11px] text-white/40 hover:text-white/70 italic rounded-lg transition-colors"
              >
                + Start direct thread
              </button>
            ) : (
              directMessages.map((conv) => {
                const isSelected = selectedConversation === conv.id;
                const other = conv.otherUsers[0];
                const displayName = other?.display_name || "User";
                const grad = getAvatarGradient(displayName);
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                      isSelected
                        ? "bg-[#25203d] border border-[#4a3b75] text-white"
                        : "hover:bg-white/[0.03] text-white/70"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="w-6 h-6 rounded-full border border-white/10">
                        <AvatarFallback className={`bg-gradient-to-tr ${grad} text-white text-[10px] font-bold`}>
                          {displayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium text-white truncate">{displayName}</span>
                      <span className="text-[10px] text-white/40 truncate">
                        {conv.lastMessage ? conv.lastMessage.content : "Active Member"}
                      </span>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom System Throughput Card */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-wider font-semibold">System Throughput</span>
            <span className="text-emerald-400 font-bold">99.98%</span>
          </div>
          <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 w-[99.98%] rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUMN 3: MAIN STAGE / REAL CONVERSATION STREAM (Flex 1) */}
      {/* ======================================================== */}
      <div className="flex-1 bg-[#090a14] flex flex-col overflow-hidden relative">
        
        {/* Top Global Header Bar */}
        <div className="h-12 shrink-0 px-5 flex items-center justify-between border-b border-[#1a1d2e] bg-[#090a14]/90 backdrop-blur-md z-10">
          {/* Left Title */}
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-white font-heading tracking-tight">
              {selectedTitle}
            </span>
            <span className="text-[10px] font-mono text-white/50 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
              #core-runtime
            </span>
          </div>

          {/* Right Global Actions */}
          <div className="flex items-center gap-2.5">
            {/* E2EE Active Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10.5px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>E2EE ACTIVE</span>
            </div>

            {/* Join Voice Huddle Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setInVoiceHuddle(!inVoiceHuddle);
                if (!inVoiceHuddle) toast.success(`Joined Voice Huddle in ${selectedTitle}`);
                else toast.info("Left Voice Huddle");
              }}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                inVoiceHuddle
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/[0.1]"
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{inVoiceHuddle ? "Leave Huddle" : "Join Voice Huddle"}</span>
            </motion.button>

            {/* Notification Bell */}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            {/* Grid Apps / Toggle Right Drawer */}
            <button 
              onClick={() => setShowRightInspector(!showRightInspector)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              title="Toggle Overview Drawer"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* User Profile Ring */}
            <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-xs font-bold text-purple-200">
              {(user?.username || "U")[0]?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Live Voice Huddle Overlay Banner */}
        <AnimatePresence>
          {inVoiceHuddle && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-gradient-to-r from-emerald-950/40 via-indigo-950/40 to-black/60 border-b border-emerald-500/30 px-5 py-3 flex items-center justify-between overflow-hidden shrink-0 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    Live Huddle in {selectedTitle}
                    <span className="text-[10px] font-mono text-emerald-400">● Streaming 48kHz</span>
                  </span>
                  <span className="text-[10px] text-white/50">
                    Active participants in room
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isMicMuted
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : "bg-white/[0.05] text-white border-white/10 hover:bg-white/10"
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMicMuted ? "Muted" : "Mute"}</span>
                </button>
                <button
                  onClick={() => setInVoiceHuddle(false)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real Message Stream (using ChatView) */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {selectedConversation ? (
            <ChatView
              key={selectedConversation}
              conversationId={selectedConversation}
              onPopOut={() => setPoppedOutConversation(selectedConversation)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/50">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-indigo-400/60" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Select or start a conversation</h3>
              <p className="text-xs text-white/40 max-w-xs mb-4">
                Choose a channel or direct message from the left to start messaging in real time.
              </p>
              <button
                onClick={() => setShowNewDialog(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition-all"
              >
                + New Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUMN 4: RIGHT CONTEXTUAL INSPECTOR DRAWER (~280px)     */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showRightInspector && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="w-[280px] shrink-0 border-l border-[#1a1d2e] bg-[#0c0d18] flex flex-col p-4 overflow-y-auto space-y-5 z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold">
              <span>Channel Overview</span>
              <button 
                onClick={() => setShowSettings(true)}
                className="hover:text-white transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description & Telemetry Card */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white tracking-tight">
                {selectedTitle}
              </h3>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Single source of truth for design tokens, real-time message stream, and encrypted peer channels.
              </p>

              {/* 2-Column Telemetry Box */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-[#121422] border border-[#1e2235] flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-white/40 uppercase">Security</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    TLS 1.3 AES
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#121422] border border-[#1e2235] flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-white/40 uppercase">Latency</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">
                    14ms edge
                  </span>
                </div>
              </div>
            </div>

            {/* Pinned Milestone Card */}
            <div className="p-3 rounded-xl bg-[#121422] border border-[#1e2235] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono text-white/50 uppercase tracking-wider flex items-center gap-1">
                  <Pin className="w-3 h-3 text-purple-400" />
                  Pinned Milestone
                </span>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-bold">
                  92%
                </span>
              </div>
              <div className="text-xs font-bold text-white">
                Q1 Design Token Spec
              </div>
              <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 w-[92%] rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
              <div className="text-[10px] text-white/40 font-mono">
                Target handoff: Friday, March 1st
              </div>
            </div>

            {/* Active Members / Online Contributors Section */}
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold block">
                Active Participants ({selectedConvObj ? selectedConvObj.memberCount : 1})
              </span>
              <div className="flex items-center -space-x-2">
                {selectedConvObj?.otherUsers.map((u, i) => (
                  <Avatar key={u.user_id || i} className="w-7 h-7 ring-2 ring-[#0c0d18]" title={u.display_name || "Member"}>
                    <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-600 text-white text-[10px] font-bold">
                      {(u.display_name || "M")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                <Avatar className="w-7 h-7 ring-2 ring-[#0c0d18]" title={user?.username || "You"}>
                  <AvatarFallback className="bg-gradient-to-tr from-emerald-500 to-teal-600 text-white text-[10px] font-bold">
                    {(user?.username || "U")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="w-7 h-7 rounded-full bg-[#1e2235] text-white/70 text-[10px] font-mono font-bold flex items-center justify-center ring-2 ring-[#0c0d18]">
                  +21
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* FLOATING 3D POP-OUT WINDOW (DETACHED CHAT)                */}
      {/* ======================================================== */}
      <AnimatePresence>
        {poppedOutConversation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: "560px"
            }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 w-[94vw] sm:w-[440px] rounded-2xl border border-white/20 bg-[#080a14]/96 backdrop-blur-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(99,102,241,0.3)] overflow-hidden flex flex-col"
          >
            {/* Pop-Out Titlebar */}
            <div className="h-10 shrink-0 px-3.5 flex items-center justify-between border-b border-white/[0.1] bg-black/60 cursor-move">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPoppedOutConversation(null)}
                  className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all"
                  title="Close Floating Window"
                >
                  <X className="w-2 h-2 text-black/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-heading font-semibold text-white/90">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span>Detached Stage</span>
              </div>

              <button
                onClick={() => {
                  setSelectedConversation(poppedOutConversation);
                  setPoppedOutConversation(null);
                }}
                className="text-[10.5px] font-mono text-indigo-300 hover:text-white px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer"
              >
                Dock
              </button>
            </div>

            {/* Pop-Out Stage Body */}
            <div className="flex-1 overflow-hidden relative">
              <ChatView
                conversationId={poppedOutConversation}
                isPoppedOut={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* DIALOGS & OVERLAYS                                       */}
      {/* ======================================================== */}
      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          setSelectedConversation(id);
          setShowNewDialog(false);
          fetchConversations();
        }}
      />

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
};

export default Chat;
