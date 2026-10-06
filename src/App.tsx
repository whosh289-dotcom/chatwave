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
  return (
    <div className="fixed inset-0 -z-10 bg-[#07080d] overflow-hidden pointer-events-none">
      {/* Base44 Ambient Radial Lighting Mesh */}
      <div className="absolute w-[900px] h-[700px] bg-indigo-500/10 rounded-full blur-[140px] top-[-25%] left-[20%]"></div>
      <div className="absolute w-[700px] h-[600px] bg-emerald-500/[0.07] rounded-full blur-[160px] bottom-[-20%] right-[-10%]"></div>
      <div className="absolute w-[600px] h-[500px] bg-sky-500/[0.04] rounded-full blur-[140px] top-[40%] left-[-15%]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.08)_0%,transparent_60%)]"></div>
      
      {/* Subtle Technical Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
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
