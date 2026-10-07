import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Send, ArrowLeft, FilePenLine, Lock, Settings, Smile, ImageIcon,
  Reply, Trash2, X, MoreVertical, Check, CheckCheck, Forward,
  Phone, Video, Bell, Search, ArrowDown, Copy, Pin, Users, Camera
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import GroupSettingsDialog from "@/components/GroupSettingsDialog";
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { GifPicker } from "@/components/GifPicker";
import { ForwardMessageDialog } from "@/components/ForwardMessageDialog";
import { useCall } from "@/components/CallProvider";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

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
  updated_at?: string;
  reply_to_id: string | null;
  gif_url: string | null;
  message_type: string;
  deleted_for_everyone: boolean;
  edited?: boolean;
}

interface ChatViewProps {
  conversationId: string;
  onBack?: () => void;
}

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

const renderMarkdown = (text: string) => {
  // Handle code blocks
  if (text.includes('```')) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return <pre key={i} className="bg-black/20 rounded-lg p-2 my-1 text-xs font-mono overflow-x-auto">{code}</pre>;
      }
      return <span key={i}>{renderInlineMarkdown(part)}</span>;
    });
  }
  return renderInlineMarkdown(text);
};

const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|~.*?~|`.*?`|https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~') && part.endsWith('~')) return <del key={i}>{part.slice(1, -1)}</del>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
    if (part.match(/^https?:\/\/\S+$/)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-blue-300 hover:text-blue-200 break-all">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
};

const formatDateSeparator = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d, yyyy");
};

