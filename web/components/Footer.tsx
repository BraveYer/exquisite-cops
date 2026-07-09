import React from 'react';
import { COMMUNITY } from '../lib/community';

export default function Footer() {
  const links = COMMUNITY.filter(c => c.url && c.url.trim());
  return (
    <footer className="relative border-t border-white/5 bg-[#070709] px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm font-black italic tracking-tighter">
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">EXQUISITE COPS</span>
          <span className="ml-2 font-normal not-italic text-gray-600">· Critical Ops Ranked Hub</span>
        </p>

        {links.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {links.map(c => (
              <a
                key={c.key}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border px-4 py-1.5 text-sm font-bold transition-transform hover:scale-105"
                style={{ color: c.color, borderColor: `${c.color}55`, background: `${c.color}14` }}
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
