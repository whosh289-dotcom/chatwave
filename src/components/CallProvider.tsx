import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneOff, Video, Phone, MicOff, Mic, VideoOff } from "lucide-react";
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

    peer.on("call", (incomingCall) => {
      if (call) {
        // Busy
        incomingCall.close();
        return;
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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === "video",
      audio: true,
    });
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
    if (call?.status === "active" && remoteVideoRef.current) {
      if (call.peerConnection && call.peerConnection.remoteStream) {
        remoteVideoRef.current.srcObject = call.peerConnection.remoteStream;
      }
    }
  }, [call?.status, call?.peerConnection]);

  const startCall = useCallback(async (conversationId: string, calleeId: string, calleeName: string, type: CallType) => {
    if (!user || !peerRef.current) return;
    if (call) { toast.error("Already in a call"); return; }
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
        metadata: { type, callerName: user.email?.split("@")[0] || "Someone" }
      });

      outCall.on("stream", (remoteStream) => {
        setCall(c => c ? { ...c, status: "active", peerConnection: outCall } : null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
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
      toast.error("Couldn't access mic/camera");
      cleanup();
    }
  }, [user, call]);

  const acceptCall = useCallback(async () => {
    if (!call || !call.peerConnection) return;
    try {
      const stream = await getLocalMedia(call.type);
      call.peerConnection.answer(stream);

      call.peerConnection.on("stream", (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      setCall({ ...call, status: "active" });
    } catch (e: any) {
      toast.error("Couldn't access mic/camera");
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
