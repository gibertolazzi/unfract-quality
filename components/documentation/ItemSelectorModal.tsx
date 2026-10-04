import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Search, X, Loader2, FileText, Calendar, Users, CheckSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ItemSelectorModalProps {
  isOpen: boolean;
  type: 'task' | 'event' | 'meeting' | 'document';
  projectId?: string;
  onClose: () => void;
  onSelect: (item: { id: string; title: string; type: string }) => void;
}

export function ItemSelectorModal({ isOpen, type, projectId, onClose, onSelect }: ItemSelectorModalProps) {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        let q;
        if (type === 'task') {
          q = projectId 
            ? query(collection(db, 'tasks'), where('projectId', '==', projectId))
            : query(collection(db, 'tasks'));
        } else if (type === 'event') {
          // Calendar events for user
          q = query(collection(db, 'users', user.uid, 'events'));
        } else if (type === 'meeting') {
          q = projectId
            ? query(collection(db, 'meetings'), where('projectId', '==', projectId))
            : query(collection(db, 'meetings'));
        } else if (type === 'document') {
          q = projectId
            ? query(collection(db, 'documentation'), where('projectId', '==', projectId))
            : query(collection(db, 'documentation'));
        }

        if (q) {
          const snapshot = await getDocs(q);
          const fetchedItems = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || data.name || 'Senza titolo'
            };
          });
          setItems(fetchedItems);
        }
      } catch (error) {
        console.error('Error fetching items for selector:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [isOpen, type, projectId, user]);

  if (!isOpen) return null;

  const filteredItems = items.filter(item => item.title.toLowerCase().includes(search.toLowerCase()));

  const config = {
    task: { icon: CheckSquare, title: 'Seleziona Attività' },
    event: { icon: Calendar, title: 'Seleziona Evento' },
    meeting: { icon: Users, title: 'Seleziona Meeting' },
    document: { icon: FileText, title: 'Seleziona Documento' },
  };

  const Icon = config[type].icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Icon size={18} className="text-[#00A6FF]" />
            {config[type].title}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-white/10 relative">
          <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-white/40" />
          <input 
            type="text" 
            placeholder="Cerca..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-[#006AFF] transition-colors"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto p-2 custom-scrollbar flex-1 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-white/50">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/50 text-sm">
              Nessun elemento trovato.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect({ id: item.id, title: item.title, type });
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group flex items-center justify-between"
                >
                  <span className="text-white/90 font-medium text-sm truncate pr-4">{item.title}</span>
                  <span className="text-xs text-white/30 group-hover:text-white/50">Seleziona</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
