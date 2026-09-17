"use client";

import React, { useRef, useEffect, useState } from 'react';
import { parseMentionsToHtml } from '@/lib/parseMentions';
import { MentionDropdown } from '@/components/unfract/shared/MentionDropdown';

interface ContentEditableBlockProps {
  id: string;
  type: string;
  initialContent: string;
  onChange: (id: string, content: string, e?: React.FormEvent<HTMLDivElement>) => void;
  onBlur: (id: string, content: string) => void;
  onFocus?: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}

export const ContentEditableBlock = React.memo(({ 
  id, 
  type, 
  initialContent, 
  onChange, 
  onBlur, 
  onFocus,
  onKeyDown,
  className,
}: ContentEditableBlockProps) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mention State
  const [mentionValue, setMentionValue] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [mentionCoords, setMentionCoords] = useState<{ top: number, left: number } | null>(null);

  useEffect(() => {
    // Only update innerHTML if it completely diverges and we are not currently focused
    // This prevents cursor jumping while typing but syncs when loaded
    if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
      if (contentEditableRef.current.innerHTML !== initialContent) {
        contentEditableRef.current.innerHTML = initialContent;
      }
    }
  }, [initialContent]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    onChange(id, html, e);

    // Update mention logic based on raw text before caret
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      // If we are typing inside a text node
      if (textNode.nodeType === Node.TEXT_NODE) {
        const textBeforeCursor = textNode.textContent?.slice(0, range.startOffset) || '';
        setMentionValue(textBeforeCursor);
        setMentionCursorPos(textBeforeCursor.length);

        // Calculate coordinates
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          setMentionCoords({
            top: rect.bottom - containerRect.top + 5,
            left: rect.left - containerRect.left
          });
        }
      } else {
        setMentionCoords(null);
        setMentionValue('');
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    const parsedHtml = parseMentionsToHtml(html);
    if (html !== parsedHtml) {
      e.currentTarget.innerHTML = parsedHtml;
    }
    onBlur(id, parsedHtml);
  };

  const handleMentionSelect = (newValue: string, newCursorPos: number, rawTag?: string) => {
    if (!contentEditableRef.current || !rawTag) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent || '';
      const textBeforeCursor = text.slice(0, range.startOffset);
      const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.]*)$/);
      
      if (match) {
        // Find the index of the @ symbol
        const atIndex = match.index!;
        
        // Split the text node
        const textBeforeAt = text.slice(0, atIndex);
        const textAfterCursor = text.slice(range.startOffset);
        
        // Create the mention span
        const span = document.createElement('span');
        span.className = 'inline-flex items-center gap-1 bg-[#006AFF]/10 text-[#006AFF] px-1.5 py-0.5 rounded-md text-[13px] font-medium mx-1';
        span.dataset.uid = 'temp'; // In real app, we should get uid from MentionDropdown
        span.contentEditable = 'false';
        span.textContent = `@${rawTag}`;
        
        // Update DOM
        textNode.textContent = textBeforeAt;
        const afterNode = document.createTextNode('\u00A0' + textAfterCursor); // non breaking space after
        
        // Insert nodes
        if (textNode.parentNode) {
          if (textNode.nextSibling) {
            textNode.parentNode.insertBefore(span, textNode.nextSibling);
            textNode.parentNode.insertBefore(afterNode, span.nextSibling);
          } else {
            textNode.parentNode.appendChild(span);
            textNode.parentNode.appendChild(afterNode);
          }
        }
        
        // Move caret after the space
        const newRange = document.createRange();
        newRange.setStart(afterNode, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // Trigger save
        handleInput({ currentTarget: contentEditableRef.current } as any);
      }
    }
    
    // Close dropdown
    setMentionCoords(null);
    setMentionValue('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        ref={contentEditableRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className={`empty:before:content-["Premi_'/'_per_i_comandi_o_inizia_a_scrivere..."] empty:before:text-[#858585] empty:before:pointer-events-none cursor-text outline-none ${className || ''}`}
      />
      {mentionCoords && (
        <div style={{ position: 'absolute', top: mentionCoords.top, left: mentionCoords.left, zIndex: 50 }}>
          <MentionDropdown 
            value={mentionValue} 
            cursorPosition={mentionCursorPos} 
            onSelect={handleMentionSelect} 
            anchorRef={contentEditableRef}
          />
        </div>
      )}
    </div>
  );
});

ContentEditableBlock.displayName = 'ContentEditableBlock';
