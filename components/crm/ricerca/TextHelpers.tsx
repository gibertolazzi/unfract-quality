import { useTranslation } from '@/contexts/TranslationContext';
import React from 'react';

export function Formattato({ testo }: { testo: string }) {
  const { t } = useTranslation();
  if (!testo) return null;
  const parts = testo.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        return p;
      })}
    </>
  );
}

export function Paragrafi({ testo, className, style }: { testo: string, className?: string, style?: React.CSSProperties }) {
  if (!testo) return null;
  const blocks = testo.split(/\n\n+/);
  return (
    <>
      {blocks.map((b, i) => (
        <p key={i} className={className} style={style}>
          <Formattato testo={b} />
        </p>
      ))}
    </>
  );
}
