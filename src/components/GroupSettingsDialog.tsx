import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  UserPlus,
  Crown,
  ShieldCheck,
  UserMinus,
  Pencil,
  Check,
  X,
  Trash2,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
}

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onDeleted?: () => void;
}

const GroupSettingsDialog = ({ open, onOpenChange, conversationId, onDeleted }: GroupSettingsDialogProps) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string>("member");
  const [groupName, setGroupName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [ownerId, setOwnerId] = useState("");

  const fetchData = async () => {
    // Get conversation
    const { data: conv } = await supabase
      .from("conversations")
      .select("name, owner_id")
      .eq("id", conversationId)
      .single();

    if (conv) {
      setGroupName(conv.name || "");
      setNewName(conv.name || "");
      setOwnerId(conv.owner_id);
    }

    // Get participants with profiles
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("id, user_id, role")
      .eq("conversation_id", conversationId);

    if (!parts) return;

    const enriched: Member[] = [];
    for (const p of parts) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", p.user_id)
        .single();
      enriched.push({ ...p, display_name: profile?.display_name || null });
      if (p.user_id === user?.id) setMyRole(p.role);
    }
    setMembers(enriched);
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open, conversationId]);

  const isOwnerOrCoOwner = myRole === "owner" || myRole === "co_owner";

  const handleSaveName = async () => {
    const { error } = await supabase
      .from("conversations")
      .update({ name: newName.trim() || null })
      .eq("id", conversationId);
    if (error) { toast.error("Failed to update name"); return; }
    setGroupName(newName.trim());
    setEditingName(false);
    toast.success("Group name updated");
  };

  const handlePromote = async (member: Member) => {
    const { error } = await supabase
      .from("conversation_participants")
      .update({ role: "co_owner" })
      .eq("id", member.id);
    if (error) { toast.error("Failed to promote"); return; }
    toast.success(`${member.display_name || "User"} is now a co-owner`);
    fetchData();
  };

  const handleDemote = async (member: Member) => {
    if (member.role === "owner") { toast.error("Cannot demote the owner"); return; }
    const { error } = await supabase
      .from("conversation_participants")
      .update({ role: "member" })
      .eq("id", member.id);
    if (error) { toast.error("Failed to demote"); return; }
    toast.success(`${member.display_name || "User"} is now a member`);
    fetchData();
  };

  const handleKick = async (member: Member) => {
    if (member.role === "owner") { toast.error("Cannot remove the owner"); return; }
    const { error } = await supabase
      .from("conversation_participants")
      .delete()
      .eq("id", member.id);
    if (error) { toast.error("Failed to remove member"); return; }
    toast.success(`${member.display_name || "User"} removed`);
    fetchData();
  };

  const handleDeleteGroup = async () => {
    if (myRole !== "owner") return;
    const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
    if (error) { toast.error("Failed to delete group"); return; }
    toast.success("Group deleted");
    onOpenChange(false);
    onDeleted?.();
  };

  const handleAddSearch = async (query: string) => {
    setAddSearch(query);
    if (query.length < 2) { setAddResults([]); return; }
    const memberIds = members.map((m) => m.user_id);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(10);

    setAddResults((data || []).filter((p) => !memberIds.includes(p.user_id) && p.user_id !== user?.id));
  };

  const handleAddMember = async (userId: string) => {
    const { error } = await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversationId, user_id: userId, role: "member" });
    if (error) { toast.error("Failed to add member"); return; }
    toast.success("Member added!");
    setShowAddMember(false);
    setAddSearch("");
    setAddResults([]);
    fetchData();
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    if (role === "owner") return <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary"><Crown className="w-2.5 h-2.5 mr-0.5" />Owner</Badge>;
    if (role === "co_owner") return <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><ShieldCheck className="w-2.5 h-2.5 mr-0.5" />Co-owner</Badge>;
    return null;
  };

  const handleLeaveGroup = async () => {
    try {
      const res = await fetch('/api/conversations/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: user?.id })
      });
      if (!res.ok) throw new Error();
      toast.success("Left group");
      onOpenChange(false);
      onDeleted?.();
    } catch(e) {
      toast.error("Failed to leave group");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Group Settings</DialogTitle>
        </DialogHeader>

        {/* Group Name */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Group Name</p>
          {editingName ? (
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group name..." className="h-9" />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-accent" onClick={handleSaveName}><Check className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setEditingName(false); setNewName(groupName); }}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium flex-1">{groupName || "Unnamed Group"}</p>
              {isOwnerOrCoOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingName(true)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Members */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Members ({members.length})</p>
            {isOwnerOrCoOwner && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowAddMember(!showAddMember)}>
                <UserPlus className="w-3.5 h-3.5" />
                Add
              </Button>
            )}
          </div>

          {showAddMember && (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search users..." value={addSearch} onChange={(e) => handleAddSearch(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
              {addResults.map((p) => (
                <Button key={p.user_id} variant="ghost" size="sm" className="w-full justify-start gap-2 h-9" onClick={() => handleAddMember(p.user_id)}>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{getInitials(p.display_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{p.display_name || "Unknown"}</span>
                  <UserPlus className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(m.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{m.display_name || "Unknown"}</p>
                    {m.user_id === user?.id && <span className="text-[10px] text-muted-foreground">(you)</span>}
                  </div>
                  {getRoleBadge(m.role)}
                </div>
                {isOwnerOrCoOwner && m.user_id !== user?.id && m.role !== "owner" && (
                  <div className="flex gap-1">
                    {m.role === "member" ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePromote(m)} title="Promote to co-owner">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDemote(m)} title="Demote to member">
                        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleKick(m)} title="Remove from group">
                      <UserMinus className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delete / Leave Group */}
        {myRole === "owner" ? (
          <>
            <Separator />
            <Button variant="destructive" className="w-full gap-2" onClick={handleDeleteGroup}>
              <Trash2 className="w-4 h-4" />
              Delete Group
            </Button>
          </>
        ) : (
          <>
            <Separator />
            <Button variant="destructive" className="w-full gap-2" onClick={handleLeaveGroup}>
              <LogOut className="w-4 h-4" />
              Leave Group
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GroupSettingsDialog;
