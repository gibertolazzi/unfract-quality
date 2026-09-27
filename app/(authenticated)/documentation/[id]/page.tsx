"use client";

import React, { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { DocEditor } from '@/components/documentation/DocEditor';
import { getDocumentById } from '@/lib/documentation';
import { Document } from '@/components/documentation/types';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    
    getDocumentById(params.id).then(fetchedDoc => {
      setDoc(fetchedDoc);
      setIsLoading(false);
    });
  }, [params.id, user, authLoading, router]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#858585]" /></div>;
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-xl font-bold mb-2">Documento non trovato</h2>
        <p className="text-[#858585] mb-4">Assicurati di avere i permessi per vederlo.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 rounded-lg">Ricarica</button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <DocEditor doc={doc} />
    </div>
  );
}
