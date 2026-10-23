import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Paintbrush, Image as ImageIcon, MonitorSmartphone, LogOut, Loader2, ShieldAlert, Check, UserX, Moon, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCENT_THEMES = [
  { id: "indigo", name: "Linear Indigo", color: "#6366f1", desc: "Default modern classic" },
  { id: "emerald", name: "WhatsApp Emerald", color: "#10b981", desc: "Authentic WhatsApp green" },
  { id: "telegram", name: "Telegram Azure", color: "#0ea5e9", desc: "Electric cyan & sky blue" },
  { id: "rose", name: "Cyber Rose", color: "#f43f5e", desc: "Vibrant neon pink" },
  { id: "solar", name: "Solar Sunset", color: "#f59e0b", desc: "Warm amber & gold" },
  { id: "oled", name: "Midnight OLED", color: "#000000", border: "#334155", desc: "Pure AMOLED pitch black" },
];

const BACKGROUNDS = [
  { id: "doodle", name: "WhatsApp Doodle (Default)", class: "chat-bg-doodle" },
  { id: "dots", name: "Subtle Dots", class: "chat-bg-dots" },
  { id: "grid", name: "Modern Grid", class: "chat-bg-grid" },
  { id: "lines", name: "Diagonal Lines", class: "chat-bg-lines" },
  { id: "none", name: "Deep Solid", class: "chat-bg-none" }
];

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState("appearance");
  const [activeBg, setActiveBg] = useState(() => localStorage.getItem("chat-bg") || "doodle");
  const [activeAccent, setActiveAccent] = useState(() => localStorage.getItem("chat-accent") || "indigo");

  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);

  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.token) {
      setSessionsLoading(true);
      fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.sessions) setSessions(data.sessions);
      })
      .finally(() => setSessionsLoading(false));
    }
  }, [open, user]);

  // Fetch blocked users when dialog opens
  useEffect(() => {
    if (open && user?.id) {
      setBlockedLoading(true);
      fetch(`/api/users/blocked?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.blockedUsers) setBlockedUsers(data.blockedUsers);
        })
        .catch(err => console.error("Failed to fetch blocked users:", err))
        .finally(() => setBlockedLoading(false));
    }
  }, [open, user?.id]);

  const handleUnblockUser = async (blockedId: string, name: string) => {
    if (!user) return;
    setUnblockingId(blockedId);
    try {
      const res = await fetch("/api/users/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerId: user.id, blockedId })
      });
      if (res.ok) {
        setBlockedUsers(prev => prev.filter(u => u.blocked_id !== blockedId));
        toast.success(`Unblocked ${name || "user"}`);
        window.dispatchEvent(new CustomEvent("user-unblocked", { detail: { userId: blockedId } }));
      } else {
        toast.error("Failed to unblock user");
      }
    } catch (e) {
      toast.error("Error unblocking user");
    } finally {
      setUnblockingId(null);
    }
  };

  const handleSelectAccent = (themeId: string) => {
    setActiveAccent(themeId);
    localStorage.setItem("chat-accent", themeId);
    document.documentElement.setAttribute("data-accent", themeId);
    window.dispatchEvent(new Event("chat-accent-change"));
    toast.success(`Applied ${themeId.charAt(0).toUpperCase() + themeId.slice(1)} theme`);
  };

  const handleLogoutSession = async (sessionId: string) => {
    if (!user?.token) return;
    setLoggingOut(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        toast.success("Session signed out");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to sign out session");
    } finally {
      setLoggingOut(null);
    }
  };

  useEffect(() => {
    localStorage.setItem("chat-bg", activeBg);
    window.dispatchEvent(new Event("chat-bg-change"));
  }, [activeBg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-[#0d1017]/95 border-white/10 backdrop-blur-2xl p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-white/[0.08]">
          <DialogTitle className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-primary" />
            Preferences & Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-3 bg-white/[0.04] p-1 border border-white/[0.08] rounded-xl">
            <TabsTrigger value="appearance" className="text-xs font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Blocked ({blockedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="devices" className="text-xs font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all">
              <MonitorSmartphone className="w-3.5 h-3.5 mr-1.5" /> Devices
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Appearance & Themes */}
          <TabsContent value="appearance" className="space-y-6 pt-4">
            {/* Color Accent Themes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Color Theme Palette
                </Label>
                <span className="text-[11px] text-white/40">Applies across UI & bubbles</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ACCENT_THEMES.map((theme) => {
                  const isSelected = activeAccent === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectAccent(theme.id)}
                      className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-white/[0.08] border-primary shadow-[0_0_15px_rgba(99,102,241,0.25)] ring-1 ring-primary"
                          : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <div
                          className="w-5 h-5 rounded-full shadow-inner flex items-center justify-center border border-white/20"
                          style={{ backgroundColor: theme.color }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white drop-shadow" />}
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Active</span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white tracking-tight">{theme.name}</span>
                      <span className="text-[10.5px] text-white/50 leading-tight mt-0.5">{theme.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode: Dark / Light */}
            <div className="space-y-3 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-white/70 block">
                    Display Mode
                  </Label>
                  <p className="text-[11px] text-white/40">Switch between dark glass and high-contrast system</p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            {/* Chat Wallpaper Backgrounds */}
            <div className="space-y-3 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" /> Chat Wallpaper
                </Label>
                <span className="text-[11px] text-white/40">Instant live background preview</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {BACKGROUNDS.map((bg) => {
                  const isSelected = activeBg === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      className={`py-2.5 px-3 flex flex-col items-center gap-2 rounded-xl border transition-all text-center ${
                        isSelected 
                          ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(99,102,241,0.2)] ring-1 ring-primary" 
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                      onClick={() => setActiveBg(bg.id)}
                    >
                      <div className="w-full h-11 rounded-lg bg-[#07080d] relative overflow-hidden border border-white/10">
                        <div className={`absolute inset-0 ${bg.class} opacity-40`}></div>
                      </div>
                      <span className="text-xs font-medium text-white/90">{bg.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Privacy & Blocked Users */}
          <TabsContent value="privacy" className="space-y-4 pt-4">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5 text-rose-400" /> Blocked Contacts
              </h4>
              <p className="text-[11.5px] text-white/50 mt-1 leading-relaxed">
                Blocked contacts cannot send you direct messages, call you via audio/video, or see your live typing status.
              </p>
            </div>

            {blockedLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-2xl">
                <ShieldAlert className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white/80">No Blocked Contacts</p>
                <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">
                  When you block someone from a chat or the sidebar, they will be listed here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {blockedUsers.map((u) => (
                  <div
                    key={u.id || u.blocked_id}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-white/10">
                        <AvatarImage src={u.avatar_url || ""} />
                        <AvatarFallback className="bg-rose-500/20 text-rose-300 font-bold text-xs">
                          {u.display_name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">{u.display_name}</span>
                        <span className="text-[10px] text-white/40">
                          Blocked on {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 text-white/80 rounded-lg transition-all"
                      disabled={unblockingId === u.blocked_id}
                      onClick={() => handleUnblockUser(u.blocked_id, u.display_name)}
                    >
                      {unblockingId === u.blocked_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Unblock"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Active Devices & Sessions */}
          <TabsContent value="devices" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-white/70 block">
                  Active Devices & Sessions
                </Label>
                <p className="text-[11px] text-white/40">Review and revoke logged-in sessions on your account</p>
              </div>
            </div>

            {sessionsLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">{s.device_info}</span>
                      <span className="text-[10px] text-white/40">
                        Last active: {new Date(s.last_active).toLocaleString()}
                      </span>
                    </div>
                    {s.id === user?.token ? (
                      <span className="text-[10px] uppercase font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        Current
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg"
                        onClick={() => handleLogoutSession(s.id)}
                        disabled={loggingOut === s.id}
                      >
                        {loggingOut === s.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <LogOut className="w-3 h-3 mr-1" /> Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && !sessionsLoading && (
                  <p className="text-xs text-white/40 italic text-center p-4">
                    Re-login to enable active device management.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
