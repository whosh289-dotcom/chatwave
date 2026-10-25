import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Send, ArrowLeft, FilePenLine, Lock, Settings, Smile, ImageIcon,
  Reply, Trash2, X, MoreVertical, Check, CheckCheck, Forward,
  Phone, Video, Bell, Search, ArrowDown, Copy, Pin, Users, Camera,
  ShieldAlert, UserX, Loader2, Info
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

const CopyCodeButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied with original formatting!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-md text-[10px] font-mono flex items-center gap-1 transition-all backdrop-blur-md border border-white/10 shadow-sm"
      title="Copy raw code with indentation"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
};

const renderMarkdown = (text: string) => {
  // If user wrapped in triple backticks
  if (text.includes('```')) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <div key={i} className="relative group/code my-2">
            <pre className="bg-black/50 rounded-xl p-3 text-xs font-mono overflow-x-auto whitespace-pre border border-white/10 text-emerald-300 shadow-inner">
              <code>{code}</code>
            </pre>
            <CopyCodeButton code={code} />
          </div>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{renderInlineMarkdown(part)}</span>;
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
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [chatBg, setChatBg] = useState(() => localStorage.getItem("chat-bg") || "doodle");

  useEffect(() => {
    const handleBgChange = () => {
      setChatBg(localStorage.getItem("chat-bg") || "doodle");
    };
    window.addEventListener("chat-bg-change", handleBgChange);
    window.addEventListener("storage", handleBgChange);
    return () => {
      window.removeEventListener("chat-bg-change", handleBgChange);
      window.removeEventListener("storage", handleBgChange);
    };
  }, []);

  const setChatBgWallpaper = (bg: string) => {
    setChatBg(bg);
    localStorage.setItem("chat-bg", bg);
    window.dispatchEvent(new Event("chat-bg-change"));
    toast.success(`Wallpaper updated`);
  };

  useEffect(() => {
    if (!conversationId) return;
    try {
      const stored = localStorage.getItem(`chatwave_reactions_${conversationId}`);
      if (stored) setReactions(JSON.parse(stored));
      else setReactions({});
    } catch {}
  }, [conversationId]);

  const toggleReaction = (messageId: string, emoji: string) => {
    if (!user) return;
    setReactions(prev => {
      const current = prev[messageId] || [];
      const existingIdx = current.findIndex(r => r.user_id === user.id && r.emoji === emoji);
      let updated: Reaction[];
      if (existingIdx >= 0) {
        updated = current.filter((_, idx) => idx !== existingIdx);
      } else {
        updated = [...current, { id: crypto.randomUUID(), emoji, user_id: user.id }];
      }
      const next = { ...prev, [messageId]: updated };
      try {
        localStorage.setItem(`chatwave_reactions_${conversationId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

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
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // Handle edit mode
    if (editingMsg) {
      try {
        const res = await fetch(`/api/messages/${editingMsg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage.replace(/^\n+|\n+$/g, '') })
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

    // Strip only leading and trailing empty newlines, preserving indentation and spaces
    let content = newMessage.replace(/^\n+|\n+$/g, '');

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
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
    }
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
    toast.success("Message copied with original indentation!");
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

  // Blocked status management for 1-on-1 chats
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const fetchBlockStatus = useCallback(async () => {
    if (isGroup || !user || !otherUser?.user_id) return;
    try {
      const res = await fetch(`/api/users/block-status?userId=${user.id}&otherUserId=${otherUser.user_id}`);
      if (res.ok) {
        const data = await res.json();
        setIsBlockedByMe(Boolean(data.isBlockedByMe));
        setIsBlockedByThem(Boolean(data.isBlockedByThem));
      }
    } catch (e) {
      console.error("Failed to fetch block status", e);
    }
  }, [isGroup, user, otherUser?.user_id]);

  useEffect(() => {
    fetchBlockStatus();
    const handleUnblock = () => fetchBlockStatus();
    const handleBlock = () => fetchBlockStatus();
    window.addEventListener("user-unblocked", handleUnblock);
    window.addEventListener("user-blocked", handleBlock);
    return () => {
      window.removeEventListener("user-unblocked", handleUnblock);
      window.removeEventListener("user-blocked", handleBlock);
    };
  }, [fetchBlockStatus]);

  const handleToggleBlock = async () => {
    if (!user || !otherUser) return;
    setBlockLoading(true);
    try {
      if (isBlockedByMe) {
        const res = await fetch("/api/users/unblock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockerId: user.id, blockedId: otherUser.user_id })
        });
        if (res.ok) {
          setIsBlockedByMe(false);
          toast.success(`Unblocked ${otherUser.display_name}`);
          window.dispatchEvent(new CustomEvent("user-unblocked", { detail: { userId: otherUser.user_id } }));
        } else {
          toast.error("Failed to unblock user");
        }
      } else {
        const res = await fetch("/api/users/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockerId: user.id, blockedId: otherUser.user_id })
        });
        if (res.ok) {
          setIsBlockedByMe(true);
          toast.success(`Blocked ${otherUser.display_name}`);
          window.dispatchEvent(new CustomEvent("user-blocked", { detail: { userId: otherUser.user_id } }));
        } else {
          toast.error("Failed to block user");
        }
      }
    } catch (e) {
      toast.error("Action failed");
    } finally {
      setBlockLoading(false);
    }
  };

  // Date separators
  const getDateKey = (dateStr: string) => format(new Date(dateStr), "yyyy-MM-dd");

  return (
    <div className="flex h-full w-full bg-transparent relative overflow-hidden">
      {/* Central Chat Stream */}
      <div className="flex flex-col flex-1 h-full min-w-0 relative overflow-hidden">

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
      <motion.div 
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-black/30 backdrop-blur-2xl"
      >
        {onBack && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden shrink-0 h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setShowGroupSettings(true)}>
          <div className="relative shrink-0">
            <Avatar className="h-9 w-9 rounded-lg border border-white/10 p-0.5 bg-gradient-to-tr from-indigo-500/25 to-purple-500/20">
              {convMeta.logo_url ? (
                <AvatarImage src={convMeta.logo_url} alt={headerTitle} className="object-cover rounded-[6px]" />
              ) : null}
              <AvatarFallback className="bg-transparent text-indigo-300 font-semibold font-heading text-xs">
                {isGroup ? <Users className="w-4 h-4" /> : headerTitle[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {isOtherUserOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] border-2 border-[#090a10]" />
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="font-semibold font-heading text-[13.5px] text-white truncate flex items-center gap-2">
              {headerTitle}
              {convMeta.is_private && <Lock className="w-3 h-3 text-white/40" />}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {isGroup ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/50 text-[10.5px] font-medium">
                  {memberCount} members
                </span>
              ) : isOtherUserOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10.5px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/40 text-[10.5px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isGroup && otherUser && (
            <>
              <motion.div whileHover={{ scale: 1.12, y: -1 }} whileTap={{ scale: 0.92 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-emerald-400 border border-white/[0.06] transition-all disabled:opacity-40"
                  onClick={() => startCall(conversationId, otherUser.user_id, participantNames[otherUser.user_id] || "User", "voice")}
                  title={isBlockedByMe || isBlockedByThem ? "Call unavailable (blocked)" : "Voice Call"}
                  disabled={isBlockedByMe || isBlockedByThem}
                >
                  <Phone className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.12, y: -1 }} whileTap={{ scale: 0.92 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-indigo-300 border border-white/[0.06] transition-all disabled:opacity-40"
                  onClick={() => startCall(conversationId, otherUser.user_id, participantNames[otherUser.user_id] || "User", "video")}
                  title={isBlockedByMe || isBlockedByThem ? "Call unavailable (blocked)" : "Video Call"}
                  disabled={isBlockedByMe || isBlockedByThem}
                >
                  <Video className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1, y: -1 }} whileTap={{ scale: 0.92 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-lg border transition-all ${
                    isBlockedByMe
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                      : "text-white/70 hover:text-rose-400 border-white/[0.06] hover:bg-white/[0.08]"
                  }`}
                  onClick={handleToggleBlock}
                  title={isBlockedByMe ? "Unblock contact" : "Block contact"}
                  disabled={blockLoading}
                >
                  {blockLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                </Button>
              </motion.div>
            </>
          )}
          <motion.div whileHover={{ scale: 1.1, y: -1 }} whileTap={{ scale: 0.92 }}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] transition-all" onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchInputRef.current?.focus(), 100); }} title="Search">
              <Search className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.1, y: -1 }} whileTap={{ scale: 0.92 }}>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] transition-all" title="Chat Wallpaper">
                  <ImageIcon className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0e111a]/95 border-white/10 text-white p-1.5 rounded-xl shadow-2xl w-48 backdrop-blur-2xl">
              <div className="px-2 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Chat Wallpaper</div>
              <DropdownMenuItem onClick={() => setChatBgWallpaper("doodle")} className="text-xs hover:bg-white/10 rounded-lg cursor-pointer flex items-center justify-between">
                <span>WhatsApp Doodle</span>
                {chatBg === "doodle" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChatBgWallpaper("dots")} className="text-xs hover:bg-white/10 rounded-lg cursor-pointer flex items-center justify-between">
                <span>Subtle Dots</span>
                {chatBg === "dots" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChatBgWallpaper("grid")} className="text-xs hover:bg-white/10 rounded-lg cursor-pointer flex items-center justify-between">
                <span>Modern Grid</span>
                {chatBg === "grid" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChatBgWallpaper("lines")} className="text-xs hover:bg-white/10 rounded-lg cursor-pointer flex items-center justify-between">
                <span>Diagonal Lines</span>
                {chatBg === "lines" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChatBgWallpaper("none")} className="text-xs hover:bg-white/10 rounded-lg cursor-pointer flex items-center justify-between">
                <span>Deep Solid</span>
                {chatBg === "none" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <motion.div whileHover={{ scale: 1.12, rotate: 45 }} whileTap={{ scale: 0.9 }}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] transition-all" onClick={() => setShowGroupSettings(true)} title="Conversation Settings">
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1, y: -1 }} whileTap={{ scale: 0.92 }}>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-8 w-8 rounded-lg border transition-all ${
                showDetailsDrawer 
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" 
                  : "hover:bg-white/[0.08] text-white/70 hover:text-white border-white/[0.06]"
              }`} 
              onClick={() => setShowDetailsDrawer(!showDetailsDrawer)} 
              title="Chat Details & Customizer"
            >
              <Info className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

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

      {/* Messages Stream Container with WhatsApp / Custom Doodle Wallpaper */}
      <div 
        ref={scrollAreaRef} 
        onScroll={handleScroll} 
        className={`flex-1 overflow-y-auto px-4 py-3 transition-colors duration-300 ${
          chatBg === "doodle" ? "chat-bg-doodle" :
          chatBg === "dots" ? "chat-bg-dots" :
          chatBg === "grid" ? "chat-bg-grid" :
          chatBg === "lines" ? "chat-bg-lines" : "chat-bg-none"
        }`}
      >
        <div className="max-w-4xl mx-auto w-full space-y-3">
          {/* Framer-inspired Encrypted Header Pill */}
          <div className="flex items-center justify-center my-2 select-none">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/50 border border-white/[0.08] backdrop-blur-md text-[10.5px] font-mono text-amber-300/80 shadow-sm select-none">
              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Messages & calls are end-to-end encrypted</span>
            </div>
          </div>

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
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 6 }} 
                animate={{ opacity: 1, y: 0 }} 
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className="italic text-white/40 text-xs px-3.5 py-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] font-mono">
                  🚫 Message deleted
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.8 }}
            >
              {showDateSep && (
                <div className="flex items-center justify-center my-4 select-none">
                  <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] text-white/60 text-[10px] font-mono font-medium px-3.5 py-1 rounded-full uppercase tracking-widest shadow-[0_2px_12px_rgba(0,0,0,0.3)] select-none">
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

                  <motion.div 
                    whileHover={{ 
                      scale: 1.02,
                      rotateY: isMe ? -4 : 4,
                      rotateX: 2,
                      y: -2,
                      boxShadow: isMe 
                        ? "0 20px 35px -8px rgba(79, 70, 229, 0.45), 0 0 20px rgba(129, 140, 248, 0.3)" 
                        : "0 20px 35px -8px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 255, 255, 0.08)"
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    style={{ transformPerspective: 800, transformOrigin: isMe ? "right center" : "left center" }}
                    className={`relative min-w-[76px] transition-all ${
                      isMe 
                        ? 'chat-bubble-sent' 
                        : 'chat-bubble-received'
                    }`}
                  >
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

                    {/* Floating Reaction Bar (Quick Emojis) */}
                    {!msg.id.startsWith("temp-") && (
                      <motion.div 
                        initial={{ opacity: 0, y: 8, scale: 0.85, rotateX: -25 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                        style={{ transformPerspective: 600 }}
                        className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0d0f18]/95 backdrop-blur-2xl border border-white/15 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 pointer-events-none group-hover:pointer-events-auto select-none`}
                      >
                        {QUICK_REACTIONS.map((emoji) => (
                          <motion.button
                            key={emoji}
                            whileHover={{ scale: 1.55, rotateY: 20, rotateX: -15, y: -4 }}
                            whileTap={{ scale: 0.85 }}
                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            style={{ transformPerspective: 400 }}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="text-xs p-0.5 hover:bg-white/15 rounded-full transition-colors cursor-pointer"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}

                    {msg.gif_url ? (
                      <div className="space-y-1">
                        <div className="rounded-xl overflow-hidden mt-0.5 max-w-[240px] border border-white/10 shadow-lg">
                          <img src={msg.gif_url.replace('[GIF] ', '')} alt="GIF" className="w-full h-auto" loading="lazy" />
                        </div>
                        <div className={`flex items-center gap-1.5 justify-end text-[10px] font-mono select-none ${isMe ? 'text-white/75' : 'text-white/45'}`}>
                          <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                          {msg.edited && <span className="italic text-[9px] text-white/50">edited</span>}
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
                    ) : (
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5">
                        <div className="text-[13.5px] leading-snug break-words whitespace-pre-wrap flex-1 min-w-[20px]">
                          {renderMarkdown(msg.content)}
                        </div>
                        <div className={`inline-flex items-center gap-1 shrink-0 text-[10px] font-mono select-none self-end pb-0.5 ml-auto ${isMe ? 'text-white/75' : 'text-white/45'}`}>
                          <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                          {msg.edited && <span className="italic text-[9px] text-white/50">edited</span>}
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
                    )}

                    {/* Rendered Reaction Pills */}
                    {(reactions[msg.id] || []).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(
                          (reactions[msg.id] || []).reduce((acc, r) => {
                            if (r && r.emoji) {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            }
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([emoji, count]) => {
                          const hasMine = (reactions[msg.id] || []).some(r => r && r.user_id === user?.id && r.emoji === emoji);
                          return (
                            <motion.button
                              key={emoji}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              whileHover={{ scale: 1.2, rotateX: -8, rotateY: 8, y: -2 }}
                              whileTap={{ scale: 0.9 }}
                              transition={{ type: "spring", stiffness: 450, damping: 25 }}
                              style={{ transformPerspective: 500 }}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border transition-all select-none ${
                                hasMine 
                                  ? "bg-indigo-500/25 border-indigo-400/50 text-indigo-200 shadow-sm" 
                                  : "bg-black/50 border-white/10 text-white/80 hover:bg-white/10"
                              }`}
                            >
                              <span>{emoji}</span>
                              {count > 1 && <span className="text-[9.5px] font-bold">{count}</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Message actions (hover) */}
                    {!msg.id.startsWith("temp-") && (
                      <div 
                        className={`absolute ${isMe ? '-left-28' : '-right-28'} top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-[#0c0d14]/90 backdrop-blur-2xl rounded-full border border-white/10 p-0.5 shadow-2xl z-10 select-none`}
                      >
                        <motion.button whileHover={{ scale: 1.25, rotateY: 15, rotateX: -10, y: -1 }} whileTap={{ scale: 0.85 }} style={{ transformPerspective: 400 }} onClick={() => setReplyTo(msg)} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Reply">
                          <Reply className="w-3.5 h-3.5" />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.25, rotateY: 15, rotateX: -10, y: -1 }} whileTap={{ scale: 0.85 }} style={{ transformPerspective: 400 }} onClick={() => setForwardMsg(msg)} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Forward">
                          <Forward className="w-3.5 h-3.5" />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.25, rotateY: 15, rotateX: -10, y: -1 }} whileTap={{ scale: 0.85 }} style={{ transformPerspective: 400 }} onClick={() => copyMessage(msg)} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Copy">
                          <Copy className="w-3.5 h-3.5" />
                        </motion.button>
                        {isMe && (
                          <>
                            <motion.button whileHover={{ scale: 1.25, rotateY: 15, rotateX: -10, y: -1 }} whileTap={{ scale: 0.85 }} style={{ transformPerspective: 400 }} onClick={() => {
                              setEditingMsg(msg);
                              setNewMessage(msg.content);
                              messageInputRef.current?.focus();
                            }} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-full transition-colors" title="Edit">
                              <FilePenLine className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.25, rotateY: 15, rotateX: -10, y: -1 }} whileTap={{ scale: 0.85 }} style={{ transformPerspective: 400 }} onClick={() => setDeleteConfirm(msg)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-full transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          );
        })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollDown && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
          exit={{ opacity: 0, scale: 0.8, y: 8 }}
          transition={{ y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" } }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 bg-indigo-600 text-white rounded-2xl w-10 h-10 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.6)] border border-indigo-400/40 z-10 cursor-pointer"
        >
          <ArrowDown className="w-5 h-5" />
        </motion.button>
      )}

      {/* Reply / Edit banner */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-[#0c0d14]/80 backdrop-blur-2xl border-t border-white/[0.08] animate-in slide-in-from-bottom-2">
          <div className="max-w-4xl mx-auto w-full flex items-center gap-3">
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
        </div>
      )}

      {/* Input Dock or Blocked Notice */}
      {isBlockedByMe ? (
        <div className="p-4 bg-rose-500/10 border-t border-rose-500/20 backdrop-blur-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-xs font-semibold text-rose-200">
              You have blocked this contact. Unblock to resume messaging and calls.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-rose-400/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-semibold rounded-lg shrink-0"
            onClick={handleToggleBlock}
            disabled={blockLoading}
          >
            {blockLoading && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
            Unblock Contact
          </Button>
        </div>
      ) : isBlockedByThem ? (
        <div className="p-4 bg-amber-500/10 border-t border-amber-500/20 backdrop-blur-2xl flex items-center justify-center gap-2 text-center">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-amber-200">
            You cannot send messages or call this contact because communication has been restricted.
          </span>
        </div>
      ) : (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 28, delay: 0.05 }}
          className="p-3 bg-black/35 border-t border-white/[0.08] backdrop-blur-2xl"
        >
          <div className="max-w-4xl mx-auto w-full">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <Popover>
                <PopoverTrigger asChild>
                  <motion.div 
                    whileHover={{ scale: 1.15, rotateZ: 15, rotateY: 20 }} 
                    whileTap={{ scale: 0.9 }}
                    style={{ transformPerspective: 500 }}
                  >
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/55 hover:text-white shrink-0 border border-white/[0.05] transition-all">
                      <Smile className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="p-0 border-none w-auto bg-transparent shadow-2xl">
                  <EmojiPicker theme={EmojiTheme.DARK} onEmojiClick={(e) => setNewMessage((m) => m + e.emoji)} width={320} height={400} />
                </PopoverContent>
              </Popover>

              <Popover open={gifPickerOpen} onOpenChange={setGifPickerOpen}>
                <PopoverTrigger asChild>
                  <motion.div 
                    whileHover={{ scale: 1.15, rotateX: -15, rotateY: -10, y: -2 }} 
                    whileTap={{ scale: 0.9 }}
                    style={{ transformPerspective: 500 }}
                  >
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.08] text-white/55 hover:text-white shrink-0 border border-white/[0.05] transition-all">
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="p-0 border-none bg-transparent shadow-none w-auto">
                  <GifPicker onPick={(url) => { sendGif(url); setGifPickerOpen(false); }} />
                </PopoverContent>
              </Popover>

              <Textarea
                ref={messageInputRef}
                rows={1}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  // auto resize
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (newMessage.trim() && !sending) {
                      handleSend();
                      if (messageInputRef.current) {
                        messageInputRef.current.style.height = 'auto';
                      }
                    }
                  }
                }}
                placeholder={editingMsg ? "Edit your message..." : "Type a message (Shift+Enter for newline)..."}
                className={`flex-1 min-h-[38px] max-h-[160px] py-2 px-3 rounded-xl bg-black/45 text-white text-[13px] border border-white/[0.08] backdrop-blur-md placeholder:text-white/35 focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 resize-none font-sans ${editingMsg ? 'ring-2 ring-indigo-500/50' : ''}`}
              />

              <motion.div 
                whileHover={{ scale: 1.1, rotateY: 15, rotateZ: -5 }} 
                whileTap={{ scale: 0.92 }}
                style={{ transformPerspective: 500 }}
                animate={newMessage.trim() ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  size="icon"
                  className={`h-9 w-9 rounded-xl shrink-0 transition-all ${
                    editingMsg 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
                      : newMessage.trim()
                        ? 'glow-btn shadow-[0_0_20px_rgba(99,102,241,0.6)]'
                        : 'glow-btn opacity-60'
                  }`}
                >
                  {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-3.5 h-3.5 ml-0.5" />}
                </Button>
              </motion.div>
            </form>
          </div>
        </motion.div>
      )}
      </div>

      {/* Right Details Drawer from Framer project with Figma Smart Animate */}
      <AnimatePresence>
        {showDetailsDrawer && (
          <motion.div
            initial={{ width: 0, opacity: 0, rotateY: 12, x: 20 }}
            animate={{ width: 280, opacity: 1, rotateY: 0, x: 0 }}
            exit={{ width: 0, opacity: 0, rotateY: 12, x: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ transformPerspective: 800, transformOrigin: "right center" }}
            className="hidden md:flex flex-col border-l border-white/[0.08] bg-[#0a0c14]/95 backdrop-blur-2xl p-5 overflow-y-auto shrink-0 z-20"
          >
            {/* Header close button */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 font-mono">Chat Info</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50 hover:text-white rounded-lg" onClick={() => setShowDetailsDrawer(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Profile Avatar Large */}
            <div className="flex flex-col items-center text-center mt-5 mb-5">
              <motion.div 
                whileHover={{ scale: 1.08, rotateY: 14, rotateX: -8 }} 
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                style={{ transformPerspective: 600 }}
              >
                <Avatar className="h-20 w-20 rounded-2xl border-2 border-white/10 p-0.5 bg-gradient-to-tr from-indigo-500/30 to-purple-500/25 shadow-xl">
                  {convMeta.logo_url ? (
                    <AvatarImage src={convMeta.logo_url} alt={headerTitle} className="object-cover rounded-[14px]" />
                  ) : null}
                  <AvatarFallback className="bg-transparent text-indigo-300 font-bold font-heading text-2xl">
                    {isGroup ? <Users className="w-8 h-8" /> : headerTitle[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              <h3 className="font-heading font-bold text-base text-white mt-3 leading-tight">{headerTitle}</h3>
              <p className="text-xs text-white/40 font-mono mt-0.5">
                {otherUser ? `@${otherUser.username || "user"}` : `${memberCount} members`}
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-medium mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{isGroup ? "Encrypted Group" : isOtherUserOnline ? "Online • Active now" : "Offline"}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {!isGroup && otherUser && (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => startCall(conversationId, otherUser.user_id, participantNames[otherUser.user_id] || "User", "voice")}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-white/80 hover:text-white"
                  >
                    <Phone className="w-4 h-4 text-emerald-400 mb-1" />
                    <span className="text-[11px] font-medium">Audio</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => startCall(conversationId, otherUser.user_id, participantNames[otherUser.user_id] || "User", "video")}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-white/80 hover:text-white"
                  >
                    <Video className="w-4 h-4 text-indigo-400 mb-1" />
                    <span className="text-[11px] font-medium">Video</span>
                  </motion.button>
                </>
              )}
            </div>

            {/* Theme Swatches matching Framer canvas */}
            <div className="mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono block mb-2.5">
                Pick Chat Wallpaper
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "doodle", label: "Doodle", color: "bg-[#005c4b]" },
                  { id: "dots", label: "Dots", color: "bg-indigo-600" },
                  { id: "grid", label: "Grid", color: "bg-cyan-600" },
                  { id: "lines", label: "Lines", color: "bg-purple-600" },
                  { id: "none", label: "OLED", color: "bg-zinc-900" },
                ].map((swatch) => (
                  <motion.button
                    key={swatch.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setChatBgWallpaper(swatch.id as any)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all ${
                      chatBg === swatch.id
                        ? "bg-white/[0.1] border-indigo-400/60 text-white font-medium shadow-sm"
                        : "bg-white/[0.02] border-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${swatch.color} shrink-0`} />
                    <span className="text-[11px] truncate">{swatch.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Encryption Card from Framer canvas */}
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 mb-6">
              <div className="flex items-center gap-2 text-emerald-300 font-mono text-[10px] uppercase font-bold tracking-wider mb-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Private & Encrypted</span>
              </div>
              <p className="text-[11.5px] text-white/70 leading-relaxed">
                Messages and calls are end-to-end encrypted with zero server logs.
              </p>
            </div>

            {/* Block / Safety Action */}
            {!isGroup && otherUser && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-auto pt-4 border-t border-white/[0.06]">
                <Button
                  variant="outline"
                  className={`w-full text-xs font-semibold rounded-xl border transition-all ${
                    isBlockedByMe 
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30" 
                      : "bg-white/[0.03] text-rose-400 border-white/[0.08] hover:bg-rose-500/10 hover:border-rose-500/30"
                  }`}
                  onClick={handleToggleBlock}
                  disabled={blockLoading}
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-2" />
                  {isBlockedByMe ? "Unblock Contact" : `Block ${headerTitle}`}
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatView;
