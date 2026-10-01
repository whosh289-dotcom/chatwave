import { useState } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatView from "@/components/ChatView";
import NewConversationDialog from "@/components/NewConversationDialog";
import { MessageCircle } from "lucide-react";

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar - hidden on mobile when conversation selected */}
      <div className={`w-full md:w-80 lg:w-96 shrink-0 ${selectedConversation ? "hidden md:block" : ""}`}>
        <ChatSidebar
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          onNewConversation={() => setShowNewDialog(true)}
        />
      </div>

      {/* Chat View */}
      <div className={`flex-1 ${!selectedConversation ? "hidden md:flex" : "flex"}`}>
        {selectedConversation ? (
          <div className="flex-1">
            <ChatView
              conversationId={selectedConversation}
              onBack={() => setSelectedConversation(null)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-heading mb-1">Welcome to Chatwave</h2>
              <p className="text-muted-foreground text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
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
