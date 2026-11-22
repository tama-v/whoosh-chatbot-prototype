"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Counts = { documents: number; chunks: number };
type Variant = "docs" | "docs-example" | "pair" | "index";

let cached: Counts | null = null;
let inflight: Promise<Counts | null> | null = null;

function loadCounts(): Promise<Counts | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .documents()
      .then(({ items }) => {
        cached = {
          documents: items.length,
          chunks: items.reduce((sum, item) => sum + (item.chunk_count ?? 0), 0),
        };
        return cached;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const FALLBACK: Record<Variant, string> = {
  docs: "beberapa dokumen",
  "docs-example": "beberapa dokumen contoh",
  pair: "knowledge base demo",
  index: "knowledge base demo",
};

export function KnowledgeStats({ variant }: { variant: Variant }) {
  const [counts, setCounts] = useState<Counts | null>(cached);

  useEffect(() => {
    let active = true;
    loadCounts().then((next) => {
      if (active && next) setCounts(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!counts) return <>{FALLBACK[variant]}</>;
  if (variant === "docs") return <>{counts.documents} dokumen</>;
  if (variant === "docs-example") return <>{counts.documents} dokumen contoh</>;
  if (variant === "pair") {
    return (
      <>
        {counts.documents} dokumen · {counts.chunks} potongan teks
      </>
    );
  }
  return (
    <>
      {counts.chunks} potongan teks dari {counts.documents} dokumen
    </>
  );
}
