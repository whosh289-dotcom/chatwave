import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_URL = "";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot_password" | "reset_password">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot_password") {
        const res = await fetch(`${API_URL}/api/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "User not found");
        
        setSecurityQuestion(data.securityQuestion);
        toast.success("User found! Please answer your security question.");
        setMode("reset_password");
        return;
      }

      if (mode === "reset_password") {
        const res = await fetch(`${API_URL}/api/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, securityAnswer, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reset password");
        toast.success("Password reset successfully! Please log in.");
        setMode("login");
        return;
      }

      // Login or Signup
      const endpoint = mode === "login" ? "/api/login" : "/api/signup";
      const bodyPayload = mode === "signup" ? { username, password, securityQuestion, securityAnswer } : { username, password };
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      
      if (mode === "signup") {
        toast.success("Account created successfully! You can now log in.");
        setMode("login");
        return;
      }

      // Login success
      signIn({
        id: data.user.id,
        username: data.user.username,
        token: data.token
      });
      
      toast.success("Logged in successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#07080d] relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14 relative z-10 border-r border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <MessageCircle className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <span className="text-xl font-bold font-heading text-white tracking-tight">ChatWave</span>
          <span className="pill-badge text-[10px] text-indigo-300 border-indigo-500/30 font-mono">v2.4 Base44</span>
        </div>
        
        <div className="my-auto max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-white/70 uppercase tracking-widest">Global Edge Messaging</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold font-heading text-white tracking-tight leading-[1.15]">
              Real-time messaging, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
                sculpted for speed.
              </span>
            </h1>
            <p className="text-sm text-white/50 leading-relaxed max-w-md">
              Powered by Cloudflare Workers and D1 SQLite. Ultra low-latency state synchronization with frosted glass bento design.
            </p>
          </div>

          {/* Interactive Bento Showcase Card */}
          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl space-y-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-indigo-300">CW</span>
                </div>
                <div>
                  <p className="text-xs font-heading font-semibold text-white">Encrypted Workspace</p>
                  <p className="text-[10px] font-mono text-emerald-400">● 100% Verified Pipeline</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/40">Sub-50ms</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-2">
              <div className="flex justify-end">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl rounded-br-xs px-3 py-1.5 text-xs shadow-md">
                  Hey team! ChatWave just upgraded to the Base44 system. ✨
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/[0.05] border border-white/[0.08] text-white/80 rounded-xl rounded-bl-xs px-3 py-1.5 text-xs">
                  Instant reactivity and zero layout shifts. Beautiful! 🚀
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="text-xs font-mono font-bold text-indigo-400">0.05s</div>
                <div className="text-[9px] font-mono text-white/40 uppercase">Delivery</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="text-xs font-mono font-bold text-emerald-400">100%</div>
                <div className="text-[9px] font-mono text-white/40 uppercase">D1 Native</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="text-xs font-mono font-bold text-purple-400">P2P</div>
                <div className="text-[9px] font-mono text-white/40 uppercase">Audio/Video</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-xs font-mono text-white/30 flex items-center justify-between">
          <span>Cloudflare Edge Architecture</span>
          <span>© 2026 ChatWave Engine</span>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[420px] bg-[#0c0d14]/85 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative">
          
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold font-heading text-white tracking-tight mb-1.5">
              {mode === "login" && "Access Portal"}
              {mode === "signup" && "Create Identity"}
              {mode === "forgot_password" && "Recover Access"}
              {mode === "reset_password" && "Reset Password"}
            </h2>
            <p className="text-xs text-white/50">
              {mode === "login" && "Enter your credentials to enter the workspace"}
              {mode === "signup" && "Claim your username on the edge network"}
              {mode === "forgot_password" && "Enter your username to begin recovery"}
              {mode === "reset_password" && "Answer your custom security question"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            {(mode === "login" || mode === "signup" || mode === "forgot_password") && (
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-mono text-white/70">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g. alexander"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-10 bg-black/40 border border-white/[0.09] focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 rounded-xl px-3.5 text-xs text-white placeholder:text-white/30"
                />
              </div>
            )}

            {/* Security Question for Signup */}
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="securityQuestion" className="text-xs font-mono text-white/70">Security Question / Hint</Label>
                  <Input
                    id="securityQuestion"
                    type="text"
                    placeholder="e.g. Childhood pet name?"
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    required
                    className="h-10 bg-black/40 border border-white/[0.09] focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 rounded-xl px-3.5 text-xs text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="securityAnswer" className="text-xs font-mono text-white/70">Security Answer</Label>
                  <Input
                    id="securityAnswer"
                    type="password"
                    placeholder="Your answer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    required
                    className="h-10 bg-black/40 border border-white/[0.09] focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 rounded-xl px-3.5 text-xs text-white placeholder:text-white/30"
                  />
                </div>
              </>
            )}

            {/* Security Question for Reset Password */}
            {mode === "reset_password" && (
              <>
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300">
                  Hint: {securityQuestion}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="securityAnswer" className="text-xs font-mono text-white/70">Security Answer</Label>
                  <Input
                    id="securityAnswer"
                    type="password"
                    placeholder="Enter answer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    required
                    className="h-10 bg-black/40 border border-white/[0.09] focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 rounded-xl px-3.5 text-xs text-white placeholder:text-white/30"
                  />
                </div>
              </>
            )}

            {/* Password Inputs */}
            {(mode === "login" || mode === "signup" || mode === "reset_password") && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-mono text-white/70">
                    {mode === "reset_password" ? "New Password" : "Password"}
                  </Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot_password")}
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={mode === "reset_password" ? newPassword : password}
                    onChange={(e) => mode === "reset_password" ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-10 bg-black/40 border border-white/[0.09] focus-visible:border-indigo-500/50 focus-visible:ring-1 focus-visible:ring-indigo-500/30 rounded-xl px-3.5 pr-10 text-xs text-white placeholder:text-white/30 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-10 rounded-xl text-xs font-semibold mt-2 glow-btn bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all" 
              disabled={loading}
            >
              {loading ? "Authenticating..." : 
                mode === "login" ? "Sign In →" : 
                mode === "signup" ? "Create Account →" : 
                mode === "forgot_password" ? "Continue →" : "Set New Password →"}
            </Button>
          </form>

          {(mode === "forgot_password" || mode === "reset_password") && (
            <div className="mt-6 text-center text-xs text-white/50">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </div>
          )}

          {(mode === "login" || mode === "signup") && (
            <div className="mt-6 text-center text-xs text-white/50">
              {mode === "login" ? "Don't have an ID? " : "Already registered? "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
