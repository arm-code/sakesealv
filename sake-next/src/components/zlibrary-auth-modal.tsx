"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notImplemented } from "@/components/sidebar/settings/not-implemented";

type AuthMode = "password" | "remix";

interface ZLibraryAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ZLibraryAuthModal({ open, onOpenChange }: ZLibraryAuthModalProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    notImplemented("Connecting to Z-Library");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>Connect Z-Library</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Link your Z-Library account to search and download books
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1" role="tablist" aria-label="Z-Library authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "password"}
              onClick={() => setAuthMode("password")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors",
                authMode === "password" && "bg-background text-foreground shadow-sm",
              )}
            >
              Email Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "remix"}
              onClick={() => setAuthMode("remix")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors",
                authMode === "remix" && "bg-background text-foreground shadow-sm",
              )}
            >
              Remix Credentials
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zlib-username">{authMode === "remix" ? "Remix UserID" : "Email"}</Label>
            <Input
              id="zlib-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={authMode === "remix" ? "Enter your Remix UserID" : "Enter your email"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zlib-password">{authMode === "remix" ? "Remix UserKey" : "Password"}</Label>
            <Input
              id="zlib-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={authMode === "remix" ? "Enter your Remix UserKey" : "Enter your password"}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!username || !password}>
              Connect
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
