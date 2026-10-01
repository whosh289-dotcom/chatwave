import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface User {
  id: string;
  username: string; // Updated from email to username
}

interface AuthContextType {
  user: User | null;
  accounts: User[];
  loading: boolean;
  signIn: (user: User) => void;
  signOut: () => void;
  switchAccount: (id: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accounts: [],
  loading: true,
  signIn: () => {},
  signOut: () => {},
  switchAccount: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAccounts = localStorage.getItem("chatwave_accounts");
    const activeUserId = localStorage.getItem("chatwave_active_user");
    
    if (storedAccounts) {
      try {
        const parsed = JSON.parse(storedAccounts);
        setAccounts(parsed);
        if (activeUserId) {
          const active = parsed.find((u: User) => u.id === activeUserId);
          if (active) setUser(active);
        } else if (parsed.length > 0) {
          setUser(parsed[0]);
        }
      } catch (e) {
        console.error("Failed to parse stored accounts", e);
      }
    }
    setLoading(false);
  }, []);

  const signIn = (newUser: User) => {
    setAccounts((prev) => {
      const exists = prev.find(u => u.id === newUser.id);
      const updated = exists ? prev : [...prev, newUser];
      localStorage.setItem("chatwave_accounts", JSON.stringify(updated));
      return updated;
    });
    setUser(newUser);
    localStorage.setItem("chatwave_active_user", newUser.id);
    
    if (window.location.pathname === "/auth") {
      window.location.href = "/";
    }
  };

  const switchAccount = (id: string) => {
    const target = accounts.find(u => u.id === id);
    if (target) {
      setUser(target);
      localStorage.setItem("chatwave_active_user", target.id);
      // Optional: reload to ensure all states reset cleanly
      window.location.reload();
    }
  };

  const signOut = () => {
    if (!user) return;
    setAccounts((prev) => {
      const updated = prev.filter(u => u.id !== user.id);
      localStorage.setItem("chatwave_accounts", JSON.stringify(updated));
      
      if (updated.length > 0) {
        setUser(updated[0]);
        localStorage.setItem("chatwave_active_user", updated[0].id);
        window.location.reload();
      } else {
        setUser(null);
        localStorage.removeItem("chatwave_active_user");
        window.location.href = "/auth";
      }
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, accounts, loading, signIn, signOut, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
