"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LibraryApi } from "@/lib/client/library-api";
import { errorMessage } from "@/lib/client/api-client";
import { EpubReader } from "./epub-reader";

interface ReaderTarget {
  fileName: string;
  title: string;
}

// Carga el detalle del libro (también hace de gate de sesión: 401 → login) y
// monta el lector. Solo EPUB, igual que el original.
export function ReaderPage({ bookId }: { bookId: number }) {
  const router = useRouter();
  const [target, setTarget] = useState<ReaderTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(bookId) || bookId <= 0) {
      setError("Invalid book id");
      return;
    }
    let cancelled = false;
    LibraryApi.detail(bookId)
      .then((detail) => {
        if (cancelled) return;
        if (detail.extension?.toLowerCase() !== "epub") {
          setError("Web reader supports EPUB books only");
          return;
        }
        setTarget({ fileName: detail.fileName, title: detail.title });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = errorMessage(cause, "Failed to open this book");
        if (message === "Authentication required") router.replace("/");
        else setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, router]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Link href="/library" className="text-sm underline">
          Back to library
        </Link>
      </div>
    );
  }
  if (!target) return <div className="min-h-dvh" aria-busy="true" />;
  return <EpubReader bookId={bookId} fileName={target.fileName} title={target.title} />;
}
