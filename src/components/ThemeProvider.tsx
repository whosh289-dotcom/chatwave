import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const applyAccent = () => {
      const accent = localStorage.getItem("chat-accent") || "indigo";
      document.documentElement.setAttribute("data-accent", accent);
    };

    applyAccent();
    window.addEventListener("chat-accent-change", applyAccent);
    return () => window.removeEventListener("chat-accent-change", applyAccent);
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
