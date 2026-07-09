'use client';

import React from 'react';

// Renders message text with @mentions highlighted.
export function MessageText({ text }: { text: string }) {
  const parts = String(text || '').split(/(@[A-Za-z0-9_]{2,20})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^@[A-Za-z0-9_]{2,20}$/.test(part) ? (
          <span key={i} className="font-bold text-cyan-400">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
