import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { CheckSquare, Calendar, Users, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const ReferenceWidgetComponent = (props: any) => {
  const router = useRouter();
  const { type, id, title } = props.node.attrs;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (type === 'task') {
      router.push(`/?highlightTask=${id}`);
    } else if (type === 'event') {
      router.push(`/calendar?eventId=${id}`);
    } else if (type === 'meeting') {
      router.push(`/meetings/${id}`);
    } else if (type === 'document') {
      router.push(`/documentation/${id}`);
    }
  };

  const config: Record<string, { icon: any, color: string, bg: string }> = {
    task: { icon: CheckSquare, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    event: { icon: Calendar, color: 'text-green-400', bg: 'bg-green-400/10' },
    meeting: { icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    document: { icon: FileText, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  };

  const currentConfig = config[type as string] || config.document;
  const Icon = currentConfig.icon;

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle mx-1" contentEditable={false}>
      <span 
        onClick={handleClick}
        className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 ${currentConfig.bg} border border-white/5 shadow-sm`}
      >
        <Icon size={14} className={currentConfig.color} />
        <span className="text-white/90 truncate max-w-[200px]">{title || 'Senza titolo'}</span>
      </span>
    </NodeViewWrapper>
  );
};

export const ReferenceWidget = Node.create({
  name: 'referenceWidget',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      type: {
        default: 'document',
      },
      id: {
        default: null,
      },
      title: {
        default: 'Reference',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="reference"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'reference' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReferenceWidgetComponent);
  },
});
