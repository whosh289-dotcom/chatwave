import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Eye, EyeOff, ArrowLeft, MailCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_URL = "";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "forgot_password" | "reset_password" | "confirm_email">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Check for tokens in URL for reset or confirm
  useEffect(() => {
    const token = searchParams.get("token");
    const type = searchParams.get("type");
    if (token) {
      if (type === "reset") setMode("reset_password");
      if (type === "confirm") {
        setMode("confirm_email");
        confirmEmailToken(token);
      }
    }
  }, [searchParams]);

  const confirmEmailToken = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirmation failed");
      toast.success("Email confirmed successfully! You can now log in.");
      setMode("login");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message);
      setMode("login");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot_password") {
        const res = await fetch(`${API_URL}/api/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send reset link");
        toast.success("Password reset link sent to your email!");
        setMode("login");
        return;
      }

      if (mode === "reset_password") {
        const token = searchParams.get("token");
        const res = await fetch(`${API_URL}/api/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reset password");
        toast.success("Password reset successfully! Please log in.");
        setMode("login");
        navigate("/auth");
        return;
      }

      // Login or Signup
      const endpoint = mode === "login" ? "/api/login" : "/api/signup";
      const bodyPayload = mode === "signup" ? { email, password, username } : { email, password };
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
        toast.success("Account created! Please check your email to confirm your account.");
        setMode("login");
        return;
      }

      // Login success
      signIn({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.email.split("@")[0]
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
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-7 h-7 stroke-[2.5]" />
          <span className="text-xl font-bold tracking-tight font-heading">ChatApp</span>
        </div>
        
        <div className="flex justify-center items-center flex-1 w-full">
          <div className="bg-primary-foreground/10 w-96 h-96 rounded-[2rem] flex items-center justify-center relative overflow-hidden shadow-2xl mx-auto backdrop-blur-sm">
            <div className="absolute w-[140px] h-[140px] bg-primary-foreground/90 top-[20%] left-[20%] z-10" style={{ borderRadius: '50% 50% 50% 10%' }}></div>
            <div className="absolute w-[140px] h-[140px] bg-accent/90 bottom-[20%] right-[20%] z-20 mix-blend-screen" style={{ borderRadius: '50% 50% 10% 50%' }}></div>
          </div>
        </div>
        
        <div className="max-w-md pb-4">
          <p className="text-[15px] text-primary-foreground/90 leading-relaxed font-medium">
            Simple, fast and reliable messaging. Talk to anyone, anywhere — in real time.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[440px] bg-card p-10 rounded-2xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
          
          <div className="text-center mb-8">
            {mode === "confirm_email" && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <MailCheck className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-[28px] font-bold text-foreground font-heading tracking-tight">
                  Confirming email...
                </h2>
              </div>
            )}
            
            {mode !== "confirm_email" && (
              <>
                <h2 className="text-[28px] font-bold text-foreground font-heading tracking-tight mb-2">
                  {mode === "login" && "Welcome back"}
                  {mode === "signup" && "Create account"}
                  {mode === "forgot_password" && "Reset Password"}
                  {mode === "reset_password" && "New Password"}
                </h2>
                <p className="text-sm text-muted-foreground font-medium">
                  {mode === "login" && "Sign in to continue chatting"}
                  {mode === "signup" && "Sign up to start chatting"}
                  {mode === "forgot_password" && "Enter your email to receive a reset link"}
                  {mode === "reset_password" && "Enter your new password below"}
                </p>
              </>
            )}
          </div>

          {mode !== "confirm_email" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {(mode === "login" || mode === "signup" || mode === "forgot_password") && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-bold text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-background border-border focus-visible:ring-primary rounded-xl px-4 text-[15px]"
                  />
                </div>
              )}

              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[13px] font-bold text-foreground">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-12 bg-background border-border focus-visible:ring-primary rounded-xl px-4 text-[15px]"
                  />
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "reset_password") && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-[13px] font-bold text-foreground">
                      {mode === "reset_password" ? "New Password" : "Password"}
                    </Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot_password")}
                        className="text-[13px] text-primary font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 bg-background border-border focus-visible:ring-primary rounded-xl px-4 pr-10 text-[15px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl text-[15px] font-bold mt-2 transition-colors" 
                disabled={loading}
              >
                {loading ? "Please wait..." : 
                  mode === "login" ? "Sign in" : 
                  mode === "signup" ? "Create account" : 
                  mode === "forgot_password" ? "Send reset link" : "Update password"}
              </Button>
            </form>
          )}

          {(mode === "forgot_password" || mode === "reset_password") && (
            <div className="mt-8 text-center text-[13.5px] text-muted-foreground font-medium">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
            </div>
          )}

          {(mode === "login" || mode === "signup") && (
            <div className="mt-8 text-center text-[13.5px] text-muted-foreground font-medium">
              {mode === "login" ? "New here? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-primary font-bold hover:underline"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
