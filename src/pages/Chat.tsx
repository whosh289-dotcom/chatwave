import { useState } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { MessageCircle } from "lucide-react";

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="flex h-screen bg-transparent md:p-6 lg:p-8">
      <div className="flex w-full h-full bg-background/10 backdrop-blur-[40px] overflow-hidden md:rounded-[2rem] md:border md:border-white/20 md:shadow-2xl shadow-black/20">
        {/* Sidebar - hidden on mobile when conversation selected */}
        <div className={`w-full md:w-[380px] shrink-0 border-r border-border ${selectedConversation ? "hidden md:block" : ""}`}>
          <ChatSidebar
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onNewConversation={() => setShowNewDialog(true)}
          />
        </div>

        {/* Chat View */}
        <div className={`flex-1 bg-transparent ${!selectedConversation ? "hidden md:flex" : "flex"}`}>
          {selectedConversation ? (
            <div className="flex-1">
              <ChatView
                conversationId={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-black/10 dark:bg-black/30 backdrop-blur-3xl rounded-3xl m-4 border border-white/10 shadow-2xl">
              <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-inner">
                <MessageCircle className="w-10 h-10 text-primary stroke-[2.5]" />
              </div>
              <h2 className="text-2xl font-bold font-heading mb-2 tracking-tight text-foreground">Welcome to ChatApp</h2>
              <p className="text-muted-foreground text-[15px] font-medium max-w-sm text-center">
                Select a conversation from the sidebar or start a new one to begin messaging.
              </p>
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
