'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Shield, Crown, Loader2, ArrowLeft, LogOut, Trash2, UserMinus, ChevronUp, ChevronDown,
  Check, X, Pencil, Users, UserPlus, Image as ImageIcon, Megaphone, Mail, Sparkles,
} from 'lucide-react';
import { getTier } from '../../../lib/tiers';
import PageBackground from '../../../components/PageBackground';
import ClubChat from '../../../components/ClubChat';
import { CosmeticStyles, nameClass, frameClass } from '../../../components/ProfileCosmetics';
import { ClubTagStyles, clubTagClass } from '../../../components/ClubCosmetics';
import { CLUB_TAG_STYLES, getClubStyle, CLUB_RARITY_COLOR } from '../../../lib/clubShop';

type Member = { accountId: number | null; copsName: string; avatar: string | null; elo: number; nameStyle?: string | null; frame?: string | null; role: 'leader' | 'officer' | 'member'; joinedAt: string | null };
type Application = { accountId: number | null; copsName: string; avatar: string | null; elo: number; at: string | null };
type Friend = { accountId: number | null; copsName: string; avatar: string | null; elo: number };
type ClanData = {
  clan: { id: string; name: string; tag: string; description: string; color: string | null; banner: string | null; announce: string; memberCount: number; avgElo: number; recruiting?: boolean; tagStyle?: string | null; createdAt: string | null };
  stats?: { totalWins: number; totalLosses: number; totalGames: number; winRate: number; bestMember: { accountId: number | null; copsName: string; wins: number; elo: number } | null; level: number; xp: number; xpInLevel: number; xpForNext: number; progress: number };
  roster: Member[];
  myRole: 'leader' | 'officer' | 'member' | null;
  applied: boolean;
  myInvite: boolean;
  inAnotherClan: boolean;
  applications: Application[];
  events?: { type: string; actorName: string; targetName: string | null; createdAt: string | null }[];
  ownedStyles?: string[];
};

const DEFAULT_COLOR = '#a78bfa';

