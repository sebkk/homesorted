"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Category, CategoryRole } from "@/lib/types";

// Global, shared across all zones/users — managed as data in Supabase
// (SQL editor / dashboard), not hardcoded, so new categories don't need a
// code change or deploy. Entries reference categories by id; calculations
// that care about a category's meaning use its `role`, never its name.

// Module-level cache: categories rarely change, so every component that
// calls useCategories() shares one fetch instead of re-querying Supabase.
// Resets naturally on a full page reload since it's in-memory module state.
let cache: Category[] | null = null;
let inFlight: Promise<Category[]> | null = null;

function fetchCategories(): Promise<Category[]> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    const supabase = createClient();
    inFlight = Promise.resolve(
      supabase
        .from("categories")
        .select("id, key, name, icon, role, sort_order")
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

export interface CategoryLookup {
  list: Category[];
  byId: (id: string) => Category | undefined;
  name: (id: string) => string;
  icon: (id: string) => string | undefined;
  roleOf: (id: string) => CategoryRole | null;
}

export function useCategories(): CategoryLookup {
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

  const t = useTranslations("categories");

  return useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    // Label from messages by `key`; the DB name covers categories added
    // later in Supabase that have no translation yet.
    const label = (c: Category) => (t.has(c.key) ? t(c.key) : c.name);
    return {
      list: categories,
      byId: (id) => map.get(id),
      name: (id) => {
        const c = map.get(id);
        return c ? label(c) : "";
      },
      icon: (id) => map.get(id)?.icon,
      roleOf: (id) => map.get(id)?.role ?? null,
    };
  }, [categories, t]);
}
