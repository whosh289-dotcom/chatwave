import { useState, useEffect } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { 
  MessageSquare, ShieldCheck, Zap, Plus, Sparkles, Lock, 
  ArrowUpRight, Code2, Users, User, ExternalLink, Maximize2, 
  Minimize2, X, Terminal, Check, Copy, Layers, Radio, Globe, 
  Palette, Settings as SettingsIcon, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

export const SAMPLE_CODE_SNIPPETS = [
  {
    id: "snip-1",
    title: "ESP8266 WiFi Sensor Bridge",
    language: "C++ / Arduino",
    lines: 48,
    size: "1.8 KB",
    code: `/**
 * ESP8266 NodeMCU Telemetry Bridge
 * Edge Real-time Sensor Mesh Network
 */
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>

const char* ssid = "ChatWave-Mesh";
const char* host = "edge.chatwave.internal";
const int port = 443;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, "WPA3_ENTERPRISE_KEY");
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  }
  Serial.println("Mesh Connected! IP: " + WiFi.localIP().toString());
}`
  },
  {
    id: "snip-2",
    title: "Cloudflare D1 Worker Query",
    language: "TypeScript",
    lines: 32,
    size: "1.2 KB",
    code: `import { Hono } from "hono";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/messages", async (c) => {
  const convId = c.req.query("conversationId");
  const { results } = await c.env.DB.prepare(
    \`SELECT id, sender_id, content, created_at, message_type 
     FROM messages WHERE conversation_id = ? 
     ORDER BY created_at ASC LIMIT 100\`
  ).bind(convId).all();

  return c.json({ messages: results, latencyMs: 2.1 });
});`
  }
];

const Chat = () => {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [poppedOutConversation, setPoppedOutConversation] = useState<string | null>(null);
  const [isPoppedOutMinimized, setIsPoppedOutMinimized] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<"chats" | "direct" | "groups" | "code_vault" | "security">("chats");
  const [showCodeStudio, setShowCodeStudio] = useState(false);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [themeAccent, setThemeAccent] = useState<string>("default");

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

  const handlePopOut = (convId: string | null) => {
    if (!convId) return;
    setPoppedOutConversation(convId);
    setIsPoppedOutMinimized(false);
    toast.success("Conversation detached into Floating 3D Window");
  };

  const handleDockBack = () => {
    if (poppedOutConversation) {
      setSelectedConversation(poppedOutConversation);
      setPoppedOutConversation(null);
      setIsPoppedOutMinimized(false);
      toast.info("Conversation docked back to Main Bento Stage");
    }
  };

  const cycleThemeAccent = () => {
    const accents = ["default", "emerald", "telegram", "rose", "solar", "oled"];
    const nextIdx = (accents.indexOf(themeAccent) + 1) % accents.length;
    const next = accents[nextIdx];
    setThemeAccent(next);
    if (next === "default") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.setAttribute("data-accent", next);
    }
    toast.info(`Theme Accent: ${next.toUpperCase()}`);
  };

  const copySnippet = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(id);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const mapNavToFilter = (tab: "chats" | "direct" | "groups" | "code_vault" | "security"): "all" | "unread" | "direct" | "groups" => {
    if (tab === "direct") return "direct";
    if (tab === "groups") return "groups";
    return "all";
  };

  return (
    <div className="flex h-screen w-full bg-[#05060a] text-white overflow-hidden p-0 md:p-2 lg:p-3 relative select-none">
      {/* Ambient Drifting Mesh Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-3/4 left-1/2 w-[350px] h-[350px] bg-emerald-500/08 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* MASTER BENTO WORKSPACE WINDOW */}
      <div className="flex flex-col w-full h-full bento-glass md:rounded-3xl overflow-hidden relative shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] border border-white/[0.12]">
        
        {/* SPATIAL TITLEBAR & macOS TRAFFIC LIGHTS */}
        <div className="h-10 shrink-0 px-4 flex items-center justify-between border-b border-white/[0.08] bg-black/40 backdrop-blur-2xl">
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedConversation(null)} 
              title="Close active stage" 
              className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all shadow-sm"
            >
              <X className="w-2 h-2 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => {
                if (selectedConversation) handlePopOut(selectedConversation);
              }} 
              title="Detach to Floating Window" 
              className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all shadow-sm"
            >
              <Minimize2 className="w-2 h-2 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                } else {
                  document.exitFullscreen().catch(() => {});
                }
              }} 
              title="Toggle Fullscreen Canvas" 
              className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all shadow-sm"
            >
              <Maximize2 className="w-2 h-2 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Central Spatial Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[11px] font-heading font-semibold text-white/90 tracking-tight">
              ChatWave Spatial
            </span>
            <span className="text-white/20 text-[10px]">•</span>
            <span className="text-[10px] font-mono text-emerald-400/90 font-medium flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" /> D1 Edge 3.8ms
            </span>
            <span className="text-white/20 text-[10px]">•</span>
            <span className="text-[10px] font-mono text-indigo-300 font-medium flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-indigo-400" /> E2EE
            </span>
          </div>

          {/* Right Utility Dock */}
          <div className="flex items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCodeStudio(!showCodeStudio)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border transition-all ${
                showCodeStudio 
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" 
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border-white/[0.08]"
              }`}
              title="Toggle Code & Artifact Studio"
            >
              <Code2 className="w-3 h-3 text-indigo-400" />
              <span className="hidden sm:inline">Code Studio</span>
            </motion.button>

            {selectedConversation && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePopOut(selectedConversation)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-indigo-300 border border-white/[0.08] transition-all"
                title="Pop out conversation into floating window"
              >
                <ExternalLink className="w-3 h-3 text-indigo-400" />
                <span className="hidden sm:inline">Pop Out</span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewDialog(true)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-400/30 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)]"
              title="Start New Conversation (⌘N)"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline">New</span>
            </motion.button>
          </div>
        </div>

        {/* WORKSPACE BODY: MULTI-PANE ARCHITECTURE */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* PANE 0: LEFT SPATIAL NAVIGATION DOCK (Desktop Rail) */}
          <div className="hidden lg:flex flex-col items-center justify-between w-[64px] shrink-0 border-r border-white/[0.08] bg-black/45 backdrop-blur-2xl py-4 z-20">
            {/* Top Brand Glyph */}
            <div className="flex flex-col items-center gap-5">
              <motion.div
                whileHover={{ scale: 1.15, rotateY: 180 }}
                transition={{ duration: 0.5 }}
                style={{ transformPerspective: 600 }}
                onClick={() => setSelectedConversation(null)}
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-[0_4px_16px_rgba(99,102,241,0.4)] cursor-pointer"
                title="ChatWave Home"
              >
                <div className="w-full h-full rounded-[10px] bg-[#0c0d15] flex items-center justify-center border border-white/20">
                  <MessageSquare className="w-5 h-5 text-indigo-300" />
                </div>
              </motion.div>

              {/* Navigation Tabs */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => { setActiveNavTab("chats"); setShowCodeStudio(false); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
                    activeNavTab === "chats"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
                  }`}
                  title="All Chats"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setActiveNavTab("direct"); setShowCodeStudio(false); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    activeNavTab === "direct"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
                  }`}
                  title="Direct Messages"
                >
                  <User className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setActiveNavTab("groups"); setShowCodeStudio(false); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    activeNavTab === "groups"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
                  }`}
                  title="Group Channels"
                >
                  <Users className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setActiveNavTab("code_vault"); setShowCodeStudio(true); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    showCodeStudio || activeNavTab === "code_vault"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
                  }`}
                  title="Code & Artifact Studio"
                >
                  <Code2 className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={cycleThemeAccent}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent transition-all"
                title={`Theme Accent: ${themeAccent}`}
              >
                <Palette className="w-4 h-4 text-purple-400" />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent transition-all"
                title="Settings (⌘,)"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-white/10 flex items-center justify-center relative shadow-sm">
                <Avatar className="w-full h-full rounded-[10px]">
                  <AvatarFallback className="bg-transparent text-indigo-200 font-semibold font-heading text-xs">
                    {(user?.username || (user as any)?.displayName || "U")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
              </div>
            </div>
          </div>

          {/* PANE A: SIDEBAR CONVERSATIONS (Responsive) */}
          <div className={`w-full md:w-[340px] lg:w-[360px] shrink-0 border-r border-white/[0.08] bg-black/30 backdrop-blur-2xl ${selectedConversation ? "hidden md:block" : "block"}`}>
            <ChatSidebar
              selectedConversation={selectedConversation}
              onSelectConversation={(id) => {
                setSelectedConversation(id);
                // If this is currently the popped-out window, close the popout to view in main stage
                if (poppedOutConversation === id) {
                  setPoppedOutConversation(null);
                }
              }}
              onNewConversation={() => setShowNewDialog(true)}
              externalFilterTab={mapNavToFilter(activeNavTab)}
            />
          </div>

          {/* PANE B: MAIN CONVERSATION STAGE */}
          <div className={`flex-1 bg-transparent ${!selectedConversation ? "hidden md:flex" : "flex"} relative overflow-hidden flex flex-col`}>
            <AnimatePresence mode="wait">
              {selectedConversation ? (
                <motion.div
                  key={selectedConversation}
                  initial={{ opacity: 0, scale: 0.94, rotateX: 4, y: 16 }}
                  animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, rotateX: -4, y: -12 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, mass: 0.65 }}
                  style={{ transformPerspective: 1200, transformOrigin: "bottom center" }}
                  className="flex-1 h-full w-full overflow-hidden flex flex-col"
                >
                  <ChatView
                    conversationId={selectedConversation}
                    onBack={() => setSelectedConversation(null)}
                    onPopOut={() => handlePopOut(selectedConversation)}
                  />
                </motion.div>
              ) : (
                /* 3D SPATIAL SHOWCASE EMPTY STATE */
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-hidden bg-[#060810]/95 w-full h-full select-none"
                >
                  {/* Glowing Radial Atmospheric Aura */}
                  <div className="absolute w-[480px] h-[480px] bg-gradient-to-tr from-indigo-500/18 via-purple-500/12 to-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />

                  <div className="relative z-10 max-w-md text-center flex flex-col items-center">
                    {/* 3D Gyroscopic Floating Emblem */}
                    <div className="relative mb-6">
                      <motion.div
                        animate={{
                          rotateY: [-10, 10, -10],
                          rotateX: [6, -6, 6],
                          y: [0, -8, 0],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 6,
                          ease: "easeInOut",
                        }}
                        whileHover={{ scale: 1.12, rotateY: 360, transition: { duration: 0.8 } }}
                        style={{ transformPerspective: 900 }}
                        className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-[0_20px_50px_rgba(99,102,241,0.5)] cursor-pointer"
                      >
                        <div className="w-full h-full rounded-[22px] bg-[#090b14]/90 backdrop-blur-2xl flex items-center justify-center border border-white/20">
                          <MessageSquare className="w-9 h-9 text-indigo-300 drop-shadow-[0_0_14px_rgba(129,140,248,0.85)]" />
                        </div>
                      </motion.div>
                    </div>

                    {/* Spatial Status Badge */}
                    <div className="pill-badge mb-3 text-indigo-300 border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Spatial Bento Operating Canvas
                    </div>

                    <h2 className="text-3xl lg:text-4xl font-heading font-extrabold tracking-tight text-white mb-2.5">
                      Welcome to{" "}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
                        ChatWave
                      </span>
                    </h2>

                    <p className="text-white/50 text-[13.5px] leading-relaxed mb-7 max-w-sm">
                      Zero-knowledge cryptographic encryption, 3D multi-window workflows, and native obsidian code cards.
                    </p>

                    {/* Feature Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11.5px] text-white/80 font-medium shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> End-to-End Encrypted
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11.5px] text-white/80 font-medium shadow-sm">
                        <Code2 className="w-3.5 h-3.5 text-indigo-400" /> Obsidian Code Studio
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11.5px] text-white/80 font-medium shadow-sm">
                        <Layers className="w-3.5 h-3.5 text-purple-400" /> Multi-Window Gen
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowNewDialog(true)}
                        className="glow-btn px-6 py-2.5 rounded-xl font-heading font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-[0_10px_30px_rgba(99,102,241,0.45)] hover:shadow-[0_15px_40px_rgba(99,102,241,0.65)] transition-all"
                      >
                        <Plus className="w-4 h-4" /> Start Conversation
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowCodeStudio(true)}
                        className="px-5 py-2.5 rounded-xl font-heading font-medium text-xs flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] text-white/90 border border-white/10 transition-all cursor-pointer"
                      >
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Code Studio
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* PANE C: MULTI-WINDOW CODE & ARTIFACT STUDIO DRAWER */}
          <AnimatePresence>
            {showCodeStudio && (
              <motion.div
                initial={{ width: 0, opacity: 0, x: 40 }}
                animate={{ width: 380, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="hidden xl:flex flex-col border-l border-white/[0.08] bg-[#080a12]/95 backdrop-blur-2xl shrink-0 z-30 overflow-hidden"
              >
                {/* Code Studio Header */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-heading font-semibold text-white tracking-tight flex items-center gap-1.5">
                        Code & Artifact Studio
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </h3>
                      <p className="text-[10px] text-white/45 font-mono">Shared snippets & compiler traces</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCodeStudio(false)}
                    className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Code Snippets List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider px-1">
                    Active Code Artifacts ({SAMPLE_CODE_SNIPPETS.length})
                  </div>

                  {SAMPLE_CODE_SNIPPETS.map((snip) => (
                    <div 
                      key={snip.id}
                      className="rounded-xl border border-white/[0.1] bg-[#0c0e18] p-3.5 shadow-lg relative group hover:border-indigo-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                          {snip.language}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                          <span>{snip.lines} lines</span>
                          <span>•</span>
                          <span>{snip.size}</span>
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-white/90 mb-2">{snip.title}</div>

                      <div className="relative rounded-lg bg-[#05060c] p-2.5 border border-white/[0.06] overflow-hidden">
                        <pre className="text-[10.5px] font-mono text-white/70 overflow-x-hidden leading-relaxed line-clamp-4">
                          {snip.code}
                        </pre>
                        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#05060c] to-transparent pointer-events-none" />
                      </div>

                      <div className="flex items-center justify-end mt-2.5 pt-2 border-t border-white/[0.06]">
                        <button
                          onClick={() => copySnippet(snip.id, snip.code)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white border border-white/[0.08] transition-all cursor-pointer"
                        >
                          {copiedSnippetId === snip.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-white/50" />
                              <span>Copy Source</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Status */}
                <div className="p-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-[10.5px] font-mono text-white/50">
                  <span>Engine: WebAssembly v8</span>
                  <span className="text-emerald-400">● Ready</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* WINDOW 2: STANDALONE FLOATING 3D POP-OUT CONVERSATION WINDOW */}
      <AnimatePresence>
        {poppedOutConversation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ 
              opacity: 1, 
              scale: isPoppedOutMinimized ? 0.95 : 1, 
              y: 0,
              height: isPoppedOutMinimized ? "48px" : "560px"
            }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{ transformPerspective: 1200 }}
            className={`fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 w-[94vw] sm:w-[440px] rounded-2xl border border-white/20 bg-[#080a14]/96 backdrop-blur-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(99,102,241,0.3)] overflow-hidden flex flex-col transition-all`}
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
                <button
                  onClick={() => setIsPoppedOutMinimized(!isPoppedOutMinimized)}
                  className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all"
                  title={isPoppedOutMinimized ? "Restore Window" : "Minimize Window"}
                >
                  <Minimize2 className="w-2 h-2 text-black/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={handleDockBack}
                  className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all"
                  title="Dock Back to Main Stage"
                >
                  <Maximize2 className="w-2 h-2 text-black/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-heading font-semibold text-white/90">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span>Detached 3D Stage</span>
              </div>

              <button
                onClick={handleDockBack}
                className="text-[10.5px] font-mono text-indigo-300 hover:text-white px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer"
                title="Dock back to main stage"
              >
                Dock
              </button>
            </div>

            {/* Pop-Out Stage Body */}
            {!isPoppedOutMinimized && (
              <div className="flex-1 overflow-hidden relative">
                <ChatView
                  conversationId={poppedOutConversation}
                  isPoppedOut={true}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DIALOGS */}
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
