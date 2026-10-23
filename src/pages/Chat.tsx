import { useState } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { MessageSquare, ShieldCheck, Zap, Plus, Sparkles } from "lucide-react";

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="flex h-screen w-full bg-transparent md:p-3 lg:p-4">
      <div className="flex w-full h-full bento-glass overflow-hidden md:rounded-3xl">
        
        {/* Sidebar - responsive visibility */}
        <div className={`w-full md:w-[360px] lg:w-[380px] shrink-0 border-r border-white/[0.07] bg-[#0b0d14]/75 backdrop-blur-2xl ${selectedConversation ? "hidden md:block" : ""}`}>
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-hidden bg-gradient-to-b from-white/[0.015] to-transparent">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-indigo-500/[0.07] rounded-full blur-[120px] pointer-events-none"></div>

              <div className="relative z-10 max-w-md text-center flex flex-col items-center">
                {/* Formal Brand Emblem */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.12] flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10">
                  <MessageSquare className="w-7 h-7 text-indigo-400 stroke-[2]" />
                </div>

                <div className="pill-badge mb-3 text-indigo-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Encrypted Real-Time Workspace
                </div>

                <h2 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight text-white mb-2.5">
                  Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-white">ChatWave</span>
                </h2>

                <p className="text-white/50 text-[13.5px] leading-relaxed mb-8 max-w-sm">
                  A high-fidelity workspace for asynchronous and real-time team messaging, media sharing, and high-clarity voice.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11.5px] text-white/70 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> End-to-End Encrypted
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11.5px] text-white/70 font-medium">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" /> Low Latency
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11.5px] text-white/70 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Media &amp; Visuals
                  </span>
                </div>

                <button
                  onClick={() => setShowNewDialog(true)}
                  className="glow-btn px-5 py-2.5 rounded-xl font-heading font-medium text-xs flex items-center gap-2 cursor-pointer shadow-lg"
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
