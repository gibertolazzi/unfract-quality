"use client";

import React, { useEffect, useState } from 'react';
import { DocList } from '@/components/documentation/DocList';
import { subscribeToDocuments } from '@/lib/documentation';
import { Document } from '@/components/documentation/types';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Loader2 } from 'lucide-react';

export default function DocumentationPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { activeProjectId } = useProject();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !activeProjectId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    let isSubscribed = true;
    const unsubscribe = subscribeToDocuments(activeProjectId, (docs) => {
      if (isSubscribed) {
        setDocuments(docs);
        setIsLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      setTimeout(() => {
        if (unsubscribe) unsubscribe();
      }, 100);
    };
  }, [user, authLoading, activeProjectId]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#858585]" /></div>;
  }

  return (
    <div className="min-h-full">
      <DocList documents={documents} />
    </div>
  );
}
