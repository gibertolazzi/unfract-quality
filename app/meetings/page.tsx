"use client";

import React, { useEffect, useState } from 'react';
import { MeetingList } from '@/components/unfract/meetings/MeetingList';
import { getMeetings } from '@/lib/meetings';
import { Meeting } from '@/components/unfract/meetings/types';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Loader2 } from 'lucide-react';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { activeProjectId } = useProject();

  const fetchMeetings = () => {
    if (!activeProjectId) {
      setMeetings([]);
      setIsLoading(false);
      return;
    }
    getMeetings(activeProjectId).then(docs => {
      setMeetings(docs);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    fetchMeetings();
  }, [user, authLoading, activeProjectId]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-white/50" /></div>;
  }

  return (
    <div className="min-h-full">
      <MeetingList meetings={meetings} onMeetingAdded={fetchMeetings} />
    </div>
  );
}
