import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [participantReads, setParticipantReads] = useState<Record<string, string>>({});
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef<number>(0);

  const markRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }, [conversationId, user]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      const { data: convData } = await supabase
        .from("conversations")
        .select("is_private, owner_id, name")
        .eq("id", conversationId)
        .single();
      if (convData && mounted) setConvMeta(convData);

      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id, last_read_at")
        .eq("conversation_id", conversationId);

      if (participants && mounted) {
        const names: Record<string, string> = {};
        const reads: Record<string, string> = {};
        for (const p of participants) {
          reads[p.user_id] = p.last_read_at;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", p.user_id)
            .single();
          names[p.user_id] = profile?.display_name || "Unknown";
        }
        if (mounted) {
          setParticipantNames(names);
          setParticipantReads(reads);
        }
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (msgs && mounted) setMessages(msgs as Message[]);

      const { data: rxs } = await supabase
        .from("message_reactions")
        .select("id, emoji, user_id, message_id")
        .eq("conversation_id", conversationId);
      if (rxs && mounted) {
        const grouped: Record<string, Reaction[]> = {};
        for (const r of rxs) {
          (grouped[r.message_id] ||= []).push({ id: r.id, emoji: r.emoji, user_id: r.user_id });
        }
        setReactions(grouped);
      }

      markRead();
    };

    fetchData();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          markRead();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => prev.map((m) => m.id === (payload.new as Message).id ? payload.new as Message : m)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const r = payload.new as any;
          setReactions((prev) => ({ ...prev, [r.message_id]: [...(prev[r.message_id] || []), { id: r.id, emoji: r.emoji, user_id: r.user_id }] }));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const r = payload.old as any;
          setReactions((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
              next[k] = next[k].filter((x) => x.id !== r.id);
            }
            return next;
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const p = payload.new as any;
          setParticipantReads((prev) => ({ ...prev, [p.user_id]: p.last_read_at }));
        })
      .subscribe();

    // Typing presence channel
    const typingChannel = supabase.channel(`typing-${conversationId}`, { config: { broadcast: { self: false } } });
    typingChannel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const uid = payload.user_id as string;
        if (uid === user?.id) return;
        setTypingUsers((prev) => ({ ...prev, [uid]: Date.now() }));
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    const typingPurge = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) if (now - v < 3000) next[k] = v;
        return next;
      });
    }, 1000);

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      clearInterval(typingPurge);
    };
  }, [conversationId, user, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const jumpToMessage = (id: string) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((c) => (c === id ? null : c)), 1600);
  };

  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { user_id: user?.id } });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    const content = newMessage.trim();
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      reply_to_id: replyTo?.id ?? null,
      message_type: "text",
    });
    if (!error) {
      setNewMessage("");
      setReplyTo(null);
    } else {
      toast.error(error.message);
    }
    setSending(false);
  };

  const sendGif = async (url: string) => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: "",
      gif_url: url,
      message_type: "gif",
      reply_to_id: replyTo?.id ?? null,
    });
    if (error) toast.error(error.message);
    else setReplyTo(null);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = (reactions[messageId] || []).find((r) => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId, conversation_id: conversationId, user_id: user.id, emoji,
      });
    }
  };

  const deleteForEveryone = async (msg: Message) => {
    const ageMin = (Date.now() - new Date(msg.created_at).getTime()) / 60000;
    if (ageMin > 60) {
      toast.error("Can only delete within 1 hour");
      return;
    }
    await supabase.from("messages").update({ deleted_for_everyone: true, content: "" }).eq("id", msg.id);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const otherNames = Object.entries(participantNames).filter(([id]) => id !== user?.id).map(([, name]) => name);
  const headerTitle = convMeta.name || otherNames.join(", ") || "Unknown";
  const memberCount = Object.keys(participantNames).length;
  const otherUserId = Object.keys(participantNames).find((id) => id !== user?.id);
  const isOneOnOne = memberCount === 2 && otherUserId;

  const sendPing = async () => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: "📞 Ping! I want to chat — come reply when you're free.",
      message_type: "ping",
    });
    if (error) toast.error(error.message);
    else toast.success("Ping sent");
  };

  const handleCall = (type: "audio" | "video") => {
    if (!isOneOnOne || !otherUserId) {
      toast.error("Calls are available in 1-on-1 chats only");
      return;
    }
    startCall(conversationId, otherUserId, participantNames[otherUserId] || "Friend", type);
  };

  const typingNames = Object.keys(typingUsers).map((id) => participantNames[id]).filter(Boolean);

  // For 1:1 chats: my last sent message has been seen if the other's last_read_at > message created_at
  const lastMineId = [...messages].reverse().find((m) => m.sender_id === user?.id)?.id;

  const [bgClass, setBgClass] = useState(() => {
    const saved = localStorage.getItem("chat-bg") || "dots";
    return `chat-bg-${saved}`;
  });

  useEffect(() => {
    const handleBgChange = () => {
      const saved = localStorage.getItem("chat-bg") || "dots";
      setBgClass(`chat-bg-${saved}`);
    };
    window.addEventListener("chat-bg-change", handleBgChange);
    return () => window.removeEventListener("chat-bg-change", handleBgChange);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Background Pattern Layer */}
      <div className={`absolute inset-0 ${bgClass} opacity-[0.03] pointer-events-none`}></div>

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 md:hidden">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {getInitials(convMeta.name || otherNames[0] || null)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate">{headerTitle}</p>
            {convMeta.is_private && <Lock className="w-3 h-3 text-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {typingNames.length > 0
              ? `${typingNames.join(", ")} typing…`
              : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-0.5">
          {isOneOnOne && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCall("audio")} title="Voice call">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCall("video")} title="Video call">
                <Video className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={sendPing} title="Ping friend to chat">
            <Bell className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowGroupSettings(true)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const replyTarget = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
          const msgReactions = reactions[msg.id] || [];
          const groupedRx: Record<string, string[]> = {};
          for (const r of msgReactions) (groupedRx[r.emoji] ||= []).push(r.user_id);
          const isLastMine = isMine && msg.id === lastMineId;
          const seenByOthers = isLastMine && Object.entries(participantReads).some(([uid, ts]) => uid !== user?.id && new Date(ts) >= new Date(msg.created_at));

          return (
            <div key={msg.id} className={`group flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="flex items-center gap-1 max-w-[80%]">
                {isMine && (
                  <MessageActions msg={msg} isMine onReply={() => setReplyTo(msg)} onDelete={() => deleteForEveryone(msg)} onReact={(e) => toggleReaction(msg.id, e)} onForward={() => setForwardMsg(msg)} />
                )}
                <div
                  ref={(el) => { msgRefs.current[msg.id] = el; }}
                  onDoubleClick={() => !msg.deleted_for_everyone && setReplyTo(msg)}
                  className={`${isMine ? "chat-bubble-sent" : "chat-bubble-received"} relative cursor-pointer transition-shadow ${highlightId === msg.id ? "ring-2 ring-primary" : ""}`}
                >
                  {!isMine && memberCount > 2 && (
                    <p className="text-[10px] font-medium text-primary mb-0.5">{participantNames[msg.sender_id] || "Unknown"}</p>
                  )}
                  {replyTarget && (
                    <div
                      onClick={(e) => { e.stopPropagation(); jumpToMessage(replyTarget.id); }}
                      className={`text-[11px] mb-1.5 pl-2 border-l-2 rounded-sm py-0.5 px-1.5 cursor-pointer hover:opacity-90 ${isMine ? "bg-primary-foreground/10 border-primary-foreground/40" : "bg-background/60 border-primary/60"}`}
                    >
                      <p className="font-medium opacity-80">{participantNames[replyTarget.sender_id] || "Unknown"}</p>
                      <p className="opacity-70 truncate">{replyTarget.deleted_for_everyone ? "Deleted message" : replyTarget.gif_url ? "GIF" : replyTarget.content}</p>
                    </div>
                  )}
                  {msg.deleted_for_everyone ? (
                    <p className="text-sm italic opacity-60">🚫 This message was deleted</p>
                  ) : msg.message_type === "ping" ? (
                    <div className={`flex items-center gap-2 -mx-1 px-2 py-1 rounded-md ${isMine ? "bg-primary-foreground/10" : "bg-accent/10 border border-accent/30"}`}>
                      <Bell className={`w-4 h-4 ${isMine ? "" : "text-accent"}`} />
                      <p className="text-sm font-medium">{msg.content}</p>
                    </div>
                  ) : msg.gif_url ? (
                    <img src={msg.gif_url} alt="GIF" className="rounded-lg max-w-[260px]" />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  <div className={`flex items-center gap-1 text-[10px] mt-1 ${isMine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"}`}>
                    <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                    {isLastMine && (seenByOthers ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                  </div>
                  {Object.keys(groupedRx).length > 0 && (
                    <div className={`absolute -bottom-3 ${isMine ? "right-2" : "left-2"} flex gap-0.5`}>
                      {Object.entries(groupedRx).map(([emoji, uids]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`text-xs bg-card border border-border rounded-full px-1.5 py-0.5 shadow-sm hover:scale-110 transition ${uids.includes(user?.id ?? "") ? "ring-1 ring-primary" : ""}`}
                        >
                          {emoji} {uids.length}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!isMine && (
                  <MessageActions msg={msg} onReply={() => setReplyTo(msg)} onReact={(e) => toggleReaction(msg.id, e)} onForward={() => setForwardMsg(msg)} />
                )}
              </div>
            </div>
          );
        })}
        {typingNames.length > 0 && (
          <div className="flex gap-1 items-center text-xs text-muted-foreground px-2">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            {typingNames.join(", ")} typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/40 flex items-center gap-2">
          <div className="w-1 h-8 bg-primary rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-primary">Replying to {participantNames[replyTo.sender_id]}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.gif_url ? "GIF" : replyTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyTo(null)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border bg-card">
        <div className="flex gap-1.5 items-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 border-none w-auto">
              <EmojiPicker
                theme={resolvedTheme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                onEmojiClick={(e) => setNewMessage((m) => m + e.emoji)}
                width={320}
                height={400}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ImageIcon className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 w-auto">
              <GifPicker onPick={sendGif} />
            </PopoverContent>
          </Popover>
          <Input
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); sendTyping(); }}
            placeholder="Type a message..."
            className="h-11 flex-1"
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!newMessage.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>

      <GroupSettingsDialog
        open={showGroupSettings}
        onOpenChange={setShowGroupSettings}
        conversationId={conversationId}
        onDeleted={onBack}
      />

      {forwardMsg && (
        <ForwardMessageDialog
          open={!!forwardMsg}
          onOpenChange={(o) => !o && setForwardMsg(null)}
          messageContent={forwardMsg.content}
          gifUrl={forwardMsg.gif_url}
          excludeConversationId={conversationId}
        />
      )}
    </div>
  );
};

function MessageActions({ msg, isMine, onReply, onDelete, onReact, onForward }: {
  msg: Message; isMine?: boolean; onReply: () => void; onDelete?: () => void; onReact: (e: string) => void; onForward: () => void;
}) {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
            <Smile className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-1 w-auto" align="center">
          <div className="flex gap-0.5">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => onReact(e)} className="hover:bg-muted rounded p-1 text-base">
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onReply}>
        <Reply className="w-3.5 h-3.5" />
      </Button>
      <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
          <DropdownMenuItem onClick={onForward}>
            <Forward className="w-3.5 h-3.5 mr-2" /> Forward
          </DropdownMenuItem>
          {isMine && onDelete && !msg.deleted_for_everyone && (
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete for everyone
            </DropdownMenuItem>
          )}
          </DropdownMenuContent>
        </DropdownMenu>
    </div>
  );
}

export default ChatView;
