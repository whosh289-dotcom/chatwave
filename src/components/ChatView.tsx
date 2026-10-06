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
      <div
        className="flex items-center gap-3 p-4 border-b border-white/10 bg-transparent"
      >
        {onBack && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowGroupSettings(true)}>
          <Avatar className="h-10 w-10 shrink-0">
            {convMeta.logo_url ? (
              <AvatarImage src={convMeta.logo_url} alt={headerTitle} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {isGroup ? <Users className="w-5 h-5" /> : headerTitle[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <h2 className="font-bold font-heading truncate flex items-center gap-1.5">
              {headerTitle}
              {convMeta.is_private && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {isGroup ? `${memberCount} members` : "Private Message"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchInputRef.current?.focus(), 100); }}>
            <Search className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setShowGroupSettings(true)}>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-card/30 backdrop-blur-md animate-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            placeholder="Search in conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-transparent border-0 focus-visible:ring-0 text-sm"
          />
          <span className="text-xs text-muted-foreground shrink-0">
            {searchQuery ? `${filteredMessages.length} found` : ""}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-2">
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
                <div className="italic text-muted-foreground text-xs px-4 py-2 rounded-2xl bg-card/30 border border-white/5">
                  🚫 This message was deleted
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center justify-center my-4">
                  <div className="bg-card/60 backdrop-blur-md border border-white/10 text-muted-foreground text-[10px] font-medium px-3 py-1 rounded-full uppercase tracking-wider">
                    {formatDateSeparator(msg.created_at)}
                  </div>
                </div>
              )}
              <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} group`}>
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
                  {!isMe && showAvatar && isGroup && <span className="text-[10px] text-muted-foreground mb-1 ml-1">{senderName}</span>}

                  <div className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card/60 backdrop-blur-md border border-white/10 rounded-bl-sm text-foreground'
                  }`}>
                    {/* Reply preview */}
                    {msg.reply_to_id && (() => {
                      const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                      if (!repliedMsg) return null;
                      const repliedName = participantNames[repliedMsg.sender_id] || (repliedMsg.sender_id === user?.id ? "You" : "Unknown");
                      return (
                        <div className={`text-[11px] mb-1.5 pl-2 border-l-2 ${isMe ? 'border-primary-foreground/40 text-primary-foreground/70' : 'border-primary/40 text-muted-foreground'} truncate max-w-[200px]`}>
                          <span className="font-semibold">{repliedName}</span>
                          <p className="truncate">{repliedMsg.content || "GIF"}</p>
                        </div>
                      );
                    })()}

                    {msg.gif_url ? (
                      <div className="rounded-lg overflow-hidden mt-1 max-w-[200px]">
                        <img src={msg.gif_url.replace('[GIF] ', '')} alt="GIF" className="w-full h-auto" loading="lazy" />
                      </div>
                    ) : (
                      <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{renderMarkdown(msg.content)}</p>
                    )}

                    {/* Message actions (hover) */}
                    {!msg.id.startsWith("temp-") && (
                      <div className={`absolute ${isMe ? '-left-28' : '-right-28'} top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-card/80 backdrop-blur-sm rounded-full border border-white/10 p-0.5 shadow-lg`}>
                        <button onClick={() => setReplyTo(msg)} className="p-1.5 hover:bg-primary/10 rounded-full" title="Reply">
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setForwardMsg(msg)} className="p-1.5 hover:bg-primary/10 rounded-full" title="Forward">
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => copyMessage(msg)} className="p-1.5 hover:bg-primary/10 rounded-full" title="Copy">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {isMe && (
                          <>
                            <button onClick={() => {
                              setEditingMsg(msg);
                              setNewMessage(msg.content);
                              messageInputRef.current?.focus();
                            }} className="p-1.5 hover:bg-primary/10 rounded-full" title="Edit">
                              <FilePenLine className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm(msg)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-full" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Timestamp + status */}
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end text-primary-foreground/70' : 'justify-start text-muted-foreground'} text-[10px]`}>
                      <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                      {msg.edited && <span className="italic">edited</span>}
                      {isMe && !msg.id.startsWith("temp-") && (
                        new Date(msg.created_at).getTime() <= maxReadTime ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <Check className="w-3 h-3 opacity-70" />
                        )
                      )}
                      {msg.id.startsWith("temp-") && (
                        <span className="opacity-50">sending…</span>
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
          className="absolute bottom-24 right-6 bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-10 animate-in fade-in zoom-in-95"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {/* Reply / Edit banner */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-card/60 backdrop-blur-md border-t border-white/10 flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <div className="w-1 h-8 bg-primary rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">
              {editingMsg ? "Editing message" : `Replying to ${replyTo?.sender_id === user?.id ? "yourself" : (participantNames[replyTo?.sender_id || ""] || "Unknown")}`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {editingMsg?.content || replyTo?.content || "GIF"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => { setReplyTo(null); setEditingMsg(null); setNewMessage(""); }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

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

          <Popover open={gifPickerOpen} onOpenChange={setGifPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
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
            placeholder={editingMsg ? "Edit your message..." : "Type a message..."}
            className={`flex-1 rounded-2xl bg-black/20 dark:bg-black/40 text-white border-transparent backdrop-blur-md placeholder:text-white/50 focus-visible:bg-background focus-visible:border-primary/30 ${editingMsg ? 'ring-2 ring-primary/50' : ''}`}
          />

          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            size="icon"
            className={`h-10 w-10 rounded-full shrink-0 shadow-sm transition-all ${editingMsg ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4 ml-0.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
