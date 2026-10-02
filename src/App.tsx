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
    
    // Apply to document body directly for true global effect
    document.body.className = document.body.className.replace(/chat-bg-\w+/g, '');
    document.body.classList.add(bgClass);

    return () => window.removeEventListener("chat-bg-change", handleBgChange);
  }, [bgClass]);

  return <div className={`fixed inset-0 pointer-events-none ${bgClass} opacity-[0.03] z-0`}></div>;
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
