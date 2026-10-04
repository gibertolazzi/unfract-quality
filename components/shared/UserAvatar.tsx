'use client';

import React from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  initials?: string | null;
  alt?: string;
  className: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  src,
  name,
  initials,
  alt,
  className,
  imageClassName = 'h-full w-full object-cover',
  fallbackClassName,
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const imageSrc = src?.trim();
  const fallback = initials?.trim() || name?.trim()?.charAt(0).toUpperCase() || 'U';
  const showImage = Boolean(imageSrc) && failedSrc !== imageSrc;

  return (
    <div className={className} aria-label={alt || name || undefined}>
      {showImage ? (
        <img
          src={imageSrc}
          alt={alt || name || 'Avatar'}
          className={imageClassName}
          onError={() => setFailedSrc(imageSrc || null)}
        />
      ) : (
        <span className={fallbackClassName} aria-hidden="true">{fallback}</span>
      )}
    </div>
  );
}
