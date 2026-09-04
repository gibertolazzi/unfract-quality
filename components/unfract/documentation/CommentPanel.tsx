import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { Comment } from './types';

interface CommentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (text: string) => void;
  blockTextPreview?: string;
}

export function CommentPanel({ isOpen, onClose, comments, onAddComment, blockTextPreview }: CommentPanelProps) {
  const [newComment, setNewComment] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment('');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#0E0E0E] border-l border-white/10 shadow-2xl z-50 flex flex-col transform transition-transform">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-[16px] font-medium text-white">Commenti</h3>
        <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors hover:bg-white/5 rounded-full">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 border-b border-white/5 bg-white/[0.02]">
        <p className="text-[13px] text-white/40 italic line-clamp-3">
          "{blockTextPreview}"
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {comments.length === 0 ? (
          <div className="text-white/40 text-[14px] text-center mt-8">
            Nessun commento su questo blocco.
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex flex-col gap-1 p-3 bg-white/5 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-medium text-white/90">{c.author}</span>
                <span className="text-[11px] text-white/40">{c.timestamp}</span>
              </div>
              <p className="text-[14px] text-white/70">{c.text}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 flex gap-2 items-center bg-[#0E0E0E]">
        <input 
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Aggiungi un commento..."
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-[14px] text-white outline-none focus:border-white/30 transition-colors"
        />
        <button 
          type="submit"
          disabled={!newComment.trim()}
          className="p-2.5 bg-[#006AFF] rounded-full text-white hover:bg-[#0055CC] transition-colors disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
