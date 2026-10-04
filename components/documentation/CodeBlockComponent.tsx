import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Copy, Check } from 'lucide-react';

export function CodeBlockComponent({ node, updateAttributes, extension }: any) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(node.textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <NodeViewWrapper className="relative my-4 rounded-xl overflow-hidden bg-[#1A1A1A] border border-white/10 group">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0E0E0E] border-b border-white/5">
        <select
          contentEditable={false}
          value={node.attrs.language || 'plaintext'}
          onChange={(event) => updateAttributes({ language: event.target.value })}
          className="bg-transparent text-xs text-white/50 outline-none cursor-pointer hover:text-white transition-colors"
        >
          <option value="plaintext">Auto</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="python">Python</option>
          <option value="bash">Bash</option>
          <option value="json">JSON</option>
          <option value="sql">SQL</option>
          <option value="markdown">Markdown</option>
        </select>
        <button
          contentEditable={false}
          onClick={copyToClipboard}
          className="text-white/50 hover:text-white transition-colors flex items-center justify-center p-1"
          title="Copia codice"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="!m-0 !bg-transparent !p-4 custom-scrollbar overflow-x-auto text-[13px] leading-relaxed">
        <NodeViewContent as={"code" as any} className={`language-${node.attrs.language || 'plaintext'}`} />
      </pre>
    </NodeViewWrapper>
  );
}
