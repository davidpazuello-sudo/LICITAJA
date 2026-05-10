import { useEffect, useState } from "react";

import { initialCompanyProfiles } from "../data/areasEmpresas";
import type { CompanyProfile } from "../types/empresa.types";

const STORAGE_KEY = "licitai-company-profiles";

function normalizeCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mergeProfiles(baseProfiles: CompanyProfile[], extraProfiles: CompanyProfile[]) {
  const merged = [...baseProfiles];
  const knownNames = new Set(baseProfiles.map((item) => normalizeCompanyName(item.nome)));

  for (const profile of extraProfiles) {
    const normalizedName = normalizeCompanyName(profile.nome);
    if (knownNames.has(normalizedName)) {
      continue;
    }

    merged.push(profile);
    knownNames.add(normalizedName);
  }

  return merged;
}

function loadProfiles() {
  if (typeof window === "undefined") {
    return initialCompanyProfiles;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return initialCompanyProfiles;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as CompanyProfile[];
    return Array.isArray(parsedValue) ? mergeProfiles(initialCompanyProfiles, parsedValue) : initialCompanyProfiles;
  } catch {
    return initialCompanyProfiles;
  }
}

function useCompanyProfiles() {
  const [items, setItems] = useState<CompanyProfile[]>(loadProfiles);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  return {
    items,
    addCompany: (company: CompanyProfile) => setItems((current) => [...current, company]),
  };
}

export { useCompanyProfiles };
