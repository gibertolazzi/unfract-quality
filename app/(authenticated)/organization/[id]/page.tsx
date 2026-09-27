"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrgDetail } from '@/components/organization/OrgDetail';
import { Organization } from '@/components/organization/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Loader2 } from 'lucide-react';

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.id as string;
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchOrg = async () => {
      try {
        const docRef = doc(db, 'organizations', orgId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Organization;
          data.id = docSnap.id;
          // check if user is in members
          const isMember = data.members?.some(m => m.uid === user.uid);
          if (isMember) {
            setOrg(data);
          } else {
            toast.error("Non sei membro di questa organizzazione.");
            router.push('/organization');
          }
        } else {
          router.push('/organization');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchOrg();
  }, [user, orgId, router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#858585]" /></div>;
  }
  
  if (!org) return null;

  return <OrgDetail initialOrg={org} />;
}