const ChatView = ({ conversationId, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const { startCall } = useCall();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [convMeta, setConvMeta] = useState<{ is_private: boolean; owner_id: string; name: string | null; logo_url: string | null }>({ is_private: false, owner_id: "", name: null, logo_url: null });
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [otherReadTimes, setOtherReadTimes] = useState<Record<string, string>>({});
  const [otherUsersList, setOtherUsersList] = useState<{ user_id: string; display_name: string; last_seen_at?: string | null; last_read_at?: string }[]>([]);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const fetchMetadata = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/conversations?userId=${user.id}`);
      if (!res.ok) return;
      const { conversations } = await res.json();
      const meta = conversations.find((c: any) => c.id === conversationId);
      if (meta) {
        setConvMeta({ is_private: meta.is_private, owner_id: "", name: meta.name, logo_url: meta.logo_url || null });
        setOtherUsersList(meta.otherUsers || []);
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
    if (!showScrollDown) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Scroll detection for FAB
  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 200);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  };

  const readTimes = Object.values(otherReadTimes).map(d => new Date(d || 0).getTime());
  const maxReadTime = readTimes.length > 0 ? Math.min(...readTimes) : 0;

  // ── Send message ──
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // Handle edit mode
    if (editingMsg) {
      try {
        const res = await fetch(`/api/messages/${editingMsg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage.trim() })
        });
        if (res.ok) {
          toast.success("Message edited");
          setEditingMsg(null);
          setNewMessage("");
          fetchMessages();
        } else {
          toast.error("Failed to edit message");
        }
      } catch {
        toast.error("Failed to edit message");
      }
      return;
    }

    let content = newMessage.trim();

    // Slash commands
    if (content === "/party") {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    if (content.startsWith("/boost")) {
      if (content !== "/boost 10000") {
        toast.error("must be exact /boost 10000");
        return;
      }
      content = `🚀 Boosted by 10000!`;
    }

    setNewMessage("");
    setReplyTo(null);

    // Optimistic UI
    const tempId = "temp-" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      content,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      reply_to_id: replyTo?.id || null,
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
          gifUrl: null,
          replyToId: replyTo?.id || null
        })
      });
      if (res.ok) {
        setMessages(prev => prev.filter((m: any) => m.id !== tempId));
        fetchMessages();
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const data = await res.json();
        toast.error(data.error || "Failed to send");
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Failed to send message");
    }
  };

  // ── Send GIF ──
  const sendGif = async (url: string) => {
    if (!user) return;
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

  // ── Delete message ──
  const handleDeleteMessage = async (msg: Message) => {
    try {
      const res = await fetch(`/api/messages/${msg.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msg.id));
        toast.success("Message deleted");
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
    setDeleteConfirm(null);
  };

  // ── Copy message ──
  const copyMessage = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    toast.success("Copied to clipboard");
  };

  // ── Search filter ──
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const displayMessages = showSearch ? filteredMessages : messages;

  const otherNames = Object.entries(participantNames).filter(([id]) => id !== user?.id).map(([, name]) => name);
  const headerTitle = convMeta.name || otherNames.join(", ") || "Unknown";
  const memberCount = Object.keys(participantNames).length + 1; // +1 for self
  const isGroup = memberCount > 2;

  // Real-time presence detection for 1-on-1 chats
  const otherUser = otherUsersList[0];
  const isOtherUserOnline = useMemo(() => {
    if (isGroup || !otherUser?.last_seen_at) return false;
    const dateStr = otherUser.last_seen_at;
    const iso = dateStr.includes('T') ? (dateStr.endsWith('Z') ? dateStr : dateStr + 'Z') : dateStr.replace(' ', 'T') + 'Z';
    const lastSeenMs = new Date(iso).getTime();
    if (isNaN(lastSeenMs)) return false;
    // Considered active if seen within the last 25 seconds
    const diffMs = Math.abs(Date.now() - lastSeenMs);
    return diffMs < 25000;
  }, [isGroup, otherUser?.last_seen_at]);

  // Date separators
  const getDateKey = (dateStr: string) => format(new Date(dateStr), "yyyy-MM-dd");

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">

      <GroupSettingsDialog
        open={showGroupSettings}
        onOpenChange={setShowGroupSettings}
        conversationId={conversationId}
        onDeleted={() => onBack?.()}
      />

      {forwardMsg && (
        <ForwardMessageDialog
          open={!!forwardMsg}
          onOpenChange={(open) => !open && setForwardMsg(null)}
          messageContent={forwardMsg.content}
          gifUrl={forwardMsg.gif_url}
          excludeConversationId={conversationId}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDeleteMessage(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center gap-3.5 p-4 border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-2xl">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden shrink-0 h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setShowGroupSettings(true)}>
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10 rounded-xl border border-white/10 p-0.5 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
              {convMeta.logo_url ? (
                <AvatarImage src={convMeta.logo_url} alt={headerTitle} className="object-cover rounded-[10px]" />
              ) : null}
              <AvatarFallback className="bg-transparent text-indigo-300 font-bold font-mono text-xs">
                {isGroup ? <Users className="w-5 h-5" /> : headerTitle[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {isOtherUserOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] border-2 border-[#090a10]" />
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="font-bold font-heading text-sm text-white truncate flex items-center gap-2">
              {headerTitle}
              {convMeta.is_private && <Lock className="w-3.5 h-3.5 text-white/40" />}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {isGroup ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/50 text-[10px] font-mono font-medium">
                  {memberCount} members
                </span>
              ) : isOtherUserOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/40 text-[10px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isGroup && otherUser && (
            <>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/70 hover:text-emerald-400 border border-white/[0.06] transition-all" onClick={() => startCall(conversationId, otherUser.user_id, participantNames[otherUser.user_id] || "User", "voice")}>
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/70 hover:text-indigo-400 border border-white/[0.06] transition-all" onClick={() => startCall(conversationId, otherUser.user_id, participantNames[otherUser.user_id] || "User", "video")}>
                <Video className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] transition-all" onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchInputRef.current?.focus(), 100); }}>
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] transition-all" onClick={() => setShowGroupSettings(true)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.08] bg-[#0c0d14]/90 backdrop-blur-xl animate-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-white/40 shrink-0" />
          <Input
            ref={searchInputRef}
            placeholder="Search in conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-transparent border-0 focus-visible:ring-0 text-xs text-white placeholder:text-white/40"
          />
          <span className="text-[11px] font-mono text-white/40 shrink-0">
            {searchQuery ? `${filteredMessages.length} found` : ""}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-white/40 hover:text-white shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayMessages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const showAvatar = !isMe && (i === displayMessages.length - 1 || displayMessages[i + 1]?.sender_id !== msg.sender_id);
          const senderName = participantNames[msg.sender_id] || (isMe ? (user?.username || "You") : "Unknown");

          // Date separator
          const prevMsg = i > 0 ? displayMessages[i - 1] : null;
          const showDateSep = !prevMsg || getDateKey(msg.created_at) !== getDateKey(prevMsg.created_at);

          // Deleted message
          if (msg.deleted_for_everyone) {
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="italic text-white/40 text-xs px-3.5 py-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] font-mono">
                  🚫 Message deleted
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center justify-center my-4">
                  <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] text-white/60 text-[10px] font-mono font-medium px-3.5 py-1 rounded-full uppercase tracking-widest shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
                    {formatDateSeparator(msg.created_at)}
                  </div>
                </div>
              )}
              <div className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''} group`}>
                {!isMe && (
                  <div className="w-8 shrink-0 flex items-end">
                    {showAvatar && (
                      <Avatar className="w-8 h-8 rounded-xl border border-white/10 p-0.5 bg-gradient-to-tr from-white/[0.05] to-white/[0.1]">
                        <AvatarFallback className="bg-transparent text-indigo-300 text-[11px] font-bold font-mono">
                          {senderName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  {!isMe && showAvatar && isGroup && <span className="text-[10px] font-mono text-white/50 mb-1 ml-1">{senderName}</span>}

                  <div className={`relative px-4 py-2.5 transition-all ${
                    isMe 
                      ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-700 text-white border border-indigo-400/25 shadow-[0_4px_24px_rgba(99,102,241,0.25)] rounded-2xl rounded-br-sm' 
                      : 'bg-white/[0.04] hover:bg-white/[0.06] text-white/90 border border-white/[0.08] backdrop-blur-xl rounded-2xl rounded-bl-sm shadow-[0_4px_16px_rgba(0,0,0,0.25)]'
                  }`}>
                    {/* Reply preview */}
                    {msg.reply_to_id && (() => {
                      const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                      if (!repliedMsg) return null;
                      const repliedName = participantNames[repliedMsg.sender_id] || (repliedMsg.sender_id === user?.id ? "You" : "Unknown");
                      return (
                        <div className={`text-[11px] mb-1.5 pl-2.5 border-l-2 rounded-sm ${isMe ? 'border-white/40 text-white/80' : 'border-indigo-400/60 text-white/60'} truncate max-w-[220px]`}>
                          <span className="font-semibold text-white/90">{repliedName}</span>
                          <p className="truncate text-[10px]">{repliedMsg.content || "GIF"}</p>
                        </div>
                      );
                    })()}

                    {msg.gif_url ? (
                      <div className="rounded-xl overflow-hidden mt-1 max-w-[240px] border border-white/10 shadow-lg">
                        <img src={msg.gif_url.replace('[GIF] ', '')} alt="GIF" className="w-full h-auto" loading="lazy" />
                      </div>
                    ) : (
                      <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
                    )}

                    {/* Message actions (hover) */}
                    {!msg.id.startsWith("temp-") && (
                      <div className={`absolute ${isMe ? '-left-28' : '-right-28'} top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-[#0c0d14]/90 backdrop-blur-2xl rounded-full border border-white/10 p-0.5 shadow-2xl z-10`}>
                        <button onClick={() => setReplyTo(msg)} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Reply">
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setForwardMsg(msg)} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Forward">
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => copyMessage(msg)} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Copy">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {isMe && (
                          <>
                            <button onClick={() => {
                              setEditingMsg(msg);
                              setNewMessage(msg.content);
                              messageInputRef.current?.focus();
                            }} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Edit">
                              <FilePenLine className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm(msg)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-full transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Timestamp + status */}
                    <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end text-white/70' : 'justify-start text-white/40'} text-[10px] font-mono`}>
                      <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                      {msg.edited && <span className="italic text-white/50">edited</span>}
                      {isMe && !msg.id.startsWith("temp-") && (
                        new Date(msg.created_at).getTime() <= maxReadTime ? (
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-300 drop-shadow-[0_0_6px_rgba(103,232,249,0.8)]" />
                        ) : (
                          <Check className="w-3 h-3 opacity-60" />
                        )
                      )}
                      {msg.id.startsWith("temp-") && (
                        <span className="opacity-40 font-mono">sending…</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 bg-indigo-600 text-white rounded-2xl w-10 h-10 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-400/30 hover:scale-105 transition-transform z-10 animate-in fade-in zoom-in-95"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {/* Reply / Edit banner */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-[#0c0d14]/80 backdrop-blur-2xl border-t border-white/[0.08] flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <div className="w-1 h-8 bg-indigo-500 rounded-full shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-400 font-mono">
              {editingMsg ? "Editing message" : `Replying to ${replyTo?.sender_id === user?.id ? "yourself" : (participantNames[replyTo?.sender_id || ""] || "Unknown")}`}
            </p>
            <p className="text-xs text-white/60 truncate font-mono">
              {editingMsg?.content || replyTo?.content || "GIF"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-white/40 hover:text-white shrink-0"
            onClick={() => { setReplyTo(null); setEditingMsg(null); setNewMessage(""); }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Input Dock */}
      <div className="p-3.5 bg-white/[0.02] border-t border-white/[0.08] backdrop-blur-2xl">
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/[0.08] text-white/60 hover:text-white shrink-0 border border-white/[0.06] transition-all">
                <Smile className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 border-none w-auto bg-transparent shadow-2xl">
              <EmojiPicker theme={EmojiTheme.DARK} onEmojiClick={(e) => setNewMessage((m) => m + e.emoji)} width={320} height={400} />
            </PopoverContent>
          </Popover>

          <Popover open={gifPickerOpen} onOpenChange={setGifPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/[0.08] text-white/60 hover:text-white shrink-0 border border-white/[0.06] transition-all">
                <ImageIcon className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 border-none bg-transparent shadow-none w-auto">
              <GifPicker onPick={(url) => { sendGif(url); setGifPickerOpen(false); }} />
            </PopoverContent>
          </Popover>

          <Input
            ref={messageInputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={editingMsg ? "Edit your message..." : "Type a message or paste a link..."}
            className={`flex-1 h-10 rounded-xl bg-black/40 text-white text-xs border border-white/[0.08] backdrop-blur-md placeholder:text-white/40 focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 ${editingMsg ? 'ring-2 ring-indigo-500/50' : ''}`}
          />

          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            size="icon"
            className={`h-10 w-10 rounded-xl shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all ${
              editingMsg 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white'
            }`}
          >
            {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4 ml-0.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
