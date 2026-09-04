"use client";

import React, { useState } from 'react';
import { DocIcon } from './DocIcon';
import { Document } from './types';
import { useRouter } from 'next/navigation';

interface DocCardProps {
  doc: Document;
}

export function DocCard({ doc }: DocCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  return (
    <div 
      onClick={() => router.push(`/documentation/${doc.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group w-full h-[117px] bg-[#0E0E0E] border border-white/10 rounded-[32px] flex flex-col justify-center px-8 cursor-pointer hover:bg-[#121212] transition-colors relative"
    >
      {/* Container to give some visual feedback or glow if wanted */}
      <div className="flex items-center gap-4">
        <DocIcon isHovered={isHovered} />
        
        <div className="flex flex-col">
          <h3 className="text-[20px] font-medium text-white tracking-wide">
            {doc.title}
          </h3>
          <p className="text-[13px] text-white/50 font-sans mt-1">
            Manager: {doc.manager} - {doc.date} - {doc.company}
          </p>
        </div>
      </div>
    </div>
  );
}
