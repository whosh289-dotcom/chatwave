import { useState } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { MessageSquare, ShieldCheck, Zap, Plus, Sparkles } from "lucide-react";

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="flex h-screen w-full bg-transparent md:p-4 lg:p-6">
      <div className="flex w-full h-full bento-glass overflow-hidden md:rounded-[2.2rem] md:border md:border-white/[0.08] shadow-[0_30px_90px_rgba(0,0,0,0.85)]">
        
        {/* Sidebar - responsive visibility */}
        <div className={`w-full md:w-[380px] lg:w-[410px] shrink-0 border-r border-white/[0.07] bg-[#0c0e16]/60 backdrop-blur-xl ${selectedConversation ? "hidden md:block" : ""}`}>
          <ChatSidebar
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onNewConversation={() => setShowNewDialog(true)}
          />
        </div>

        {/* Main Conversation Stream */}
        <div className={`flex-1 bg-transparent ${!selectedConversation ? "hidden md:flex" : "flex"}`}>
          {selectedConversation ? (
            <div className="flex-1 h-full overflow-hidden">
              <ChatView
                conversationId={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            </div>
          ) : (
            /* Base44 Editorial Empty State Showcase */
            <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-hidden bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 max-w-md text-center flex flex-col items-center">
                {/* Emblem Icon */}
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-indigo-500/10 to-transparent border border-indigo-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10">
                  <MessageSquare className="w-9 h-9 text-indigo-400 stroke-[2.2]" />
                </div>

                <div className="pill-badge mb-3 text-indigo-400 border-indigo-500/25 bg-indigo-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                  Connected &bull; D1 Cloud Network
                </div>

                <h2 className="text-3xl lg:text-4xl font-heading font-black tracking-tight text-white mb-3">
                  Welcome to <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-400">ChatWave</span>
                </h2>

                <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">
                  Experience frictionless real-time messaging with live typing, reactions, sticker boards, and media sync.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs font-mono text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> End-to-End Encrypted
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs font-mono text-slate-300">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" /> Sub-50ms Sync
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs font-mono text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" /> GIF &amp; Sticker Hub
                  </span>
                </div>

                <button
                  onClick={() => setShowNewDialog(true)}
                  className="glow-btn px-6 py-3.5 rounded-2xl font-heading font-bold text-xs uppercase flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Start New Conversation
                </button>
              </div>
            </div>
          )}
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
