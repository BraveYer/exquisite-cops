'use client';

export const CLUB_TAG_CSS = `
.club-tag-cyan { background: linear-gradient(135deg,#22d3ee,#3b82f6) !important; color:#fff !important; }
.club-tag-fire { background: linear-gradient(135deg,#f59e0b,#ef4444) !important; color:#fff !important; }
.club-tag-gold { background: linear-gradient(135deg,#fde68a,#f59e0b) !important; color:#3a2708 !important; box-shadow: 0 0 12px rgba(245,158,11,.45); }
.club-tag-prism { background: linear-gradient(90deg,#ff4dd2,#22d3ee,#ffe14d,#ff4dd2) !important; background-size:300% 100% !important; color:#fff !important; animation: clubprism 4s linear infinite; }
@keyframes clubprism { to { background-position: 300% 0; } }
`;

export function ClubTagStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CLUB_TAG_CSS }} />;
}

const MAP: Record<string, string> = {
  tag_cyan: 'club-tag-cyan',
  tag_fire: 'club-tag-fire',
  tag_gold: 'club-tag-gold',
  tag_prism: 'club-tag-prism',
};

export function clubTagClass(id?: string | null): string {
  return id ? MAP[id] || '' : '';
}
