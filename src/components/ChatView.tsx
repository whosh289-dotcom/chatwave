import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Lock, Settings, Smile, ImageIcon, Reply, Trash2, X, MoreVertical, Check, CheckCheck, Forward, Phone, Video, Bell } from "lucide-react";
import { format } from "date-fns";
import GroupSettingsDialog from "@/components/GroupSettingsDialog";
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GifPicker } from "@/components/GifPicker";
import { ForwardMessageDialog } from "@/components/ForwardMessageDialog";
import { useCall } from "@/components/CallProvider";
import { toast } from "sonner";

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to_id: string | null;
  gif_url: string | null;
  message_type: string;
  deleted_for_everyone: boolean;
}

interface ChatViewProps {
  conversationId: string;
  onBack?: () => void;
}

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];


const renderMarkdown = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|~.*?~)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~') && part.endsWith('~')) return <del key={i}>{part.slice(1, -1)}</del>;
    return <span key={i}>{part}</span>;
  });
};

const ChatView = ({ conversationId, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const { startCall } = useCall();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [convMeta, setConvMeta] = useState<{ is_private: boolean; owner_id: string; name: string | null }>({ is_private: false, owner_id: "", name: null });
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [otherReadTimes, setOtherReadTimes] = useState<Record<string, string>>({});
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const fetchMetadata = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/conversations?userId=${user.id}`);
      if (!res.ok) return;
      const { conversations } = await res.json();
      const meta = conversations.find((c: any) => c.id === conversationId);
      if (meta) {
        setConvMeta({ is_private: meta.is_private, owner_id: "", name: meta.name });
        const names: Record<string, string> = {};
        const readTimes: Record<string, string> = {};
        meta.otherUsers.forEach((u: any) => { 
          names[u.user_id] = u.display_name;
          readTimes[u.user_id] = u.last_read_at;
        });
        setParticipantNames(names);
        setOtherReadTimes(readTimes);
      }
    } catch (e) {
      console.error("Failed to fetch meta", e);
    }
  };

  const fetchMessages = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/messages/${conversationId}`);
      if (!res.ok) return;
      const { messages } = await res.json();
      setMessages(prev => {
        const tempMessages = prev.filter((m: any) => m.id.startsWith("temp-"));
        return [...messages, ...tempMessages];
      });
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  };

  useEffect(() => {
    fetchMetadata();
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages();
      fetchMetadata();
    }, 2000);
    return () => clearInterval(interval);
  }, [conversationId, user]);

  useEffect(() => {
    if (!user || messages.length === 0) return;
    fetch('/api/conversations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userId: user.id })
    }).catch(console.error);
  }, [conversationId, messages.length, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  const readTimes = Object.values(otherReadTimes).map(d => new Date(d || 0).getTime());
  const maxReadTime = readTimes.length > 0 ? Math.min(...readTimes) : 0;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    
    const content = newMessage.trim();
    setNewMessage(""); // Clear immediately for snappy feel
    setReplyTo(null);

    // Optimistic UI update
    const tempId = "temp-" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      content,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      reply_to_id: null,
      gif_url: null,
      message_type: "text",
      deleted_for_everyone: false
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          senderId: user.id,
          content,
          gifUrl: null
        })
      });
      if (res.ok) {
        setMessages(prev => prev.filter((m: any) => m.id !== tempId));
        fetchMessages(); // Pull real ID and timestamp from DB
      } else {
        // Revert on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const data = await res.json();
        toast.error(data.error || "Failed to send");
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Failed to send message");
    }
  };

  const sendGif = async (url: string) => {
    if (!user) return;
    
    // Optimistic UI update
    const tempId = "temp-gif-" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      content: "",
      sender_id: user.id,
      created_at: new Date().toISOString(),
      reply_to_id: null,
      gif_url: url,
      message_type: "gif",
      deleted_for_everyone: false
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setReplyTo(null);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          senderId: user.id,
          content: "Sent a GIF",
          gifUrl: url
        })
      });
      if (res.ok) {
        setMessages(prev => prev.filter((m: any) => m.id !== tempId));
        fetchMessages();
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast.error("Failed to send GIF");
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Failed to send GIF");
    }
  };

  const otherNames = Object.entries(participantNames).filter(([id]) => id !== user?.id).map(([, name]) => name);
  const headerTitle = convMeta.name || otherNames.join(", ") || "Unknown";
  const memberCount = Object.keys(participantNames).length;

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      
      <GroupSettingsDialog 
        open={showGroupSettings} 
        onOpenChange={setShowGroupSettings} 
        conversationId={conversationId} 
        onDeleted={() => onBack?.()} 
      />

      {/* Header */}
      <div 
        className="flex items-center gap-3 p-4 border-b border-white/10 bg-transparent cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setShowGroupSettings(true)}
      >
        {onBack && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            {headerTitle[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <h2 className="font-bold font-heading truncate flex items-center gap-1.5">
            {headerTitle}
            {convMeta.is_private && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {memberCount > 2 ? `${memberCount} members` : "Private Message"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const showAvatar = !isMe && (i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id);
          const senderName = participantNames[msg.sender_id] || "Unknown";
          
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} group`}>
              {!isMe && (
                <div className="w-8 shrink-0 flex items-end">
                  {showAvatar && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-secondary text-xs">{senderName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
              
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isMe && showAvatar && <span className="text-[10px] text-muted-foreground mb-1 ml-1">{senderName}</span>}
                
                <div className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card/60 backdrop-blur-md border border-white/10 rounded-bl-sm text-foreground'
                }`}>
                  {msg.gif_url ? (
                    <div className="rounded-lg overflow-hidden mt-1 max-w-[200px]">
                      <img src={msg.gif_url.replace('[GIF] ', '')} alt="GIF" className="w-full h-auto" />
                    </div>
                  ) : (
                    <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{renderMarkdown(msg.content)}</p>
                  )}
                  
                  {isMe && !msg.id.startsWith("temp-") && (
                    <button onClick={async () => {
                      await fetch(`/api/messages/${msg.id}`, { method: 'DELETE' });
                      fetchMessages();
                    }} className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-destructive hover:bg-destructive/10 rounded-full transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end text-primary-foreground/70' : 'justify-start text-muted-foreground'} text-[10px]`}>
                    <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                    {isMe && !msg.id.startsWith("temp-") && (
                      new Date(msg.created_at).getTime() <= maxReadTime ? (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Check className="w-3 h-3 opacity-70" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-transparent border-t border-white/10">
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <Smile className="w-5 h-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 border-none w-auto">
              <EmojiPicker theme={resolvedTheme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT} onEmojiClick={(e) => setNewMessage((m) => m + e.emoji)} width={320} height={400} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 w-auto">
              <GifPicker onPick={sendGif} />
            </PopoverContent>
          </Popover>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-2xl bg-black/20 dark:bg-black/40 text-white border-transparent backdrop-blur-md placeholder:text-white/50 focus-visible:bg-background focus-visible:border-primary/30"
          />
          
          <Button type="submit" disabled={!newMessage.trim() || sending} size="icon" className="h-10 w-10 rounded-full shrink-0 shadow-sm">
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
