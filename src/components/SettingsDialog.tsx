import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Paintbrush, Image as ImageIcon } from "lucide-react";
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

  useEffect(() => {
    localStorage.setItem("chat-bg", activeBg);
    // Dispatch a custom event so ChatView can listen for real-time updates
    window.dispatchEvent(new Event("chat-bg-change"));
  }, [activeBg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

          <div className="space-y-4">
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
