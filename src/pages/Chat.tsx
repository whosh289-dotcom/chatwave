import { useState, useEffect, useRef } from "react";
import ChatSidebar from "@/components/ChatSidebar";
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

interface ReactionItem {
  emoji: string;
  count: number;
  userReacted?: boolean;
}

interface ThreadMessage {
  id: string;
  sender: {
    name: string;
    avatar: string;
    roleBadge: string;
    roleColor: "purple" | "emerald";
  };
  time: string;
  content: string;
  artifactCard?: {
    title: string;
    type: string;
    size: string;
    updated: string;
    framesCount: string;
  };
  codeBlock?: {
    filename: string;
    syntax: string;
    code: string;
  };
  reactions: ReactionItem[];
}

const INITIAL_GENERAL_MESSAGES: ThreadMessage[] = [
  {
    id: "msg-1",
    sender: {
      name: "Elena Rostova",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      roleBadge: "PRODUCT LEAD",
      roleColor: "purple"
    },
    time: "10:42 AM",
    content: "We just finalized the initial responsive token distribution for the glass HUD system. All telemetry parameters now automatically align with native visionOS frame ticks. Please verify the high-density layout spec before our sync at 2 PM.",
    artifactCard: {
      title: "Design_Token_Matrix_v2.0",
      type: "Figma Canvas",
      size: "48.2 MB",
      updated: "12m ago",
      framesCount: "+18 Frames Component Set"
    },
    reactions: [
      { emoji: "👍", count: 5 },
      { emoji: "❤️", count: 3 },
      { emoji: "✨", count: 4 }
    ]
  },
  {
    id: "msg-2",
    sender: {
      name: "Marcus Vance",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      roleBadge: "PRINCIPAL ARCHITECT",
      roleColor: "emerald"
    },
    time: "10:48 AM",
    content: "Reviewed the token pipeline. The CSS variables map cleanly to our WebGL shaders. Verified the sub-surface refraction logic in the staging environment:",
    codeBlock: {
      filename: "tokens.config.ts",
      syntax: "SYNTAX: TS",
      code: `export const GlassMeshShader = {
  blurRadius: 140,
  refractionIndex: 1.52,
  specularFalloff: 'spring(damping: 24, mass: 1)'
};`
    },
    reactions: [
      { emoji: "🚀", count: 2 }
    ]
  },
  {
    id: "msg-3",
    sender: {
      name: "Sarah Chen",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      roleBadge: "DESIGN SYSTEMS",
      roleColor: "purple"
    },
    time: "10:54 AM",
    content: "Super clean. Merging this into the main release branch now. Pinned the milestone snapshot in the drawer for the afternoon review.",
    reactions: []
  }
];

const SHARED_ARTIFACTS = [
  { id: "art-1", name: "Architecture_Roadmap_H1", size: "3.4 MB", author: "Marcus Vance", icon: FileText },
  { id: "art-2", name: "Token_Export_VisionOS", size: "12.1 MB", author: "Elena Rostova", icon: FolderGit2 },
  { id: "art-3", name: "VisionOS_Palette_Spec", size: "180 KB", author: "Sarah Chen", icon: Palette },
];

