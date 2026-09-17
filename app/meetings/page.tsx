"use client";

import React, { useEffect, useState } from 'react';
import { MeetingList } from '@/components/unfract/meetings/MeetingList';
import { subscribeToMeetings } from '@/lib/meetings';
import { Meeting } from '@/components/unfract/meetings/types';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Loader2 } from 'lucide-react';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { activeProjectId } = useProject();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !activeProjectId) {
      setMeetings([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    let isSubscribed = true;
    const unsubscribe = subscribeToMeetings(activeProjectId, (docs) => {
      if (isSubscribed) {
        setMeetings(docs);
        setIsLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      // Delay unsubscribe to avoid Firebase AbortError during React StrictMode double-render
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
      <MeetingList meetings={meetings} onMeetingAdded={() => {}} />
    </div>
  );
}
