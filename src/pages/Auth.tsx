import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Since we are using Cloudflare Pages Functions, the API is on the exact same domain!
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
      
      // Save user to context/localStorage
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
    <div className="min-h-screen w-full flex bg-[#F9F9F9]">
      {/* Left Panel - Hidden on mobile, visible on large screens */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#0C895E] p-12 text-white">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-7 h-7 stroke-[2.5]" />
          <span className="text-xl font-bold tracking-tight">ChatApp</span>
        </div>
        
        <div className="flex justify-center items-center flex-1 w-full">
          <div className="bg-[#F8F7F3] w-96 h-96 rounded-[2rem] flex items-center justify-center relative overflow-hidden shadow-2xl mx-auto">
            {/* Dark Green Bubble */}
            <div className="absolute w-[140px] h-[140px] bg-[#12B079] top-[20%] left-[20%] z-10" style={{ borderRadius: '50% 50% 50% 10%' }}></div>
            {/* Light Green Bubble */}
            <div className="absolute w-[140px] h-[140px] bg-[#A6E881]/90 bottom-[20%] right-[20%] z-20 mix-blend-multiply" style={{ borderRadius: '50% 50% 10% 50%' }}></div>
          </div>
        </div>
        
        <div className="max-w-md pb-4">
          <p className="text-[15px] text-white/95 leading-relaxed font-medium">
            Simple, fast and reliable messaging. Talk to anyone, anywhere — in real time.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F9F9F9]">
        <div className="w-full max-w-[440px] bg-white p-10 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          
          <div className="text-center mb-8">
            <h2 className="text-[28px] font-bold text-gray-900 tracking-tight mb-2">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              {mode === "login" ? "Sign in to continue chatting" : "Sign up to start chatting"}
            </p>
          </div>

          <button 
            type="button" 
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-[#F9F9F9] hover:bg-gray-100 border border-gray-200 text-gray-800 text-sm font-bold h-12 rounded-xl transition-colors"
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
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-gray-400 font-bold uppercase tracking-wider">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-bold text-gray-900">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-white border-gray-200 focus-visible:ring-[#0C895E] rounded-xl px-4 text-[15px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-bold text-gray-900">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 bg-white border-gray-200 focus-visible:ring-[#0C895E] rounded-xl px-4 pr-10 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-[#0C895E] hover:bg-[#0A7A53] text-white rounded-xl text-[15px] font-bold mt-2 transition-colors" 
              disabled={loading}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-8 text-center text-[13.5px] text-gray-600 font-medium">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-[#0C895E] font-bold hover:underline"
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
