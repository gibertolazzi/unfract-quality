import React, { useEffect, useState, useRef } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';

interface MentionDropdownProps {
  value: string;
  cursorPosition: number;
  onSelect: (newValue: string, newCursorPos: number, rawTag?: string) => void;
  anchorRef: React.RefObject<HTMLElement>;
  position?: 'top' | 'bottom';
}

export function MentionDropdown({ value, cursorPosition, onSelect, anchorRef, position = 'bottom' }: MentionDropdownProps) {
  const { organizations } = useOrganization();
  const { activeProject } = useProject();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchStart, setMatchStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Trova i membri di tutte le organizzazioni associate al progetto e deduplicali
  const orgIds = activeProject?.organizationIds || [];
  const projectOrgs = organizations.filter(org => orgIds.includes(org.id));
  
  // Flatten and deduplicate members by uid
  const members = projectOrgs.flatMap(org => org.members || []).reduce((acc, current) => {
    const x = acc.find((item: any) => item.uid === current.uid);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as any[]);

  // Filtra i membri in base alla ricerca
  const filteredMembers = members.filter(m => 
    m.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    // Cerchiamo la parola corrente sotto il cursore
    const textBeforeCursor = value.slice(0, cursorPosition);
    
    // RegEx per trovare @seguita da caratteri non spazi alla fine della stringa
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.]*)$/);
    
    if (match) {
      setSearchQuery(match[1]);
      setMatchStart(match.index!);
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [value, cursorPosition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || filteredMembers.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelect(filteredMembers[selectedIndex].displayName || 'Utente');
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredMembers, selectedIndex]);

  const handleSelect = (displayName: string) => {
    const rawTag = displayName.replace(/\s+/g, '');
    const tag = `@${rawTag}`;
    
    const newValue = value.slice(0, matchStart) + tag + ' ' + value.slice(cursorPosition);
    const newCursorPos = matchStart + tag.length + 1;
    
    onSelect(newValue, newCursorPos, rawTag);
    setIsOpen(false);
  };

  if (!isOpen || filteredMembers.length === 0 || !anchorRef.current) return null;

  // Renderizza il dropdown (posizionato in modo assoluto rispetto al container più vicino con position: relative)
  return (
    <div className={`absolute z-[100] w-64 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden text-sm ${position === 'top' ? 'bottom-full mb-1 left-0' : 'mt-1'}`}>
      <div className="px-3 py-2 border-b border-white/5 bg-white/5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Menziona Utente</span>
      </div>
      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
        {filteredMembers.map((member, idx) => (
          <div
            key={member.uid}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(member.displayName || 'Utente');
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              idx === selectedIndex ? 'bg-[#006AFF]/20 text-[#00A6FF]' : 'text-white/80 hover:bg-white/5'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-[#006AFF] flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden">
              {member.photoURL ? (
                <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
              ) : (
                member.initials || 'U'
              )}
            </div>
            <span className="truncate">{member.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
