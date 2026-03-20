'use client';

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(username, password);
    if (success) router.push("/"); // redirect to home
    else setError("Invalid username or password");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/10">
      <div className="w-full max-w-md px-4">
        <form 
          onSubmit={handleSubmit} 
          className="bg-card border border-border/50 p-8 rounded-xl shadow-lg backdrop-blur-sm flex flex-col gap-5"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <div className="h-6 w-6 rounded-lg bg-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-destructive text-sm text-center font-medium">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all shadow-sm hover:shadow-md"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
