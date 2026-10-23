import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneOff, Video, Phone, MicOff, Mic, VideoOff, Maximize2, Shield, Volume2 } from "lucide-react";
import Peer, { MediaConnection } from "peerjs";

type CallType = "video" | "voice";

type CallState = {
  id: string;
  peerId: string;
  peerName: string;
  type: CallType;
  status: "ringing-outgoing" | "ringing-incoming" | "active";
  isInitiator: boolean;
  peerConnection?: MediaConnection;
};

type CallContextType = {
  startCall: (conversationId: string, calleeId: string, calleeName: string, type: CallType) => Promise<void>;
};

const Ctx = createContext<CallContextType | null>(null);

export function useCall() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [call, setCall] = useState<CallState | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timer: any;
    if (call?.status === "active") {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [call?.status]);

  const formatCallDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!user) {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      return;
    }

    const peer = new Peer(user.id);
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("My peer ID is: " + id);
    });

    peer.on("error", (err) => {
      console.error("PeerJS error:", err);
      toast.error("Call network error: " + err.type);
    });

    peer.on("call", async (incomingCall) => {
      if (call) {
        // Busy
        incomingCall.close();
        return;
      }
      
      // Check if blocked
      try {
        const blockRes = await fetch(`/api/users/block-status?userId=${user.id}&otherUserId=${incomingCall.peer}`);
        if (blockRes.ok) {
          const blockData = await blockRes.json();
          if (blockData.isBlockedByMe || blockData.isBlockedByThem) {
            incomingCall.close();
            return;
          }
        }
      } catch (e) {
        // Continue if offline check fails
      }

      const type = incomingCall.metadata?.type || "video";
      const callerName = incomingCall.metadata?.callerName || "Friend";

      setCall({
        id: incomingCall.peer,
        peerId: incomingCall.peer,
        peerName: callerName,
        type,
        status: "ringing-incoming",
        isInitiator: false,
        peerConnection: incomingCall
      });

      incomingCall.on("close", () => {
        cleanup();
        toast("Call ended");
      });
    });

    return () => {
      peer.destroy();
    };
  }, [user, call]); // Need to watch call state to reject busy

  const getLocalMedia = async (type: CallType) => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true,
      });
    } catch (e: any) {
      if (type === "video" && (e.name === "NotFoundError" || e.name === "NotReadableError" || e.name === "OverconstrainedError")) {
        toast("No camera found, falling back to voice only.");
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
      } else {
        throw e;
      }
    }
    
    localStreamRef.current = stream;
    if (localVideoRef.current && type === "video") {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStream(null);
    setCall(cur => {
      if (cur?.peerConnection) cur.peerConnection.close();
      return null;
    });
    setMuted(false);
    setCameraOff(false);
  };

  const endCall = (reason: string) => {
    cleanup();
  };

  useEffect(() => {
    if (call?.status === "active" && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [call?.status, remoteStream]);

  const startCall = useCallback(async (conversationId: string, calleeId: string, calleeName: string, type: CallType) => {
    if (!user || !peerRef.current) return;
    if (call) { toast.error("Already in a call"); return; }

    // Check if communication is blocked
    try {
      const blockRes = await fetch(`/api/users/block-status?userId=${user.id}&otherUserId=${calleeId}`);
      if (blockRes.ok) {
        const blockData = await blockRes.json();
        if (blockData.isBlockedByMe || blockData.isBlockedByThem) {
          toast.error("Cannot call this user due to block settings.");
          return;
        }
      }
    } catch (e) {
      // Continue if offline check fails
    }

    try {
      const stream = await getLocalMedia(type);
      
      setCall({
        id: calleeId,
        peerId: calleeId,
        peerName: calleeName,
        type,
        status: "ringing-outgoing",
        isInitiator: true,
      });

      const outCall = peerRef.current.call(calleeId, stream, {
        metadata: { type, callerName: user.username || "Someone" }
      });

      outCall.on("stream", (incomingStream) => {
        setRemoteStream(incomingStream);
        setCall(c => c ? { ...c, status: "active", peerConnection: outCall } : null);
      });

      outCall.on("close", () => {
        cleanup();
      });

      outCall.on("error", (err) => {
        toast.error("Call error: " + err.message);
        cleanup();
      });

      setCall(c => c ? { ...c, peerConnection: outCall } : null);

    } catch (e: any) {
      console.error("Media error:", e);
      toast.error(`Media access failed: ${e.name || e.message || "Unknown error"}`);
      cleanup();
    }
  }, [user, call]);

  const acceptCall = useCallback(async () => {
    if (!call || !call.peerConnection) return;
    try {
      const stream = await getLocalMedia(call.type);
      call.peerConnection.answer(stream);

      call.peerConnection.on("stream", (incomingStream) => {
        setRemoteStream(incomingStream);
      });

      setCall({ ...call, status: "active" });
    } catch (e: any) {
      console.error("Media error (accept):", e);
      toast.error(`Media access failed: ${e.name || e.message || "Unknown error"}`);
      endCall("declined");
    }
  }, [call]);

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

      {call?.status === "ringing-incoming" && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-[#0e111a]/95 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.1)]">
            <div className="relative w-24 h-24 mx-auto">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></span>
              <Avatar className="h-24 w-24 rounded-full border-2 border-emerald-500/40 shadow-xl">
                <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white text-2xl font-heading font-bold">
                  {call.peerName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-xl font-heading font-bold text-white tracking-tight">{call.peerName}</p>
              <p className="text-xs text-white/50 flex items-center justify-center gap-1.5 mt-1 font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Incoming encrypted {call.type === "video" ? "video" : "voice"} call…
              </p>
            </div>
            <div className="flex justify-center gap-6 pt-2">
              <Button size="icon" variant="destructive" className="h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform" onClick={() => endCall("declined")}>
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button size="icon" className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:scale-105 transition-transform" onClick={acceptCall}>
                {call.type === "video" ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {call?.status === "ringing-outgoing" && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-200">
          <div className="relative w-28 h-28 mb-6">
            <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></span>
            <Avatar className="h-28 w-28 rounded-full border-2 border-indigo-500/40 shadow-2xl">
              <AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-3xl font-heading font-bold">
                {call.peerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <p className="text-2xl font-heading font-bold tracking-tight">{call.peerName}</p>
          <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <p className="text-xs text-white/60 font-medium">Connecting end-to-end…</p>
          </div>
          <Button size="icon" variant="destructive" className="h-14 w-14 rounded-full mt-12 shadow-xl hover:scale-105 transition-transform" onClick={() => endCall("ended")}>
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      )}

      {call?.status === "active" && (
        <div className="fixed inset-0 z-[100] bg-[#08090f] flex flex-col text-white animate-in zoom-in-95 duration-200">
          {/* Call Header Status Bar */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 rounded-xl border border-white/10">
                <AvatarFallback className="bg-indigo-600/30 text-white font-bold font-heading text-sm">
                  {call.peerName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading font-semibold text-sm leading-tight">{call.peerName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] font-mono text-emerald-400">{formatCallDuration(callDuration)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-mono text-white/70">Encrypted P2P</span>
            </div>
          </div>

          <div className="flex-1 relative bg-[#090b12] flex items-center justify-center overflow-hidden">
            {call.type === "video" ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute top-20 right-6 w-36 h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/60 backdrop-blur-md">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-md bg-black/60 text-white/80">You</div>
                </div>
              </>
            ) : (
              <>
                <audio ref={remoteVideoRef as any} autoPlay />
                <div className="text-center">
                  <div className="relative w-36 h-36 mx-auto mb-6">
                    <span className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse"></span>
                    <Avatar className="h-36 w-36 rounded-full border-4 border-white/10 shadow-2xl">
                      <AvatarFallback className="bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white text-5xl font-heading font-bold">
                        {call.peerName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <p className="text-3xl font-heading font-bold tracking-tight">{call.peerName}</p>
                  <p className="text-sm font-mono text-emerald-400 mt-2">{formatCallDuration(callDuration)}</p>
                </div>
              </>
            )}
          </div>

          {/* Floating Call Action Controls (WhatsApp / FaceTime style) */}
          <div className="p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-center gap-5">
            <Button 
              size="icon" 
              variant="secondary" 
              className={`h-13 w-13 rounded-full transition-all border ${muted ? "bg-rose-500/20 text-rose-400 border-rose-500/40" : "bg-white/10 hover:bg-white/20 text-white border-white/15"}`} 
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            {call.type === "video" && (
              <Button 
                size="icon" 
                variant="secondary" 
                className={`h-13 w-13 rounded-full transition-all border ${cameraOff ? "bg-rose-500/20 text-rose-400 border-rose-500/40" : "bg-white/10 hover:bg-white/20 text-white border-white/15"}`} 
                onClick={toggleCamera}
                title={cameraOff ? "Turn Video On" : "Turn Video Off"}
              >
                {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            )}
            <Button 
              size="icon" 
              variant="destructive" 
              className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.4)] hover:scale-105 transition-transform" 
              onClick={() => endCall("ended")}
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
