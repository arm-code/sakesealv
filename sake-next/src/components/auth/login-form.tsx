"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthApi } from "@/lib/client/auth-api";
import { AccountApi } from "@/lib/client/account-api";
import { errorMessage } from "@/lib/client/api-client";

type Mode = "checking" | "login" | "bootstrap";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      try {
        // Una sesión válida salta el formulario.
        await AccountApi.getCurrentUser();
        if (!cancelled) router.replace("/library");
        return;
      } catch {
        // Sin sesión: seguimos al formulario.
      }
      try {
        const status = await AuthApi.status();
        if (!cancelled) setMode(status.needsBootstrap ? "bootstrap" : "login");
      } catch (cause: unknown) {
        if (!cancelled) {
          setError(errorMessage(cause, "Could not reach the server"));
          setMode("login");
        }
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    if (mode === "bootstrap" && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      const input = { username: username.trim(), password };
      if (mode === "bootstrap") await AuthApi.bootstrap(input);
      else await AuthApi.login(input);
      router.replace("/library");
    } catch (cause: unknown) {
      setError(errorMessage(cause, mode === "bootstrap" ? "Could not create the account" : "Could not sign in"));
      setIsSubmitting(false);
    }
  }

  const isBootstrap = mode === "bootstrap";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Sake</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "checking"
              ? "Checking session..."
              : isBootstrap
                ? "Create the first account to get started."
                : "Sign in to your library."}
          </p>
        </div>

        {mode !== "checking" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete={isBootstrap ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {isBootstrap && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-confirm">Confirm password</Label>
                <Input
                  id="login-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : isBootstrap ? "Create account" : "Sign in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
