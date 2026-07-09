import React from 'react';

// Shared atmospheric backdrop used across the logged-in pages:
// cyan + violet glows with a faint grid that fades out toward the bottom.
export default function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(45%_35%_at_15%_-5%,rgba(34,211,238,0.13),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(45%_35%_at_85%_3%,rgba(168,85,247,0.13),transparent_70%)]" />
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(70% 50% at 50% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(70% 50% at 50% 0%, #000 30%, transparent 80%)',
        }}
      />
    </div>
  );
}
