import { useEffect, useState, useRef } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
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
  Camera,
  Users,
  Copy,
  Link,
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    // Get conversation
    const { data: conv } = await supabase
      .from("conversations")
      .select("name, owner_id, logo_url")
      .eq("id", conversationId)
      .single();

    if (conv) {
      setGroupName(conv.name || "");
      setNewName(conv.name || "");
      setOwnerId(conv.owner_id);
      setLogoUrl(conv.logo_url || null);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    try {
      // Convert to base64 data URL for simple storage
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        const { error } = await supabase
          .from("conversations")
          .update({ logo_url: dataUrl })
          .eq("id", conversationId);

        if (error) {
          toast.error("Failed to update logo");
          return;
        }

        setLogoUrl(dataUrl);
        toast.success("Group logo updated!");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to upload logo");
    }
  };

  const handleRemoveLogo = async () => {
    const { error } = await supabase
      .from("conversations")
      .update({ logo_url: null })
      .eq("id", conversationId);
    if (error) { toast.error("Failed to remove logo"); return; }
    setLogoUrl(null);
    toast.success("Logo removed");
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
    setShowDeleteConfirm(false);
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

  const handleLeaveGroup = async () => {
    try {
      const res = await fetch('/api/conversations/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: user?.id })
      });
      if (!res.ok) throw new Error();
      toast.success("Left group");
      setShowLeaveConfirm(false);
      onOpenChange(false);
      onDeleted?.();
    } catch(e) {
      toast.error("Failed to leave group");
    }
  };

  const copyGroupId = () => {
    navigator.clipboard.writeText(conversationId);
    toast.success("Group ID copied");
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Group Settings</DialogTitle>
          </DialogHeader>

          {/* Group Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                {logoUrl ? (
                  <AvatarImage src={logoUrl} alt={groupName} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  <Users className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              {isOwnerOrCoOwner && (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            {isOwnerOrCoOwner && logoUrl && (
              <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={handleRemoveLogo}>
                Remove Logo
              </Button>
            )}
          </div>

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

          {/* Group ID */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
            <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <code className="text-[10px] text-muted-foreground flex-1 truncate font-mono">{conversationId}</code>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyGroupId}>
              <Copy className="w-3 h-3" />
            </Button>
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
          <Separator />
          <div className="space-y-2">
            {myRole === "owner" ? (
              <Button variant="destructive" className="w-full gap-2" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                Delete Group
              </Button>
            ) : (
              <Button variant="destructive" className="w-full gap-2" onClick={() => setShowLeaveConfirm(true)}>
                <LogOut className="w-4 h-4" />
                Leave Group
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{groupName || "this group"}</strong>? All messages and members will be removed permanently. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Group Confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <strong>{groupName || "this group"}</strong>? You'll need to be re-added to join again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLeaveGroup}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GroupSettingsDialog;
