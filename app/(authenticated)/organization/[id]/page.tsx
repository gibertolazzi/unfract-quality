"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrgDetail } from '@/components/organization/OrgDetail';
import { Organization } from '@/components/organization/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { Loader2 } from 'lucide-react';

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.id as string;
  const { user } = useAuth();
  const { setActiveWorkspaceId, activeWorkspaceId } = useWorkspace();
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
            if (activeWorkspaceId !== orgId) {
              setActiveWorkspaceId(orgId);
            }
            
            // Auto-heal: Ensure they have a workspace access grant
            try {
              const { collection, query, where, getDocs, setDoc, serverTimestamp } = await import('firebase/firestore');
              const grantsRef = collection(db, 'access_grants');
              const q = query(
                grantsRef, 
                where('subjectId', '==', user.uid), 
                where('workspaceId', '==', orgId)
              );
              const snap = await getDocs(q);
              if (snap.empty) {
                const grantRef = doc(grantsRef);
                await setDoc(grantRef, {
                  workspaceId: orgId,
                  subjectType: 'user',
                  subjectId: user.uid,
                  resourceType: 'workspace',
                  resourceId: orgId,
                  role: 'member',
                  createdAt: serverTimestamp(),
                });
                console.log("Auto-healed access grant for user");
              }
            } catch (e) {
              console.error("Auto-heal failed", e);
            }
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
