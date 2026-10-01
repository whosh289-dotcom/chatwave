import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Note: Ensure this matches your deployed Cloudflare Worker URL!
const API_URL = import.meta.env.VITE_API_URL || "https://chatwave-api.whosh289.workers.dev";

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

  return (
    <div className="auth-container min-h-screen flex items-center justify-center bg-background p-4">
      <div className="auth-card w-full max-w-md bg-card p-8 rounded-2xl shadow-xl border border-border">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-xl font-bold font-heading">Chatwave</h1>
          </div>
        </div>

        <h2 className="text-2xl font-bold font-heading mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {mode === "login"
            ? "Sign in to continue your conversations"
            : "Start messaging with friends and family"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary font-medium hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
