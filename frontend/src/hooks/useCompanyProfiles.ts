import { useEffect, useState } from "react";

import { initialCompanyProfiles } from "../data/areasEmpresas";
import type { CompanyProfile } from "../types/empresa.types";

const STORAGE_KEY = "licitai-company-profiles";

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
    return Array.isArray(parsedValue) ? parsedValue : initialCompanyProfiles;
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