function Avatar({ src, name, elo, size = 40, frame = '' }: { src: string | null; name: string; elo: number; size?: number; frame?: string }) {
  const color = getTier(elo).color;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`rounded-full object-cover ${frame}`} style={{ width: size, height: size, ...(frame ? {} : { boxShadow: `0 0 0 2px ${color}55` }) }} />;
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-white/10 font-black ${frame}`} style={{ width: size, height: size, color }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'leader') return <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-400"><Crown size={12} /> Leader</span>;
  if (role === 'officer') return <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-cyan-300"><Shield size={12} /> Officer</span>;
  return <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Member</span>;
}

export default function ClanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<ClanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [editBanner, setEditBanner] = useState('');
  const [editAnnounce, setEditAnnounce] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [inviting, setInviting] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<Friend[]>([]);
  const [invited, setInvited] = useState<number[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/clans?id=${id}`, { cache: 'no-store' });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      const d = r.ok ? await r.json() : null;
      if (d?.clan) {
        setData(d);
        setEditName(d.clan.name);
        setEditDesc(d.clan.description);
        setEditColor(d.clan.color || DEFAULT_COLOR);
        setEditBanner(d.clan.banner || '');
        setEditAnnounce(d.clan.announce || '');
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (payload: any, opts: { navigateAway?: boolean } = {}) => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/clans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, clanId: id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d?.error || 'Action failed.');
        return d;
      }
      if (opts.navigateAway || d.disbanded) {
        router.push('/clans');
        return d;
      }
      setEditing(false);
      await load();
      return d;
    } catch {
      setErr('Action failed.');
      return {};
    } finally {
      setBusy(false);
    }
  };

  const uploadBanner = async (file: File) => {
    setUploadingBanner(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.url) setErr(d?.error || (r.status === 404 ? 'Upload route not found — restart the dev server.' : 'Upload failed.'));
      else setEditBanner(d.url);
    } catch {
      setErr('Upload failed.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const openInvite = async () => {
    setInviting((v) => !v);
    if (inviting) return;
    try {
      const r = await fetch('/api/friends', { cache: 'no-store' });
      const d = r.ok ? await r.json() : { friends: [] };
      const inClub = new Set((data?.roster || []).map((m) => m.accountId));
      setInviteFriends((d.friends || []).filter((f: any) => f.accountId != null && !inClub.has(f.accountId)));
    } catch {
      /* ignore */
    }
  };

  const doInvite = async (acc: number) => {
    const d = await act({ action: 'invite', accountId: acc });
    if (d && !d.error) setInvited((x) => [...x, acc]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709] text-cyan-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#070709] text-white">
        <PageBackground />
        <div className="relative mx-auto max-w-md px-6 py-24 text-center">
          <Shield size={30} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-black">Club not found</h1>
          <Link href="/clans" className="mt-4 inline-block text-sm font-bold text-cyan-400 hover:text-cyan-300">
            ← Back to clubs
          </Link>
        </div>
      </div>
    );
  }

  const { clan, roster, myRole, applied, myInvite, inAnotherClan, applications } = data;
  const stats = data.stats;
  const events = data.events || [];
  const isLeader = myRole === 'leader';
  const isStaff = myRole === 'leader' || myRole === 'officer';
  const isMember = !!myRole;
  const accent = clan.color || DEFAULT_COLOR;

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <CosmeticStyles />
      <ClubTagStyles />
      <div className="relative mx-auto max-w-3xl px-6 py-8 md:py-12">
        <Link href="/clans" className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-white">
          <ArrowLeft size={16} /> Clubs
        </Link>

        {/* Invite banner (for invitee) */}
        {myInvite && !isMember && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.08] px-4 py-3">
            <Mail size={18} className="text-cyan-300" />
            <p className="flex-1 text-sm font-bold text-white">You've been invited to join this club.</p>
            <button onClick={() => act({ action: 'acceptInvite' })} disabled={busy} className="rounded-full bg-cyan-500 px-4 py-1.5 text-sm font-black text-black hover:bg-cyan-400 disabled:opacity-50">
              Join
            </button>
            <button onClick={() => act({ action: 'declineInvite' })} disabled={busy} className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">
              Decline
            </button>
          </div>
        )}

        {/* Header */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          {clan.banner ? (
            <div className="relative h-32 w-full sm:h-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={clan.banner} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
            </div>
          ) : (
            <div className="h-16 w-full" style={{ background: `linear-gradient(120deg, ${accent}22, transparent)` }} />
          )}

          <div className="p-6 pt-0">
            <div className={`flex items-start gap-4 ${clan.banner ? '-mt-8' : '-mt-8'}`}>
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${clubTagClass(clan.tagStyle)}`} style={{ backgroundColor: `${accent}22`, color: accent, boxShadow: `0 0 0 3px #0b0b0f, 0 0 0 4px ${accent}55` }}>
                [{clan.tag}]
              </div>
              <div className="min-w-0 flex-1 pt-8">
                {editing ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value.slice(0, 32))}
                    className="w-full rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-1.5 text-2xl font-black text-white focus:border-cyan-500/50 focus:outline-none"
                  />
                ) : (
                  <h1 className="text-3xl font-black tracking-tight">{clan.name}</h1>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-widest text-gray-500">
                  <span className="flex items-center gap-1.5"><Users size={13} /> {clan.memberCount} members</span>
                  {stats && <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 normal-case tracking-normal text-violet-300">Lvl {stats.level}</span>}
                  <span>Avg ELO {clan.avgElo}</span>
                  {isStaff ? (
                    <button
                      onClick={() => act({ action: 'edit', recruiting: clan.recruiting === false })}
                      disabled={busy}
                      title="Toggle recruitment"
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 normal-case tracking-normal transition-colors disabled:opacity-50 ${clan.recruiting !== false ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-white/10 text-gray-400 hover:bg-white/15'}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${clan.recruiting !== false ? 'bg-emerald-400' : 'bg-gray-500'}`} /> {clan.recruiting !== false ? 'Recruiting' : 'Closed'}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 normal-case tracking-normal" style={{ color: clan.recruiting !== false ? '#34d399' : '#6b7280' }}>
                      <span className={`h-1.5 w-1.5 rounded-full ${clan.recruiting !== false ? 'bg-emerald-400' : 'bg-gray-500'}`} /> {clan.recruiting !== false ? 'Recruiting' : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description / edit fields */}
            {editing ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="Club description"
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-2 text-sm text-gray-200 focus:border-cyan-500/50 focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                    <span>Color</span>
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                  </label>
                  <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); if (bannerRef.current) bannerRef.current.value = ''; }} />
                  <button onClick={() => bannerRef.current?.click()} disabled={uploadingBanner} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">
                    {uploadingBanner ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} {editBanner ? 'Change banner' : 'Upload banner'}
                  </button>
                  {editBanner ? <button onClick={() => setEditBanner('')} className="text-xs font-bold text-gray-500 hover:text-red-400">Remove banner</button> : null}
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500"><Megaphone size={12} /> Pinned announcement</label>
                  <textarea
                    value={editAnnounce}
                    onChange={(e) => setEditAnnounce(e.target.value.slice(0, 300))}
                    rows={2}
                    placeholder="Shown at the top of club chat (leave empty to clear)"
                    className="w-full resize-none rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-2 text-sm text-gray-200 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>
            ) : clan.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-300">{clan.description}</p>
            ) : null}

            {err ? <p className="mt-3 text-xs font-bold text-red-400">{err}</p> : null}

            {/* Action bar */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {!isMember && !inAnotherClan && !myInvite && session && (
                applied ? (
                  <button onClick={() => act({ action: 'cancelApply' })} disabled={busy} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">
                    Cancel application
                  </button>
                ) : (
                  <button onClick={() => act({ action: 'apply' })} disabled={busy} className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-50">
                    Apply to join
                  </button>
                )
              )}
              {!isMember && inAnotherClan && <p className="text-xs text-gray-500">Leave your current club to join another.</p>}

              {editing && (
                <>
                  <button onClick={() => act({ action: 'edit', name: editName, description: editDesc, color: editColor, banner: editBanner, announce: editAnnounce })} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 disabled:opacity-50">
                    <Check size={14} /> Save
                  </button>
                  <button onClick={() => { setEditing(false); setEditName(clan.name); setEditDesc(clan.description); setEditColor(clan.color || DEFAULT_COLOR); setEditBanner(clan.banner || ''); setEditAnnounce(clan.announce || ''); }} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5">
                    Cancel
                  </button>
                </>
              )}

              {isStaff && !editing && (
                <>
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={openInvite} className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold ${inviting ? 'border-cyan-500/40 text-cyan-300' : 'border-white/15 text-gray-300 hover:bg-white/5'}`}>
                    <UserPlus size={14} /> Invite
                  </button>
                </>
              )}
              {isMember && !editing && (
                <button
                  onClick={() => { if (window.confirm(isLeader ? 'Leave the club? Leadership will pass to an officer.' : 'Leave the club?')) act({ action: 'leave' }, { navigateAway: true }); }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                >
                  <LogOut size={14} /> Leave
                </button>
              )}
              {isLeader && !editing && (
                <button
                  onClick={() => { if (window.confirm('Disband the club for everyone? This cannot be undone.')) act({ action: 'disband' }, { navigateAway: true }); }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Disband
                </button>
              )}
            </div>

            {/* Invite a friend picker */}
            {isStaff && inviting && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-500">Invite a friend</p>
                {inviteFriends.length === 0 ? (
                  <p className="text-xs text-gray-600">No friends available to invite. (They must be your friend and not already in a club.)</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {inviteFriends.map((f) => {
                      const done = f.accountId != null && invited.includes(f.accountId);
                      return (
                        <div key={f.accountId} className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-white/[0.04]">
                          <Avatar src={f.avatar} name={f.copsName} elo={f.elo} size={28} />
                          <span className="flex-1 truncate text-sm font-bold text-white">{f.copsName}</span>
                          {done ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400"><Check size={13} /> Invited</span>
                          ) : (
                            <button onClick={() => f.accountId != null && doInvite(f.accountId)} disabled={busy} className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50">
                              Invite
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Club stats */}
        {stats && stats.totalGames > 0 && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.08] to-transparent p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-xs font-black text-white">{stats.level}</span>
                  Club level {stats.level}
                </span>
                <span className="text-[11px] font-bold text-gray-500">{stats.xpInLevel} / {stats.xpForNext} XP to level {stats.level + 1}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.round(stats.progress * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Wins</p>
              <p className="mt-1 text-2xl font-black text-emerald-400">{stats.totalWins}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Win rate</p>
              <p className="mt-1 text-2xl font-black text-white">{stats.winRate}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Games</p>
              <p className="mt-1 text-2xl font-black text-white">{stats.totalGames}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Top member</p>
              {stats.bestMember ? (
                <Link href={`/profile/${stats.bestMember.accountId}`} className="mt-1 block truncate text-sm font-black text-amber-300 hover:text-amber-200">
                  {stats.bestMember.copsName}
                  <span className="block text-[11px] font-bold text-gray-500">{stats.bestMember.wins} wins</span>
                </Link>
              ) : (
                <p className="mt-1 text-sm text-gray-600">—</p>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Club tag styles (leader) */}
        {isLeader && (
          <div className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400"><Sparkles size={15} className="text-violet-400" /> Club tag styles</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button onClick={() => act({ action: 'setStyle', styleId: null })} disabled={busy || !clan.tagStyle} className={`rounded-xl border px-2 py-3 text-center transition-colors ${!clan.tagStyle ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                  <span className="inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-black" style={{ backgroundColor: `${accent}22`, color: accent }}>[{clan.tag}]</span>
                  <p className="mt-2 text-[11px] font-bold text-gray-400">Default</p>
                </button>
                {CLUB_TAG_STYLES.map((s) => {
                  const owned = (data.ownedStyles || []).includes(s.id);
                  const equipped = clan.tagStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { if (!owned && !window.confirm(`Buy "${s.name}" for ${s.price} EP?`)) return; act({ action: owned ? 'setStyle' : 'buyStyle', styleId: s.id }); }}
                      disabled={busy || equipped}
                      className={`rounded-xl border px-2 py-3 text-center transition-colors ${equipped ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'}`}
                    >
                      <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-black ${clubTagClass(s.id)}`}>[{clan.tag}]</span>
                      <p className="mt-2 truncate text-[11px] font-bold text-white">{s.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: CLUB_RARITY_COLOR[s.rarity] }}>{equipped ? 'Equipped' : owned ? 'Equip' : `${s.price} EP`}</p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-gray-600">Bought with your personal EP. Owned styles can be switched for free.</p>
            </div>
          </div>
        )}

        {/* Applications */}
        {isStaff && applications.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-gray-400">Applications ({applications.length})</h2>
            <div className="space-y-2">
              {applications.map((a) => (
                <div key={a.accountId ?? a.copsName} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <Avatar src={a.avatar} name={a.copsName} elo={a.elo} size={36} />
                  <Link href={`/profile/${a.accountId}`} className="min-w-0 flex-1 truncate font-bold text-white hover:text-cyan-400">
                    {a.copsName}
                    <span className="ml-2 text-xs font-normal text-gray-500">{a.elo} ELO</span>
                  </Link>
                  <button onClick={() => act({ action: 'approve', accountId: a.accountId })} disabled={busy} className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50">
                    <Check size={13} /> Accept
                  </button>
                  <button onClick={() => act({ action: 'decline', accountId: a.accountId })} disabled={busy} className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/10 disabled:opacity-50">
                    <X size={13} /> Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roster */}
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-gray-400">Roster</h2>
          <div className="space-y-1.5">
            {roster.map((m) => {
              const canManage = isStaff && m.role !== 'leader' && m.accountId != null;
              const iCanKick = canManage && !(myRole === 'officer' && m.role === 'officer');
              return (
                <div key={m.accountId ?? m.copsName} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <Avatar src={m.avatar} name={m.copsName} elo={m.elo} size={40} frame={frameClass(m.frame)} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${m.accountId}`} className="truncate font-bold text-white hover:text-cyan-400">
                      <span className={nameClass(m.nameStyle)}>{m.copsName}</span>
                    </Link>
                    <div className="flex items-center gap-3">
                      <RoleBadge role={m.role} />
                      <span className="text-[11px] font-bold" style={{ color: getTier(m.elo).color }}>{m.elo}</span>
                    </div>
                  </div>

                  {isLeader && m.role !== 'leader' && m.accountId != null && (
                    <div className="flex items-center gap-1">
                      {m.role === 'member' ? (
                        <button onClick={() => act({ action: 'promote', accountId: m.accountId })} disabled={busy} title="Promote to officer" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-cyan-300 disabled:opacity-50">
                          <ChevronUp size={16} />
                        </button>
                      ) : (
                        <button onClick={() => act({ action: 'demote', accountId: m.accountId })} disabled={busy} title="Demote to member" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-gray-200 disabled:opacity-50">
                          <ChevronDown size={16} />
                        </button>
                      )}
                      <button onClick={() => { if (window.confirm(`Make ${m.copsName} the new leader? You'll become an officer.`)) act({ action: 'transfer', accountId: m.accountId }); }} disabled={busy} title="Transfer leadership" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-amber-400 disabled:opacity-50">
                        <Crown size={15} />
                      </button>
                      <button onClick={() => act({ action: 'kick', accountId: m.accountId })} disabled={busy} title="Kick" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-red-400 disabled:opacity-50">
                        <UserMinus size={16} />
                      </button>
                    </div>
                  )}

                  {!isLeader && iCanKick && m.role === 'member' && (
                    <button onClick={() => act({ action: 'kick', accountId: m.accountId })} disabled={busy} title="Kick" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-red-400 disabled:opacity-50">
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity log */}
        {events.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-gray-400">Activity</h2>
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              {events.map((e, i) => {
                const t = e.type;
                const color = t === 'join' ? '#34d399' : t === 'leave' ? '#9ca3af' : t === 'kick' ? '#f87171' : t === 'promote' ? '#22d3ee' : t === 'demote' ? '#f59e0b' : '#a78bfa';
                const text =
                  t === 'join' ? `${e.actorName} joined the club`
                  : t === 'leave' ? `${e.actorName} left the club`
                  : t === 'kick' ? `${e.targetName} was removed by ${e.actorName}`
                  : t === 'promote' ? `${e.targetName} was promoted to officer by ${e.actorName}`
                  : t === 'demote' ? `${e.targetName} was demoted by ${e.actorName}`
                  : t === 'transfer' ? `${e.actorName} passed leadership to ${e.targetName}`
                  : `${e.actorName} updated the club`;
                const secs = e.createdAt ? Math.floor((Date.now() - new Date(e.createdAt).getTime()) / 1000) : -1;
                const when = secs < 0 ? '' : secs < 60 ? 'now' : secs < 3600 ? `${Math.floor(secs / 60)}m` : secs < 86400 ? `${Math.floor(secs / 3600)}h` : `${Math.floor(secs / 86400)}d`;
                return (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="min-w-0 flex-1 truncate text-gray-300">{text}</span>
                    <span className="shrink-0 text-[11px] text-gray-600">{when}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isMember && <ClubChat clubId={id} image={session?.user?.image} announce={clan.announce} />}
      </div>
    </div>
  );
}
