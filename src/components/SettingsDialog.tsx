import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Paintbrush, Image as ImageIcon, MonitorSmartphone, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BACKGROUNDS = [
  { id: "dots", name: "Dots (Default)", class: "chat-bg-dots" },
  { id: "grid", name: "Modern Grid", class: "chat-bg-grid" },
  { id: "lines", name: "Diagonal Lines", class: "chat-bg-lines" },
  { id: "none", name: "Solid Color", class: "chat-bg-none" }
];

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
    const [activeBg, setActiveBg] = useState(() => localStorage.getItem("chat-bg") || "dots");
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);

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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingOut(null);
    }
  };

  useEffect(() => {
    localStorage.setItem("chat-bg", activeBg);
    // Dispatch a custom event so ChatView can listen for real-time updates
    window.dispatchEvent(new Event("chat-bg-change"));
  }, [activeBg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-primary" />
            Customization & Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
              Theme Mode
            </Label>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <span className="text-sm text-muted-foreground font-medium">Toggle Light/Dark Mode</span>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-primary" /> Active Devices
            </Label>
            {sessionsLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{s.device_info}</span>
                      <span className="text-[10px] text-muted-foreground">Active: {new Date(s.last_active).toLocaleString()}</span>
                    </div>
                    {s.id === user?.token ? (
                      <span className="text-[10px] uppercase font-bold text-primary px-2 py-1 rounded bg-primary/10">This Device</span>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleLogoutSession(s.id)}
                        disabled={loggingOut === s.id}
                      >
                        {loggingOut === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1" />}
                        Log out
                      </Button>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && !sessionsLoading && (
                  <p className="text-xs text-muted-foreground italic text-center p-2">To use Device Management, you must re-login to generate a secure session token.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Chat Background
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {BACKGROUNDS.map((bg) => (
                <Button
                  key={bg.id}
                  variant="outline"
                  className={`h-auto py-3 px-4 flex flex-col items-center gap-2 border-2 transition-all ${
                    activeBg === bg.id 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-border hover:border-primary/40 hover:bg-muted"
                  }`}
                  onClick={() => setActiveBg(bg.id)}
                >
                  <div className={`w-full h-12 rounded-md bg-background relative overflow-hidden border border-border/50`}>
                    <div className={`absolute inset-0 ${bg.class} opacity-[0.2]`}></div>
                  </div>
                  <span className="text-xs font-semibold">{bg.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
