import React, { useEffect, useState, useRef } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { activeMembers } from '@/lib/orgMembers';

interface MentionDropdownProps {
  value: string;
  cursorPosition: number;
  onSelect: (newValue: string, newCursorPos: number, rawTag?: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  position?: 'top' | 'bottom';
}

export function MentionDropdown({ value, cursorPosition, onSelect, anchorRef, position = 'bottom' }: MentionDropdownProps) {
  const { organizations } = useOrganization();
  const { activeProject } = useProject();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchStart, setMatchStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionType, setMentionType] = useState<'user'|'task'|'doc'|'meeting'|'command'>('user');
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);

  // Carica i membri una volta
  useEffect(() => {
    const orgIds = activeProject?.organizationIds || [];
    const projectOrgs = organizations.filter(org => orgIds.includes(org.id));
    const members = projectOrgs.flatMap(org => activeMembers(org.members)).reduce((acc, current) => {
      const x = acc.find((item: any) => item.uid === current.uid);
      return !x ? acc.concat([current]) : acc;
    }, [] as any[]);
    if (mentionType === 'user') {
      setItems(members);
    }
  }, [activeProject, organizations, mentionType]);

  // Carica dal db quando il tipo cambia
  useEffect(() => {
    if (mentionType === 'command') {
      setItems([
        { id: 'task', title: 'Allega Task (/task)', prefix: '/task ' },
        { id: 'doc', title: 'Allega Documentazione (/doc)', prefix: '/doc ' },
        { id: 'meet', title: 'Allega Meeting (/meet)', prefix: '/meet ' }
      ]);
      return;
    }

    if (!activeProject || mentionType === 'user') return;
    
    const fetchData = async () => {
      try {
        let q;
        if (mentionType === 'task') {
          q = query(collection(db, 'tasks'), where('projectId', '==', activeProject.id));
        } else if (mentionType === 'doc') {
          q = query(collection(db, 'documents'), where('projectId', '==', activeProject.id));
        } else if (mentionType === 'meeting') {
          q = query(collection(db, 'meetings'), where('projectId', '==', activeProject.id));
        }
        
        if (q) {
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setItems(data);
        }
      } catch (err) {
        console.error("Error fetching mentions data", err);
      }
    };
    fetchData();
  }, [mentionType, activeProject]);

  useEffect(() => {
    if (searchQuery === '') {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(item => {
        if (mentionType === 'user') return item.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
        return item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.name?.toLowerCase().includes(searchQuery.toLowerCase());
      }));
    }
  }, [searchQuery, items, mentionType]);

  useEffect(() => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    
    const userMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.]*)$/);
    const taskMatch = textBeforeCursor.match(/\/task\s+([a-zA-Z0-9_\-\.]*)$/);
    const docMatch = textBeforeCursor.match(/\/doc\s+([a-zA-Z0-9_\-\.]*)$/);
    const meetMatch = textBeforeCursor.match(/\/meet\s+([a-zA-Z0-9_\-\.]*)$/);
    const cmdMatch = textBeforeCursor.match(/\/(?!task\s|doc\s|meet\s)([a-zA-Z0-9_]*)$/);
    
    let match = null;
    if (userMatch) { match = userMatch; setMentionType('user'); }
    else if (taskMatch) { match = taskMatch; setMentionType('task'); }
    else if (docMatch) { match = docMatch; setMentionType('doc'); }
    else if (meetMatch) { match = meetMatch; setMentionType('meeting'); }
    else if (cmdMatch) { match = cmdMatch; setMentionType('command'); }

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
      if (!isOpen || filteredItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        handleSelect(item);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredItems, selectedIndex]);

  const handleSelect = (item: any) => {
    let rawTag = '';
    let tag = '';
    let id = item.id;
    
    if (mentionType === 'command') {
      const newValue = value.slice(0, matchStart) + item.prefix + value.slice(cursorPosition);
      const newCursorPos = matchStart + item.prefix.length;
      onSelect(newValue, newCursorPos, undefined);
      setIsOpen(false);
      return;
    }
    
    if (mentionType === 'user') {
      rawTag = (item.displayName || 'Utente').replace(/\s+/g, '');
      tag = `@${rawTag}`;
      id = item.uid;
    } else if (mentionType === 'task') {
      rawTag = (item.title || 'Task').replace(/\s+/g, '-');
      tag = `/task ${rawTag}`;
    } else if (mentionType === 'doc') {
      rawTag = (item.title || 'Doc').replace(/\s+/g, '-');
      tag = `/doc ${rawTag}`;
    } else if (mentionType === 'meeting') {
      rawTag = (item.name || item.title || 'Meeting').replace(/\s+/g, '-');
      tag = `/meet ${rawTag}`;
    }
    
    const newValue = value.slice(0, matchStart) + tag + ' ' + value.slice(cursorPosition);
    const newCursorPos = matchStart + tag.length + 1;
    
    onSelect(newValue, newCursorPos, JSON.stringify({ type: mentionType, id, name: rawTag, fullItem: item }));
    setIsOpen(false);
  };

  if (!isOpen || filteredItems.length === 0 || !anchorRef.current) return null;

  // Renderizza il dropdown (posizionato in modo assoluto rispetto al container più vicino con position: relative)
  return (
    <div className={`absolute z-[100] w-64 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden text-sm ${position === 'top' ? 'bottom-full mb-1 left-0' : 'mt-1'}`}>
      <div className="px-3 py-2 border-b border-white/5 bg-white/5">
        <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">
          {mentionType === 'command' ? 'Seleziona Comando' : mentionType === 'user' ? 'Menziona Utente' : mentionType === 'task' ? 'Allega Task' : mentionType === 'doc' ? 'Allega Doc' : 'Allega Meeting'}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
        {filteredItems.map((item, idx) => (
          <div
            key={item.uid || item.id}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(item);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              idx === selectedIndex ? 'bg-[#006AFF]/20 text-[#00A6FF]' : 'text-white/80 hover:bg-white/5'
            }`}
          >
            {mentionType === 'user' ? (
              <UserAvatar
                src={item.photoURL}
                name={item.displayName}
                initials={item.initials}
                className="w-6 h-6 rounded-full bg-[#006AFF] flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
                imageClassName="w-full h-full object-cover"
              />
            ) : mentionType === 'command' ? (
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[#858585] shrink-0 font-bold">
                /
              </div>
            ) : (
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[#858585] shrink-0">
                {mentionType === 'task' ? '#' : mentionType === 'doc' ? 'D' : 'M'}
              </div>
            )}
            <span className="truncate">{item.displayName || item.title || item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
