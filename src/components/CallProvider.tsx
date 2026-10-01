import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

type CallType = "audio" | "video";
type CallStatus = "idle" | "ringing-outgoing" | "ringing-incoming" | "active" | "ended";

interface ActiveCall {
  id: string;
  conversationId: string;
  peerId: string;
  peerName: string;
  type: CallType;
  status: CallStatus;
  isInitiator: boolean;
}

interface CallCtx {
  startCall: (conversationId: string, calleeId: string, calleeName: string, type: CallType) => Promise<void>;
}

const Ctx = createContext<CallCtx | null>(null);

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useCall() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCall must be inside CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const signalChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (signalChRef.current) {
      supabase.removeChannel(signalChRef.current);
      signalChRef.current = null;
    }
    pendingCandidates.current = [];
    setMuted(false);
    setCameraOff(false);
  }, []);

  const endCall = useCallback(async (status: "ended" | "missed" | "declined" = "ended") => {
    if (!call) return;
    await supabase.from("calls").update({
      status,
      ended_at: new Date().toISOString(),
    }).eq("id", call.id);
    cleanup();
    setCall(null);
  }, [call, cleanup]);

  // Attach streams to video els when refs / streams change
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  });

  const setupPeerConnection = useCallback((callId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && signalChRef.current) {
        signalChRef.current.send({
          type: "broadcast",
          event: "ice",
          payload: { from: user?.id, candidate: event.candidate.toJSON() },
        });
      }
    };

    return pc;
  }, [user]);

  const getLocalMedia = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video" ? { width: 1280, height: 720 } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`incoming-calls-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as any;
          if (call) return; // already in a call
          // Look up caller name
          const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", row.caller_id).single();
          setCall({
            id: row.id,
            conversationId: row.conversation_id,
            peerId: row.caller_id,
            peerName: profile?.display_name || "Caller",
            type: row.call_type,
            status: "ringing-incoming",
            isInitiator: false,
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const row = payload.new as any;
          setCall((cur) => {
            if (!cur || cur.id !== row.id) return cur;
            if (row.status === "ended" || row.status === "declined" || row.status === "missed") {
              cleanup();
              return null;
            }
            return cur;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, call, cleanup]);

  // Setup signaling channel when in a call
  useEffect(() => {
    if (!call || !user) return;
    if (call.status !== "active") return;
    if (signalChRef.current) return;

    const ch = supabase.channel(`call-${call.id}`, { config: { broadcast: { self: false } } });
    signalChRef.current = ch;

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      for (const c of pendingCandidates.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingCandidates.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ch.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      for (const c of pendingCandidates.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingCandidates.current = [];
    });

    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) {
        pendingCandidates.current.push(payload.candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
    });

    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      if (call.isInitiator) {
        // initiator creates offer once subscribed
        const pc = pcRef.current;
        if (!pc) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ch.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
      }
    });

    return () => {
      // do not remove channel here; cleanup() handles it on end
    };
  }, [call, user]);

  const startCall = useCallback(async (conversationId: string, calleeId: string, calleeName: string, type: CallType) => {
    if (!user) return;
    if (call) { toast.error("Already in a call"); return; }
    try {
      const { data, error } = await supabase.from("calls").insert({
        conversation_id: conversationId,
        caller_id: user.id,
        callee_id: calleeId,
        call_type: type,
        status: "ringing",
      }).select().single();
      if (error || !data) { toast.error(error?.message || "Failed to call"); return; }

      setCall({
        id: data.id,
        conversationId,
        peerId: calleeId,
        peerName: calleeName,
        type,
        status: "ringing-outgoing",
        isInitiator: true,
      });

      // Auto-mark missed after 30s if not answered
      const timeout = setTimeout(async () => {
        const { data: cur } = await supabase.from("calls").select("status").eq("id", data.id).single();
        if (cur?.status === "ringing") {
          await supabase.from("calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", data.id);
        }
      }, 30000);

      // Subscribe for status change → when callee accepts (status='active'), begin
      const statusCh = supabase
        .channel(`call-status-${data.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${data.id}` },
          async (payload) => {
            const row = payload.new as any;
            if (row.status === "active" && pcRef.current === null) {
              const stream = await getLocalMedia(type);
              const pc = setupPeerConnection(data.id, true);
              stream.getTracks().forEach((t) => pc.addTrack(t, stream));
              setCall((cur) => cur ? { ...cur, status: "active" } : cur);
            }
            if (row.status === "ended" || row.status === "declined" || row.status === "missed") {
              clearTimeout(timeout);
              cleanup();
              setCall(null);
              supabase.removeChannel(statusCh);
            }
          })
        .subscribe();
    } catch (e: any) {
      toast.error(e.message || "Call failed");
    }
  }, [user, call, getLocalMedia, setupPeerConnection, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!call) return;
    try {
      const stream = await getLocalMedia(call.type);
      const pc = setupPeerConnection(call.id, false);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await supabase.from("calls").update({ status: "active", answered_at: new Date().toISOString() }).eq("id", call.id);
      setCall({ ...call, status: "active" });
    } catch (e: any) {
      toast.error("Couldn't access mic/camera");
      await endCall("declined");
    }
  }, [call, getLocalMedia, setupPeerConnection, endCall]);

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  };

  return (
    <Ctx.Provider value={{ startCall }}>
      {children}

      {/* Incoming call dialog */}
      {call?.status === "ringing-incoming" && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl p-8 max-w-sm w-full text-center space-y-6 border border-border shadow-2xl">
            <Avatar className="h-24 w-24 mx-auto">
              <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                {call.peerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{call.peerName}</p>
              <p className="text-sm text-muted-foreground">
                Incoming {call.type === "video" ? "video" : "voice"} call…
              </p>
            </div>
            <div className="flex justify-center gap-6">
              <Button size="icon" variant="destructive" className="h-14 w-14 rounded-full" onClick={() => endCall("declined")}>
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button size="icon" className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white" onClick={acceptCall}>
                {call.type === "video" ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing ringing */}
      {call?.status === "ringing-outgoing" && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 text-white">
          <Avatar className="h-28 w-28 mb-6">
            <AvatarFallback className="bg-primary/30 text-primary-foreground text-3xl">
              {call.peerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="text-2xl font-semibold">{call.peerName}</p>
          <p className="text-sm text-white/60 mt-1 animate-pulse">Ringing…</p>
          <Button size="icon" variant="destructive" className="h-14 w-14 rounded-full mt-10" onClick={() => endCall("ended")}>
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Active call */}
      {call?.status === "active" && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex-1 relative bg-black flex items-center justify-center">
            {call.type === "video" ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-4 right-4 w-32 h-44 object-cover rounded-lg border-2 border-white/40 shadow-lg" />
              </>
            ) : (
              <>
                <audio ref={remoteVideoRef as any} autoPlay />
                <div className="text-center text-white">
                  <Avatar className="h-32 w-32 mx-auto mb-4">
                    <AvatarFallback className="bg-primary/30 text-primary-foreground text-4xl">
                      {call.peerName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-2xl font-semibold">{call.peerName}</p>
                  <p className="text-sm text-white/60 mt-1">In call…</p>
                </div>
              </>
            )}
          </div>
          <div className="bg-black/80 backdrop-blur-md py-6 flex justify-center gap-4">
            <Button size="icon" variant="secondary" className="h-12 w-12 rounded-full" onClick={toggleMute}>
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            {call.type === "video" && (
              <Button size="icon" variant="secondary" className="h-12 w-12 rounded-full" onClick={toggleCamera}>
                {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            )}
            <Button size="icon" variant="destructive" className="h-12 w-12 rounded-full" onClick={() => endCall("ended")}>
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}