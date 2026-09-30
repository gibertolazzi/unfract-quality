'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { OrganizationService } from '@/lib/services/organizationService';
import { useAuth } from './AuthContext';
import { Organization } from '@/types/organization';

interface OrganizationContextType {
  organizations: Organization[];
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  loading: true,
});

export const useOrganization = () => useContext(OrganizationContext);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    const unsubscribe = OrganizationService.subscribe(user.uid, (fetchedOrgs) => {
      setOrganizations(fetchedOrgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  return (
    <OrganizationContext.Provider value={{ organizations, loading }}>
      {children}
    </OrganizationContext.Provider>
  );
}
