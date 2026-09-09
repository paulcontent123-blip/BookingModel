'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { GeoInfo } from '@/lib/geo';

export interface ManagerContact {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  hours: string;
}

export interface RestrictedPrefill {
  creatorId?: string | null;
  creatorName?: string | null;
  campaignId?: string | null;
  contentType?: string | null;
  quantity?: number | null;
}

interface GeoContextValue {
  geo: GeoInfo;
  manager: ManagerContact;
  /** Opens the "leave your details" modal (requirement #2). */
  openRestricted: (prefill?: RestrictedPrefill) => void;
  closeRestricted: () => void;
  restrictedOpen: boolean;
  prefill: RestrictedPrefill;
}

const GeoContext = createContext<GeoContextValue | null>(null);

export function GeoProvider({
  geo,
  manager,
  children,
}: {
  geo: GeoInfo;
  manager: ManagerContact;
  children: ReactNode;
}) {
  const [restrictedOpen, setRestrictedOpen] = useState(false);
  const [prefill, setPrefill] = useState<RestrictedPrefill>({});

  return (
    <GeoContext.Provider
      value={{
        geo,
        manager,
        restrictedOpen,
        prefill,
        openRestricted: (p = {}) => {
          setPrefill(p);
          setRestrictedOpen(true);
        },
        closeRestricted: () => setRestrictedOpen(false),
      }}
    >
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo(): GeoContextValue {
  const ctx = useContext(GeoContext);
  if (!ctx) throw new Error('useGeo must be used inside <GeoProvider>');
  return ctx;
}
