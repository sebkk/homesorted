"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Category {
  name: string;
  icon: string;
}

// Global, shared across all zones/users — managed as data in Supabase
// (SQL editor / dashboard), not hardcoded, so new categories don't need a
// code change or deploy.

// Module-level cache: categories rarely change, so every component that
// calls useCategories() (the expense form and the expenses list can both be
// mounted at once, and the form remounts each time its sheet opens) shares
// one fetch instead of re-querying Supabase every time. Resets naturally on
// a full page reload since it's plain in-memory module state.
let cache: Category[] | null = null;
let inFlight: Promise<Category[]> | null = null;

function fetchCategories(): Promise<Category[]> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    const supabase = createClient();
    inFlight = Promise.resolve(
      supabase
        .from("categories")
        .select("name, icon")
        .order("sort_order")
        .then(({ data }) => {
          cache = (data as Category[]) ?? [];
          inFlight = null;
          return cache;
        })
    );
  }
  return inFlight;
}

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);

  useEffect(() => {
    if (cache) return; // already seeded synchronously via useState's initializer
    let cancelled = false;
    fetchCategories().then((data) => {
      if (!cancelled) setCategories(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}
