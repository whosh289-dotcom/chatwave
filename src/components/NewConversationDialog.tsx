import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, MessageCircle, Lock, X } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (id: string) => void;
}

const NewConversationDialog = ({ open, onOpenChange, onConversationCreated }: NewConversationDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length < 2) { setResults([]); return; }

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const { users } = await res.json();
      
      const filtered = users.filter((u: Profile) => u.user_id !== user?.id);
      
      // Filter out already selected
      const selectedIds = new Set(selectedUsers.map((u) => u.user_id));
      setResults(filtered.filter((p: Profile) => !selectedIds.has(p.user_id)));
    } catch (e) {
      console.error(e);
      setResults([]);
    }
  };

  const addUser = (profile: Profile) => {
    setSelectedUsers((prev) => [...prev, profile]);
    setSearch("");
    setResults([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.user_id !== userId));
  };

  const createGroup = async () => {
    if (!user || selectedUsers.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPrivate,
          groupName,
          ownerId: user.id,
          selectedUserIds: selectedUsers.map(u => u.user_id)
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");

      if (isPrivate) {
        toast.success("Invites sent! They must accept before joining.");
      } else {
        toast.success("Group created!");
      }

      onConversationCreated(data.conversationId);
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error(error.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setSearch("");
    setResults([]);
    setIsPrivate(false);
    setGroupName("");
    setSelectedUsers([]);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">New Group</DialogTitle>
        </DialogHeader>

        {/* Group Name */}
        <Input
          placeholder="Group name (optional)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        {/* Privacy toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <div>
                <Label className="text-sm font-medium">Private</Label>
                <p className="text-xs text-muted-foreground">Invite-only, hidden from search</p>
              </div>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-1 bg-secondary text-secondary-foreground rounded-full pl-2 pr-1 py-1 text-xs font-medium">
                {u.display_name || "Unknown"}
                <button onClick={() => removeUser(u.user_id)} className="rounded-full p-0.5 hover:bg-muted">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users to add..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {results.length === 0 && search.length >= 2 && (
            <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
          )}
          {results.map((profile) => (
            <Button
              key={profile.user_id}
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5"
              onClick={() => addUser(profile)}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(profile.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="font-medium text-sm">{profile.display_name || "Unknown"}</p>
                {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
              </div>
              <MessageCircle className="w-4 h-4 ml-auto text-muted-foreground" />
            </Button>
          ))}
        </div>

        {/* Create Button */}
        <Button onClick={createGroup} disabled={loading || selectedUsers.length === 0} className="w-full">
          {loading ? "Creating..." : `Create Group${selectedUsers.length > 0 ? ` (${selectedUsers.length} member${selectedUsers.length > 1 ? "s" : ""})` : ""}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
