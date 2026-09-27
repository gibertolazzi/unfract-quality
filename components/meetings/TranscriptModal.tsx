import React from 'react';
import { X, Download } from 'lucide-react';

interface TranscriptModalProps {
  transcript: string;
  onClose: () => void;
  title: string;
}

export function TranscriptModal({ transcript, onClose, title }: TranscriptModalProps) {
  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([transcript], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Trascrizione - ${title}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-[#0E0E0E] border border-white/10 rounded-[32px] p-8 flex flex-col max-h-[85vh] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute w-[400px] h-[300px] rounded-full blur-[120px] -z-10 -top-[150px] -left-[100px] opacity-10 bg-[#006AFF]" />

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-white">Trascrizione completa</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X size={18} className="text-white/70" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 text-white/80 whitespace-pre-wrap leading-relaxed text-[15px] bg-[#080808] border border-white/5 rounded-3xl p-6">
          {transcript}
        </div>

        <div className="pt-8 mt-4 border-t border-white/5 flex justify-end">
          <button 
            onClick={handleDownload}
            className="h-12 px-6 rounded-2xl bg-[#006AFF] text-white font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Download size={18} />
            Scarica .txt
          </button>
        </div>
      </div>
    </div>
  );
}
