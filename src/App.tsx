import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";
import { CallProvider } from "@/components/CallProvider";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const isAddingAccount = new URLSearchParams(window.location.search).get("add") === "true";
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user && !isAddingAccount ? <Navigate to="/" replace /> : <>{children}</>;
};

const GlobalBackground = () => {
  const [bgClass, setBgClass] = useState(() => {
    return `chat-bg-${localStorage.getItem("chat-bg") || "dots"}`;
  });

  useEffect(() => {
    const handleBgChange = () => {
      setBgClass(`chat-bg-${localStorage.getItem("chat-bg") || "dots"}`);
    };
    window.addEventListener("chat-bg-change", handleBgChange);
    return () => window.removeEventListener("chat-bg-change", handleBgChange);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-primary overflow-hidden">
      {/* Abstract Animated Shapes from Login Theme */}
      <div className="absolute w-[600px] h-[600px] bg-primary-foreground/10 rounded-full blur-3xl top-[-20%] left-[-10%] mix-blend-overlay"></div>
      <div className="absolute w-[800px] h-[800px] bg-accent/20 rounded-full blur-3xl bottom-[-20%] right-[-10%] mix-blend-overlay"></div>
      
      {/* 3D Blobs */}
      <div className="absolute top-[20%] left-[15%] w-64 h-64 bg-primary-foreground/20 backdrop-blur-3xl shadow-2xl animate-pulse" style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%', animationDuration: '8s' }}></div>
      <div className="absolute bottom-[20%] right-[15%] w-80 h-80 bg-accent/30 backdrop-blur-3xl shadow-2xl mix-blend-screen animate-pulse" style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%', animationDuration: '12s' }}></div>
      
      {/* User customizable pattern overlay */}
      <div className={`absolute inset-0 pointer-events-none ${bgClass} opacity-10 mix-blend-overlay`}></div>
    </div>
  );
};

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalBackground />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CallProvider>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CallProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
