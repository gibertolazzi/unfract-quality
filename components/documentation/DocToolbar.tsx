import React from 'react';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link, Image as ImageIcon, Type, Code, Quote, CheckSquare, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Editor } from '@tiptap/react';
import { useTranslation } from '@/contexts/TranslationContext';

const FONTS = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Montserrat', value: '"Montserrat", sans-serif' },
  { name: 'Lato', value: '"Lato", sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
];

const SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px'];

export function DocToolbar({ 
  editor,
  onPromptRequest, 
}: { 
  editor: Editor,
  onPromptRequest: (type: 'link' | 'image') => void
}) {
  const preventFocus = (e: React.MouseEvent) => e.preventDefault();
  const { t } = useTranslation();

  if (!editor) return null;

  return (
    <div className="sticky top-0 z-50 bg-[#0A0A0A] border-b border-white/10 p-2 flex items-center gap-1.5 mb-8 rounded-b-2xl shadow-xl overflow-x-auto custom-scrollbar whitespace-nowrap">
      
      {/* Block Type */}
      <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-lg px-2 py-1 mr-2">
        <Type size={14} className="text-[#858585]" />
        <select 
          value={editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
            else editor.chain().focus().setParagraph().run();
          }}
          className="bg-transparent text-white/80 text-sm font-medium outline-none cursor-pointer border-none pl-2"
        >
          <option value="p">{t.documentationUi.paragraph}</option>
          <option value="h2">{t.documentationUi.heading1}</option>
          <option value="h3">{t.documentationUi.heading2}</option>
        </select>
      </div>

      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* Font Family */}
      <select 
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
            editor.chain().focus().setFontFamily?.(val).run();
          } else {
            editor.chain().focus().unsetFontFamily?.().run();
          }
        }}
        value={editor.getAttributes('textStyle').fontFamily || ''}
        className="bg-transparent text-white/80 text-sm outline-none cursor-pointer border border-white/10 rounded px-2 py-1 mr-1"
      >
        <option value="">{t.documentationUi.fontDefault}</option>
        {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
      </select>

      {/* Font Size */}
      <select 
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
            (editor.chain().focus() as any).setFontSize?.(val).run();
          } else {
            (editor.chain().focus() as any).unsetFontSize?.().run();
          }
        }}
        value={editor.getAttributes('textStyle').fontSize || ''}
        className="bg-transparent text-white/80 text-sm outline-none cursor-pointer border border-white/10 rounded px-2 py-1 mr-1"
      >
        <option value="">{t.documentationUi.sizeAuto}</option>
        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* Formatting */}
      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('bold') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.bold}>
        <Bold size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('italic') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.italic}>
        <Italic size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('underline') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.underline}>
        <Underline size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('strike') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.strike}>
        <Strikethrough size={16} />
      </button>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('bulletList') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.bulletList}>
        <List size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('orderedList') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.orderedList}>
        <ListOrdered size={16} />
      </button>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('blockquote') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.quote}>
        <Quote size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded-md transition-colors ${editor.isActive('codeBlock') ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70'}`} title={t.documentationUi.code}>
        <Code size={16} />
      </button>
    </div>
  );
}
