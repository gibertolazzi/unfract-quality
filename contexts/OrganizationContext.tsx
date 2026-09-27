'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, where } from 'firebase/firestore';
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

    const orgsRef = collection(db, 'organizations');
    const q = query(orgsRef, where('memberUids', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrgs: Organization[] = [];
      snapshot.forEach(doc => {
        fetchedOrgs.push({ id: doc.id, ...doc.data() } as Organization);
      });
      setOrganizations(fetchedOrgs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching organizations:", error);
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
