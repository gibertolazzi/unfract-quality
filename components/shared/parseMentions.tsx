import React from 'react';

// Matches @ followed by word characters (including dots and hyphens often found in usernames)
const MENTION_REGEX = /(@[a-zA-Z0-9_\-\.]+)/g;

export function parseMentions(text: string | null | undefined): React.ReactNode[] {
  if (!text) return [];

  const parts = text.split(MENTION_REGEX);

  return parts.map((part, i) => {
    if (part.match(MENTION_REGEX)) {
      return (
        <span 
          key={i} 
          className="inline-block bg-[#006AFF]/15 text-[#00A6FF] font-medium rounded-full px-2 py-0.5 mx-0.5 align-baseline"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
