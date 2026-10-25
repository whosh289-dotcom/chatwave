import { useState, useEffect } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { MessageSquare, Plus, ExternalLink, X, Shield, Lock, Users, Sparkles, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

const Chat = () => {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [poppedOutConversation, setPoppedOutConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-select the first conversation if none selected on desktop
  useEffect(() => {
    if (!user) return;
    const fetchFirst = async () => {
      try {
        const res = await fetch(`/api/conversations?userId=${user.id}`);
        if (!res.ok) return;
        const { conversations } = await res.json();
        // On desktop screen (width >= 768), auto-select first conversation
        if (window.innerWidth >= 768 && conversations.length > 0 && !selectedConversation) {
          setSelectedConversation(conversations[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchFirst();
  }, [user]);

  // Global keyboard shortcuts (⌘N for new conversation, ⌘, for settings)
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

  return (
    <div className="flex h-screen w-full bg-[#080911] text-white overflow-hidden select-none font-sans relative">
      
      {/* ======================================================== */}
      {/* LEFT PANE: PERSONAL CHATS SIDEBAR (Width: 340px-380px)   */}
      {/* ======================================================== */}
      <div 
        className={`w-full md:w-[350px] lg:w-[380px] shrink-0 border-r border-white/[0.08] bg-[#07080e]/95 backdrop-blur-2xl flex flex-col z-20 ${
          selectedConversation ? "hidden md:flex" : "flex"
        }`}
      >
        <ChatSidebar
          selectedConversation={selectedConversation}
          onSelectConversation={(id) => setSelectedConversation(id)}
          onNewConversation={() => setShowNewDialog(true)}
        />
      </div>

      {/* ======================================================== */}
      {/* CENTER PANE: ACTIVE PERSONAL CHAT STAGE                  */}
      {/* ======================================================== */}
      <div 
        className={`flex-1 flex flex-col bg-[#090a14] overflow-hidden relative ${
          !selectedConversation ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedConversation ? (
          <ChatView
            key={selectedConversation}
            conversationId={selectedConversation}
            onBack={() => setSelectedConversation(null)}
            onPopOut={() => setPoppedOutConversation(selectedConversation)}
          />
        ) : (
          /* Empty Stage: Friendly, Personal Welcome */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative select-none">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />

            {/* Glowing Logo Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative mb-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 p-[1.5px] shadow-[0_12px_40px_rgba(99,102,241,0.35)]">
                <div className="w-full h-full rounded-[22px] bg-[#080912] flex items-center justify-center">
                  <MessageCircle className="w-10 h-10 text-indigo-400" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 ring-4 ring-[#090a14] flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-black" />
              </span>
            </motion.div>

            {/* Friendly Title & Subtitle */}
            <h2 className="text-xl font-bold font-heading text-white tracking-tight mb-2">
              Welcome to ChatWave
            </h2>
            <p className="text-xs text-white/50 max-w-sm leading-relaxed mb-6 font-normal">
              Direct, private messaging with friends and family. Send messages, voice notes, code, photos, and jump on high-definition audio & video calls.
            </p>

            {/* Quick Action Button */}
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowNewDialog(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-[0_8px_25px_rgba(99,102,241,0.4)] flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Start a New Chat</span>
            </motion.button>

            {/* Privacy Badges */}
            <div className="flex items-center gap-4 mt-8 text-[11px] text-white/40">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Private & Encrypted</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zero Server Logs</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* FLOATING DETACHED CHAT WINDOW (POP-OUT)                  */}
      {/* ======================================================== */}
      <AnimatePresence>
        {poppedOutConversation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 40 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: "580px"
            }}
            exit={{ opacity: 0, scale: 0.88, y: 40 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 w-[94vw] sm:w-[440px] rounded-2xl border border-white/20 bg-[#080a14]/98 backdrop-blur-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(99,102,241,0.3)] overflow-hidden flex flex-col"
          >
            {/* Clean, Modern Titlebar (No weird red/yellow/green dots) */}
            <div className="h-11 shrink-0 px-4 flex items-center justify-between border-b border-white/[0.1] bg-black/60">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">Detached Chat</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setSelectedConversation(poppedOutConversation);
                    setPoppedOutConversation(null);
                  }}
                  className="text-xs text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer font-medium"
                >
                  Dock
                </button>
                <button
                  onClick={() => setPoppedOutConversation(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/[0.08] text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pop-Out Body */}
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
      {/* DIALOGS                                                  */}
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