const Chat = () => {
  const { user } = useAuth();
  
  // Navigation & Screen selection (matching Stitch screens)
  // screen 1: 166204839460473b91cc6c9bb17a44fb (Workspace Stream / #general)
  // screen 2: 59e8b57ca56f4ef19c3dac96a71e964b (Direct Threads)
  // screen 3: 45f67ab32003488283efcc490daf902b (Pinned Artifacts / Code Studio)
  // screen 4: 82f500dee4ff4a058c022659b769324a (Voice Huddle Stage)
  const [activeNavTab, setActiveNavTab] = useState<"workspace" | "channels" | "direct" | "colleagues" | "artifacts">("workspace");
  const [selectedChannel, setSelectedChannel] = useState<string>("general");
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  
  // Real backend conversation ID (if browsing D1 chats)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [poppedOutConversation, setPoppedOutConversation] = useState<string | null>(null);
  const [isPoppedOutMinimized, setIsPoppedOutMinimized] = useState(false);

  // Voice Huddle State (Screen 4)
  const [inVoiceHuddle, setInVoiceHuddle] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [huddleParticipantsCount, setHuddleParticipantsCount] = useState(3);

  // Inspector Drawer Toggle
  const [showRightInspector, setShowRightInspector] = useState(true);
  
  // Composer & Messages state
  const [messages, setMessages] = useState<ThreadMessage[]>(INITIAL_GENERAL_MESSAGES);
  const [composerText, setComposerText] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Dialogs
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!composerText.trim()) return;

    const newMsg: ThreadMessage = {
      id: `msg-${Date.now()}`,
      sender: {
        name: user?.username || (user as any)?.displayName || "Alex Mercer",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
        roleBadge: "ONLINE MEMBER",
        roleColor: "purple"
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: composerText.trim(),
      reactions: []
    };

    setMessages((prev) => [...prev, newMsg]);
    setComposerText("");
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId) return msg;
        const existing = msg.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          return {
            ...msg,
            reactions: msg.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r
            )
          };
        }
        return {
          ...msg,
          reactions: [...msg.reactions, { emoji, count: 1, userReacted: true }]
        };
      })
    );
  };

  const copyShaderCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

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
              onClick={() => {
                setActiveNavTab("workspace");
                setSelectedConversation(null);
                setSelectedDM(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "workspace" && !selectedConversation && !selectedDM
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
                setSelectedConversation(null);
                setSelectedDM(null);
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
                setSelectedDM("Elena Rostova");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeNavTab === "direct" || selectedDM
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

        {/* Bottom User Card */}
        <div className="bg-[#121422] border border-[#1e2235] p-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="w-8 h-8 rounded-full border border-purple-500/40">
                <AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" />
                <AvatarFallback className="bg-purple-600 text-white text-xs font-bold">
                  {(user?.username || "A")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#121422]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate leading-tight">
                {user?.username || (user as any)?.displayName || "Alex Mercer"}
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
                A
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Acme Corp</span>
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

            {/* # general (Active in Stitch screenshot) */}
            <button
              onClick={() => {
                setSelectedChannel("general");
                setSelectedConversation(null);
                setSelectedDM(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedChannel === "general" && !selectedConversation && !selectedDM
                  ? "bg-[#25203d] border border-[#4a3b75] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-white/40" />
                <span>general</span>
              </div>
              {selectedChannel === "general" && !selectedConversation && !selectedDM && (
                <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Active
                </span>
              )}
            </button>

            {/* # product-design */}
            <button
              onClick={() => {
                setSelectedChannel("product-design");
                setSelectedConversation(null);
                setSelectedDM(null);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-white/40" />
                <span>product-design</span>
              </div>
              <span className="text-[10px] font-mono text-white/40 bg-white/[0.05] px-1.5 py-0.2 rounded">
                8
              </span>
            </button>

            {/* # engineering */}
            <button
              onClick={() => {
                setSelectedChannel("engineering");
                setSelectedConversation(null);
                setSelectedDM(null);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-white/40" />
                <span>engineering</span>
              </div>
            </button>

            {/* # announcements */}
            <button
              onClick={() => {
                setSelectedChannel("announcements");
                setSelectedConversation(null);
                setSelectedDM(null);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-white/40" />
                <span>announcements</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            </button>
          </div>

          {/* DIRECT MESSAGES SECTION */}
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold">
              <span>Direct Messages</span>
              <button 
                onClick={() => setShowNewDialog(true)}
                className="hover:text-white p-0.5 rounded transition-colors"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>

            {/* Elena Rostova */}
            <button
              onClick={() => {
                setSelectedDM("Elena Rostova");
                setSelectedConversation(null);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                selectedDM === "Elena Rostova"
                  ? "bg-[#25203d] border border-[#4a3b75] text-white"
                  : "hover:bg-white/[0.03] text-white/70"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="w-6 h-6 rounded-full">
                  <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" />
                  <AvatarFallback className="text-[10px]">ER</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-white truncate">Elena Rostova</span>
                <span className="text-[10px] text-white/40 truncate">Product Lead</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </button>

            {/* Marcus Vance */}
            <button
              onClick={() => {
                setSelectedDM("Marcus Vance");
                setSelectedConversation(null);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                selectedDM === "Marcus Vance"
                  ? "bg-[#25203d] border border-[#4a3b75] text-white"
                  : "hover:bg-white/[0.03] text-white/70"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="w-6 h-6 rounded-full">
                  <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" />
                  <AvatarFallback className="text-[10px]">MV</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-white truncate">Marcus Vance</span>
                <span className="text-[10px] text-white/40 truncate">Principal Archi...</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </button>

            {/* Sarah Chen */}
            <button
              onClick={() => {
                setSelectedDM("Sarah Chen");
                setSelectedConversation(null);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                selectedDM === "Sarah Chen"
                  ? "bg-[#25203d] border border-[#4a3b75] text-white"
                  : "hover:bg-white/[0.03] text-white/70"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="w-6 h-6 rounded-full">
                  <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" />
                  <AvatarFallback className="text-[10px]">SC</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-white truncate">Sarah Chen</span>
                <span className="text-[10px] text-white/40 truncate">Design Systems</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </button>
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
      {/* COLUMN 3: MAIN STAGE / CONVERSATION STREAM (Flex 1)      */}
      {/* ======================================================== */}
      <div className="flex-1 bg-[#090a14] flex flex-col overflow-hidden relative">
        
        {/* Top Global Header Bar */}
        <div className="h-12 shrink-0 px-5 flex items-center justify-between border-b border-[#1a1d2e] bg-[#090a14]/90 backdrop-blur-md z-10">
          {/* Left Title */}
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-white font-heading tracking-tight">
              Production Engineering
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

            {/* Join Voice Huddle Button (Screen 4 Trigger) */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setInVoiceHuddle(!inVoiceHuddle);
                if (!inVoiceHuddle) toast.success("Joined Voice Huddle #core-runtime");
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

            {/* Grid Apps / Launcher */}
            <button 
              onClick={() => setShowRightInspector(!showRightInspector)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              title="Toggle Overview Drawer"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* User Profile Ring */}
            <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-xs font-bold text-purple-200">
              {(user?.username || "A")[0]?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Channel Sub-Header Bar */}
        <div className="h-14 shrink-0 px-5 flex items-center justify-between border-b border-[#1a1d2e] bg-[#0c0d18]/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/70">
              <Hash className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">
                  {selectedDM ? selectedDM : selectedChannel}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  24 online
                </span>
              </div>
              <span className="text-[11px] text-white/45">
                Core Architecture & Design Roadmap for H1 2025
              </span>
            </div>
          </div>

          {/* Sub-Header Actions */}
          <div className="flex items-center gap-2">
            {/* Huddle Indicator Pill */}
            <button 
              onClick={() => setInVoiceHuddle(!inVoiceHuddle)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Huddle 3</span>
            </button>

            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>

            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors">
              <Pin className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Voice Huddle Overlay Banner (Screen 4 Mode) */}
        <AnimatePresence>
          {inVoiceHuddle && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-gradient-to-r from-emerald-950/40 via-indigo-950/40 to-black/60 border-b border-emerald-500/30 px-5 py-3 flex items-center justify-between overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <Avatar className="w-7 h-7 ring-2 ring-emerald-500/40">
                    <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" />
                  </Avatar>
                  <Avatar className="w-7 h-7 ring-2 ring-emerald-500/40">
                    <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" />
                  </Avatar>
                  <Avatar className="w-7 h-7 ring-2 ring-emerald-500/40">
                    <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" />
                  </Avatar>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    Live Huddle in #core-runtime
                    <span className="text-[10px] font-mono text-emerald-400">● Streaming 48kHz</span>
                  </span>
                  <span className="text-[10px] text-white/50">Elena Rostova, Marcus Vance, Sarah Chen</span>
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

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Date Separator */}
          <div className="flex items-center justify-center my-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 bg-white/[0.03] border border-white/[0.06] px-3 py-1 rounded-full">
              Today, February 24
            </span>
          </div>

          {/* Messages */}
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3.5 group">
              {/* Sender Avatar */}
              <Avatar className="w-9 h-9 rounded-full shrink-0 ring-1 ring-white/10 mt-0.5">
                <AvatarImage src={msg.sender.avatar} />
                <AvatarFallback>{msg.sender.name[0]}</AvatarFallback>
              </Avatar>

              {/* Message Body */}
              <div className="flex flex-col gap-1.5 max-w-[680px]">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-tight">
                    {msg.sender.name}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    {msg.time}
                  </span>
                  <span className={`text-[8.5px] font-mono uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded border ${
                    msg.sender.roleColor === "emerald"
                      ? "bg-[#13382c] border-[#1e5641] text-[#34d399]"
                      : "bg-[#3b2d54] border-[#5a4290] text-[#a78bfa]"
                  }`}>
                    {msg.sender.roleBadge}
                  </span>
                </div>

                {/* Text Content */}
                <p className="text-[13px] text-white/85 leading-relaxed">
                  {msg.content}
                </p>

                {/* Elena's Figma / Artifact Card (Exact Stitch specification) */}
                {msg.artifactCard && (
                  <div className="mt-2 rounded-2xl bg-[#0f111e] border border-white/[0.08] p-3.5 flex flex-col gap-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6c5ce7] flex items-center justify-center shadow-lg">
                          <Palette className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">
                            {msg.artifactCard.title}
                          </span>
                          <span className="text-[10.5px] font-mono text-white/45">
                            {msg.artifactCard.type} • {msg.artifactCard.size} • Updated {msg.artifactCard.updated}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toast.info("Opening Figma interactive canvas...")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white border border-white/[0.08] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-white/60" />
                          <span>Preview</span>
                        </button>
                        <button 
                          onClick={() => toast.success("Downloaded artifact matrix")}
                          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white border border-white/[0.08] transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Preview Thumbnails Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="h-20 rounded-xl bg-[#171a2e] border border-white/[0.08] p-2 flex flex-col justify-between overflow-hidden shadow-inner">
                        <div className="w-full h-2 bg-indigo-500/30 rounded" />
                        <div className="space-y-1">
                          <div className="w-3/4 h-1.5 bg-white/20 rounded" />
                          <div className="w-1/2 h-1.5 bg-white/10 rounded" />
                        </div>
                      </div>
                      <div className="h-20 rounded-xl bg-[#171a2e] border border-white/[0.08] p-2 flex flex-col justify-between overflow-hidden shadow-inner">
                        <div className="w-full h-2 bg-purple-500/30 rounded" />
                        <div className="space-y-1">
                          <div className="w-4/5 h-1.5 bg-white/20 rounded" />
                          <div className="w-2/3 h-1.5 bg-white/10 rounded" />
                        </div>
                      </div>
                      <div className="h-20 rounded-xl bg-[#121422] border border-white/[0.08] flex items-center justify-center p-2 text-center">
                        <span className="text-[10.5px] font-mono text-white/50 font-medium">
                          {msg.artifactCard.framesCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Marcus's Code Card (Exact Stitch specification) */}
                {msg.codeBlock && (
                  <div className="mt-2 rounded-xl bg-[#080a12] border border-white/[0.08] overflow-hidden shadow-xl">
                    <div className="px-3.5 py-2 bg-black/40 border-b border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] font-mono text-white/70 font-semibold">
                        {msg.codeBlock.filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {msg.codeBlock.syntax}
                        </span>
                        <button
                          onClick={() => copyShaderCode(msg.codeBlock!.code)}
                          className="text-white/40 hover:text-white p-0.5 rounded transition-colors"
                          title="Copy source"
                        >
                          {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <FileCode className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <pre className="p-3.5 text-[11.5px] font-mono text-white/85 leading-relaxed overflow-x-auto">
                      {msg.codeBlock.code}
                    </pre>
                  </div>
                )}

                {/* Reactions Dock */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {msg.reactions.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleReaction(msg.id, r.emoji)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono transition-all ${
                        r.userReacted
                          ? "bg-purple-500/20 border border-purple-500/40 text-purple-200"
                          : "bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-white/70"
                      }`}
                    >
                      <span>{r.emoji}</span>
                      <span className="text-[10.5px] font-bold">{r.count}</span>
                    </button>
                  ))}
                  <button 
                    onClick={() => handleReaction(msg.id, "👍")}
                    className="w-6 h-6 rounded-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-white/40 hover:text-white flex items-center justify-center text-xs transition-colors"
                    title="Add reaction"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Floating Island Composer */}
        <div className="p-4 shrink-0 bg-transparent">
          <form 
            onSubmit={handleSendMessage}
            className="w-full bg-[#11131f] border border-white/[0.1] rounded-2xl p-2 px-3 flex items-center justify-between shadow-2xl focus-within:border-indigo-500/50 transition-all"
          >
            {/* Left Formatting Tools */}
            <div className="flex items-center gap-1 shrink-0 text-white/50">
              <button 
                type="button" 
                onClick={() => toast.info("Attach file or Figma token")}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.06] hover:text-white flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={() => setComposerText(prev => prev + "**bold**")}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.06] hover:text-white flex items-center justify-center transition-colors"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => setComposerText(prev => prev + "```ts\n\n```")}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.06] hover:text-white flex items-center justify-center transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => setComposerText(prev => prev + "✨")}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.06] hover:text-white flex items-center justify-center transition-colors"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => setComposerText(prev => prev + "@")}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.06] hover:text-white flex items-center justify-center transition-colors"
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Input Field */}
            <input
              type="text"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={`Message #${selectedChannel} (Markdown and shortcuts supported)...`}
              className="flex-1 bg-transparent px-3 text-xs text-white placeholder:text-white/40 focus:outline-none"
            />

            {/* Right Send Trigger */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!composerText.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-[#5b5bf7] hover:bg-[#4f46e5] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(91,91,247,0.35)] transition-all cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </form>
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
                Core Architecture & Design
              </h3>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Single source of truth for Acme Corp design system and token engines.
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

            {/* Shared Artifacts List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold">
                <span>Shared Artifacts</span>
                <button 
                  onClick={() => setActiveNavTab("artifacts")}
                  className="text-indigo-400 hover:text-indigo-300 text-[9.5px] font-semibold"
                >
                  View All
                </button>
              </div>

              <div className="space-y-1.5">
                {SHARED_ARTIFACTS.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => toast.info(`Viewing ${art.name}`)}
                    className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/10 flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <art.icon className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-white truncate">{art.name}</span>
                        <span className="text-[10px] text-white/40 font-mono">{art.size} • {art.author}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Online Contributors Section */}
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold block">
                Online Contributors
              </span>
              <div className="flex items-center -space-x-2">
                <Avatar className="w-7 h-7 ring-2 ring-[#0c0d18]">
                  <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" />
                </Avatar>
                <Avatar className="w-7 h-7 ring-2 ring-[#0c0d18]">
                  <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" />
                </Avatar>
                <Avatar className="w-7 h-7 ring-2 ring-[#0c0d18]">
                  <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" />
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
      {/* DIALOGS & OVERLAYS                                       */}
      {/* ======================================================== */}
      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          setSelectedConversation(id);
          setShowNewDialog(false);
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
