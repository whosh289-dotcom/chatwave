import { useState } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { MessageSquare, ShieldCheck, Zap, Plus, Sparkles, Lock, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="flex h-screen w-full bg-transparent md:p-3 lg:p-4">
      <div className="flex w-full h-full bento-glass overflow-hidden md:rounded-3xl relative">
        
        {/* Sidebar - responsive visibility with Figma Frosted Glass */}
        <div className={`w-full md:w-[360px] lg:w-[380px] shrink-0 border-r border-white/[0.08] bg-black/25 backdrop-blur-2xl ${selectedConversation ? "hidden md:block" : ""}`}>
          <ChatSidebar
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onNewConversation={() => setShowNewDialog(true)}
          />
        </div>

        {/* Main Conversation Stream */}
        <div 
          className={`flex-1 bg-transparent ${!selectedConversation ? "hidden md:flex" : "flex"} relative overflow-hidden perspective-1200`}
          style={{ perspective: 1200, transformStyle: "preserve-3d" }}
        >
          <AnimatePresence mode="wait">
            {selectedConversation ? (
              <motion.div
                key={selectedConversation}
                initial={{ 
                  opacity: 0, 
                  scale: 0.86, 
                  z: -160, 
                  rotateY: -9, 
                  rotateX: 5, 
                  y: 28,
                  filter: "blur(4px)"
                }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  z: 0, 
                  rotateY: 0, 
                  rotateX: 0, 
                  y: 0,
                  filter: "blur(0px)"
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.88, 
                  z: -120, 
                  rotateY: 9, 
                  rotateX: -4, 
                  y: -20,
                  filter: "blur(4px)",
                  transition: { duration: 0.18, ease: "easeIn" }
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 340, 
                  damping: 24, 
                  mass: 0.7 
                }}
                style={{ 
                  transformStyle: "preserve-3d", 
                  transformOrigin: "left center" 
                }}
                className="flex-1 h-full overflow-hidden flex flex-col"
              >
                <ChatView
                  conversationId={selectedConversation}
                  onBack={() => setSelectedConversation(null)}
                />
              </motion.div>
            ) : (
              /* Elevated Framer-Style Empty State Showcase */
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.94, z: -50 }}
                animate={{ opacity: 1, scale: 1, z: 0 }}
                exit={{ opacity: 0, scale: 0.92, z: -80, rotateY: -8, filter: "blur(3px)" }}
                transition={{ type: "spring", stiffness: 350, damping: 26 }}
                style={{ transformStyle: "preserve-3d" }}
                className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-hidden bg-[#08090f]/90"
              >
                {/* Subtle Ambient WhatsApp Doodle Background */}
                <div className="absolute inset-0 chat-bg-doodle opacity-35 pointer-events-none" />

                {/* Animated Glowing Radial Halo */}
                <motion.div
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.35, 0.55, 0.35],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute w-[440px] h-[440px] bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-emerald-500/15 rounded-full blur-[130px] pointer-events-none"
                />

                <div className="relative z-10 max-w-md text-center flex flex-col items-center perspective-1000">
                  {/* Floating 3D Gyroscopic Brand Emblem */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{
                        scale: [1, 1.25, 1],
                        opacity: [0.4, 0, 0.4],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                      className="absolute -inset-2 rounded-3xl bg-indigo-500/30 blur-md pointer-events-none"
                    />
                    <motion.div
                      animate={{
                        rotateY: [-12, 12, -12],
                        rotateX: [8, -8, 8],
                        y: [0, -10, 0],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 5,
                        ease: "easeInOut",
                      }}
                      whileHover={{ 
                        scale: 1.15, 
                        rotateY: 360, 
                        rotateX: 0,
                        transition: { duration: 0.85, ease: "easeOut" } 
                      }}
                      whileTap={{ scale: 0.94 }}
                      style={{ transformStyle: "preserve-3d" }}
                      className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-[0_20px_45px_rgba(99,102,241,0.5)] cursor-pointer"
                    >
                      <div 
                        className="w-full h-full rounded-[22px] bg-[#0c0d14]/85 backdrop-blur-xl flex items-center justify-center border border-white/20"
                        style={{ transform: "translateZ(18px)", transformStyle: "preserve-3d" }}
                      >
                        <MessageSquare className="w-8 h-8 text-indigo-300 stroke-[2.2] drop-shadow-[0_0_12px_rgba(129,140,248,0.8)]" />
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="pill-badge mb-3 text-indigo-300 border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Encrypted Real-Time Workspace
                  </motion.div>

                  <motion.h2
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="text-3xl lg:text-4xl font-heading font-extrabold tracking-tight text-white mb-2.5"
                  >
                    Welcome to{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
                      ChatWave
                    </span>
                  </motion.h2>

                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-white/50 text-[13.5px] leading-relaxed mb-7 max-w-sm"
                  >
                    High-performance edge messaging, authenticated peer calls, and expressive custom WhatsApp wallpapers.
                  </motion.p>

                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-wrap items-center justify-center gap-2 mb-8 perspective-800"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <motion.span
                      whileHover={{ scale: 1.08, rotateX: -8, rotateY: 6, z: 20, y: -3 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      style={{ transformStyle: "preserve-3d" }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/40 text-[11.5px] text-white/80 font-medium transition-colors shadow-sm select-none cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> End-to-End Encrypted
                    </motion.span>
                    <motion.span
                      whileHover={{ scale: 1.08, rotateX: -8, rotateY: 6, z: 20, y: -3 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      style={{ transformStyle: "preserve-3d" }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-indigo-500/40 text-[11.5px] text-white/80 font-medium transition-colors shadow-sm select-none cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-indigo-400" /> Sub-50ms Sync
                    </motion.span>
                    <motion.span
                      whileHover={{ scale: 1.08, rotateX: -8, rotateY: 6, z: 20, y: -3 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      style={{ transformStyle: "preserve-3d" }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-sky-500/40 text-[11.5px] text-white/80 font-medium transition-colors shadow-sm select-none cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" /> WhatsApp Themes
                    </motion.span>
                  </motion.div>

                  <motion.button
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.05, y: -3, rotateX: 6, z: 15 }}
                    whileTap={{ scale: 0.96, z: -5, y: 0 }}
                    style={{ transformStyle: "preserve-3d" }}
                    onClick={() => setShowNewDialog(true)}
                    className="glow-btn px-6 py-3 rounded-2xl font-heading font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-[0_10px_30px_rgba(99,102,241,0.45)] hover:shadow-[0_15px_40px_rgba(99,102,241,0.65)] transition-all"
                  >
                    <Plus className="w-4 h-4" /> Start New Conversation
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          setSelectedConversation(id);
          setShowNewDialog(false);
        }}
      />
    </div>
  );
};

export default Chat;
