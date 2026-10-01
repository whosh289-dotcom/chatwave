import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_URL = "";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/signup";
      
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      
      signIn({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.email.split("@")[0]
      });
      
      toast.success(mode === "login" ? "Logged in successfully!" : "Account created!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    toast.error("Google login requires OAuth setup with Cloudflare");
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Panel - Hidden on mobile, visible on large screens */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-7 h-7 stroke-[2.5]" />
          <span className="text-xl font-bold tracking-tight font-heading">ChatApp</span>
        </div>
        
        <div className="flex justify-center items-center flex-1 w-full">
          <div className="bg-primary-foreground/10 w-96 h-96 rounded-[2rem] flex items-center justify-center relative overflow-hidden shadow-2xl mx-auto backdrop-blur-sm">
            {/* Dark Bubble */}
            <div className="absolute w-[140px] h-[140px] bg-primary-foreground/90 top-[20%] left-[20%] z-10" style={{ borderRadius: '50% 50% 50% 10%' }}></div>
            {/* Light Bubble */}
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
            <h2 className="text-[28px] font-bold text-foreground font-heading tracking-tight mb-2">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {mode === "login" ? "Sign in to continue chatting" : "Sign up to start chatting"}
            </p>
          </div>

          <button 
            type="button" 
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-secondary hover:bg-secondary/80 border border-border text-secondary-foreground text-sm font-bold h-12 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-4 text-muted-foreground font-bold uppercase tracking-wider">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-bold text-foreground">Password</Label>
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

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-[15px] font-bold mt-2 transition-colors" 
              disabled={loading}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

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
        </div>
      </div>
    </div>
  );
};

export default Auth;
