'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Send, ArrowLeft, MessageCircle, Loader2, Users, Plus, X, Settings2, Trash2, LogOut, UserMinus, Check, Crown } from 'lucide-react';
import { getTier } from '../../lib/tiers';
import { CosmeticStyles, nameClass, frameClass } from '../../components/ProfileCosmetics';
import { useReactions, ReactionBar } from '../../components/Reactions';
import { MessageText } from '../../components/MessageText';

type Convo = {
  accountId: number | null;
  copsName: string;
  avatar: string | null;
  elo: number;
  lastText: string;
  lastFromMe: boolean;
  lastAt: string | null;
  unread: number;
};
type Msg = {
  id: string;
  fromMe: boolean;
  fromName: string;
  fromAccountId: number | null;
  fromAvatar: string | null;
  fromElo: number;
  text: string;
  createdAt: string | null;
};
type Friend = { accountId: number | null; copsName: string; avatar: string | null; elo: number };
type GroupItem = {
  id: string;
  name: string;
  memberCount: number;
  avatars: { avatar: string | null; name: string; elo: number }[];
  lastText: string;
  lastFrom: string;
  lastFromMe: boolean;
  lastAt: string | null;
  unread: number;
};
type GroupMember = { accountId: number | null; copsName: string; avatar: string | null; elo: number; isOwner: boolean };
type GroupDetail = { id: string; name: string; isOwner: boolean; members: GroupMember[] };

type Active = { kind: 'dm'; acc: number } | { kind: 'group'; id: string } | null;

function timeShort(s?: string | null) {
  if (!s) return '';
  const diff = Math.max(0, Date.now() - new Date(s).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

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

function GroupIcon({ size = 44 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300" style={{ width: size, height: size }}>
      <Users size={Math.round(size * 0.45)} />
    </div>
  );
}

export default function MessagesPage() {
  const { data: session } = useSession();

  const [dmConvos, setDmConvos] = useState<Convo[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [active, setActive] = useState<Active>(null);

  const [friend, setFriend] = useState<Friend | null>(null);
  const [dmMessages, setDmMessages] = useState<Msg[]>([]);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [groupMessages, setGroupMessages] = useState<Msg[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // create-group modal
  const [creating, setCreating] = useState(false);
  const [gName, setGName] = useState('');
  const [pickFriends, setPickFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // manage-group panel
  const [managing, setManaging] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [addFriends, setAddFriends] = useState<Friend[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const activeRef = useRef<Active>(null);
  activeRef.current = active;

  const sameActive = (a: Active, b: Active) =>
    a && b && a.kind === b.kind && (a.kind === 'dm' ? a.acc === (b as any).acc : (a as any).id === (b as any).id);

  const messages = active?.kind === 'group' ? groupMessages : dmMessages;

  const knownStyleRef = useRef<Set<string>>(new Set());
  const [nameStyles, setNameStyles] = useState<Record<string, string | null>>({});
  const [nameFrames, setNameFrames] = useState<Record<string, string | null>>({});
  const ensureStyles = useCallback(async (ids: (number | null | undefined)[]) => {
    const need = Array.from(new Set(ids.filter((x): x is number => typeof x === 'number'))).map(String).filter((k) => !knownStyleRef.current.has(k));
    if (need.length === 0) return;
    need.forEach((k) => knownStyleRef.current.add(k));
    try {
      const r = await fetch(`/api/economy?names=${need.join(',')}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { styles: {}, frames: {} };
      setNameStyles((prev) => ({ ...prev, ...(d.styles || {}) }));
      setNameFrames((prev) => ({ ...prev, ...(d.frames || {}) }));
    } catch {
      need.forEach((k) => knownStyleRef.current.delete(k));
    }
  }, []);
  const styleOf = (accId: number | null | undefined) => nameClass(nameStyles[String(accId)]);
  const frameOf = (accId: number | null | undefined) => frameClass(nameFrames[String(accId)]);
  const dmRx = useReactions('dm');
  const groupRx = useReactions('group');

  const loadList = useCallback(async () => {
    try {
      const [dmRes, gRes] = await Promise.all([fetch('/api/dm', { cache: 'no-store' }), fetch('/api/groups', { cache: 'no-store' })]);
      const dm = dmRes.ok ? await dmRes.json() : { conversations: [] };
      const gr = gRes.ok ? await gRes.json() : { groups: [] };
      setDmConvos(dm.conversations || []);
      setGroups(gr.groups || []);
      ensureStyles((dm.conversations || []).map((c: any) => c.accountId));
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  }, [ensureStyles]);

  const loadThread = useCallback(async (a: Active, showSpinner = false) => {
    if (!a) return;
    if (showSpinner) setLoadingThread(true);
    try {
      if (a.kind === 'dm') {
        const r = await fetch(`/api/dm?with=${a.acc}`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (!sameActive(activeRef.current, a)) return;
        setFriend(d.friend || null);
        setDmMessages(d.messages || []);
        dmRx.track((d.messages || []).map((m: any) => m.id));
        ensureStyles([d.friend?.accountId]);
      } else {
        const r = await fetch(`/api/groups?id=${a.id}`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (!sameActive(activeRef.current, a)) return;
        setGroup(d.group || null);
        setGroupMessages(d.messages || []);
        groupRx.track((d.messages || []).map((m: any) => m.id));
        ensureStyles([...(d.group?.members || []).map((m: any) => m.accountId), ...(d.messages || []).map((m: any) => m.fromAccountId)]);
      }
    } catch {
      /* ignore */
    } finally {
      if (showSpinner) setLoadingThread(false);
    }
  }, [ensureStyles]);

  // deep link ?with= (dm) or ?group= on first load
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const w = p.get('with');
    const g = p.get('group');
    if (g) setActive({ kind: 'group', id: g });
    else if (w && Number.isFinite(Number(w))) setActive({ kind: 'dm', acc: Number(w) });
  }, []);

  // list polling
  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 8000);
    return () => clearInterval(id);
  }, [loadList]);

  // thread load + polling
  useEffect(() => {
    setManaging(false);
    if (!active) {
      setDmMessages([]);
      setGroupMessages([]);
      setFriend(null);
      setGroup(null);
      return;
    }
    atBottomRef.current = true;
    loadThread(active, true);
    const id = setInterval(() => {
      if (sameActive(activeRef.current, active)) loadThread(active);
      loadList();
    }, 3500);
    return () => clearInterval(id);
  }, [active, loadThread, loadList]);

  // keep scrolled to newest
  useEffect(() => {
    if (atBottomRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !active || sending) return;
    setSending(true);
    setText('');
    atBottomRef.current = true;
    const optimistic: Msg = {
      id: 'tmp' + Date.now(),
      fromMe: true,
      fromName: 'You',
      fromAccountId: null,
      fromAvatar: session?.user?.image ?? null,
      fromElo: 1000,
      text: t,
      createdAt: new Date().toISOString(),
    };
    if (active.kind === 'group') setGroupMessages((m) => [...m, optimistic]);
    else setDmMessages((m) => [...m, optimistic]);
    try {
      const r =
        active.kind === 'dm'
          ? await fetch('/api/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: active.acc, text: t }) })
          : await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', groupId: active.id, text: t }) });
      if (r.ok) {
        await loadThread(active);
        loadList();
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  // ---- create group ----
  const openCreate = async () => {
    setCreating(true);
    setGName('');
    setPicked([]);
    setCreateErr('');
    try {
      const r = await fetch('/api/friends', { cache: 'no-store' });
      const d = r.ok ? await r.json() : { friends: [] };
      setPickFriends((d.friends || []).filter((f: any) => f.accountId != null));
    } catch {
      /* ignore */
    }
  };
  const togglePick = (acc: number) => setPicked((p) => (p.includes(acc) ? p.filter((x) => x !== acc) : [...p, acc]));
  const submitCreate = async () => {
    if (picked.length === 0) {
      setCreateErr('Pick at least one friend.');
      return;
    }
    setCreateBusy(true);
    setCreateErr('');
    try {
      const r = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: gName, members: picked }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setCreateErr(d?.error || 'Could not create group.');
      else {
        setCreating(false);
        await loadList();
        setActive({ kind: 'group', id: d.id });
      }
    } catch {
      setCreateErr('Could not create group.');
    } finally {
      setCreateBusy(false);
    }
  };

  // ---- manage group ----
  const openManage = async () => {
    if (!group) return;
    setManaging((m) => !m);
    setRenameVal(group.name);
    try {
      const r = await fetch('/api/friends', { cache: 'no-store' });
      const d = r.ok ? await r.json() : { friends: [] };
      const inGroup = new Set(group.members.map((m) => m.accountId));
      setAddFriends((d.friends || []).filter((f: any) => f.accountId != null && !inGroup.has(f.accountId)));
    } catch {
      /* ignore */
    }
  };
  const groupAction = async (payload: any) => {
    if (active?.kind !== 'group') return;
    try {
      const r = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, groupId: active.id }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (d.deleted || payload.action === 'leave') {
          setActive(null);
          setManaging(false);
        } else {
          await loadThread(active);
          if (payload.action === 'addMembers') openManage();
        }
        loadList();
      }
    } catch {
      /* ignore */
    }
  };

  if (session === null) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center text-center md:h-screen">
        <div>
          <MessageCircle size={30} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Sign in to use messages</p>
        </div>
      </div>
    );
  }

  const showList = active == null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] bg-[#070709] text-white selection:bg-cyan-500/40 md:h-screen">
      <CosmeticStyles />
      {/* Conversation list */}
      <aside className={`${showList ? 'flex' : 'hidden md:flex'} w-full shrink-0 flex-col border-r border-white/10 md:w-80`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <MessageCircle size={18} className="text-cyan-400" />
          <h1 className="text-lg font-black tracking-tight">Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center py-16 text-cyan-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : (
            <>
              {/* Groups */}
              <div className="flex items-center justify-between px-4 pb-1 pt-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Groups</span>
                <button onClick={openCreate} className="flex items-center gap-1 rounded-lg bg-violet-500/20 px-2 py-1 text-[11px] font-bold text-violet-300 hover:bg-violet-500/30">
                  <Plus size={12} /> New
                </button>
              </div>
              {groups.length === 0 ? (
                <p className="px-4 pb-2 pt-1 text-xs text-gray-600">No groups yet.</p>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActive({ kind: 'group', id: g.id })}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                      active?.kind === 'group' && active.id === g.id ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <GroupIcon size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-bold text-white">{g.name}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-gray-600">{timeShort(g.lastAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${g.unread > 0 ? 'font-bold text-gray-200' : 'text-gray-500'}`}>
                          {g.lastText ? `${g.lastFromMe ? 'You' : g.lastFrom}: ${g.lastText}` : `${g.memberCount} members`}
                        </span>
                        {g.unread > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-cyan-500 px-1.5 text-[11px] font-black text-black">
                            {g.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}

              {/* Direct */}
              <div className="px-4 pb-1 pt-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Direct</span>
              </div>
              {dmConvos.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-600">
                  No friends yet.{' '}
                  <Link href="/friends" className="font-bold text-cyan-400 hover:text-cyan-300">
                    Add some →
                  </Link>
                </div>
              ) : (
                dmConvos.map((c) => (
                  <button
                    key={c.accountId ?? c.copsName}
                    onClick={() => c.accountId != null && setActive({ kind: 'dm', acc: c.accountId })}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                      active?.kind === 'dm' && active.acc === c.accountId ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <Avatar src={c.avatar} name={c.copsName} elo={c.elo} size={44} frame={frameOf(c.accountId)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate font-bold text-white ${styleOf(c.accountId)}`}>{c.copsName}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-gray-600">{timeShort(c.lastAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${c.unread > 0 ? 'font-bold text-gray-200' : 'text-gray-500'}`}>
                          {c.lastText ? `${c.lastFromMe ? 'You: ' : ''}${c.lastText}` : 'Say hi 👋'}
                        </span>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-cyan-500 px-1.5 text-[11px] font-black text-black">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${showList ? 'hidden md:flex' : 'flex'} min-w-0 flex-1 flex-col`}>
        {active == null ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <MessageCircle size={30} className="mx-auto mb-3 text-gray-700" />
              <p className="text-sm font-bold uppercase tracking-widest text-gray-600">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-white md:hidden" aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              {active.kind === 'dm' ? (
                <>
                  {friend && <Avatar src={friend.avatar} name={friend.copsName} elo={friend.elo} size={38} frame={frameOf(friend?.accountId)} />}
                  {friend?.accountId != null ? (
                    <Link href={`/profile/${friend.accountId}`} className="font-black text-white hover:text-cyan-400">
                      <span className={styleOf(friend?.accountId)}>{friend?.copsName ?? '…'}</span>
                    </Link>
                  ) : (
                    <span className="font-black text-white">{friend?.copsName ?? '…'}</span>
                  )}
                </>
              ) : (
                <>
                  <GroupIcon size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-white">{group?.name ?? '…'}</p>
                    <p className="text-[11px] text-gray-500">{group ? `${group.members.length} members` : ''}</p>
                  </div>
                  <button onClick={openManage} className={`rounded-lg p-2 transition-colors ${managing ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`} aria-label="Manage group">
                    <Settings2 size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Manage panel */}
            {active.kind === 'group' && managing && group && (
              <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3">
                {group.isOwner && (
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value.slice(0, 40))}
                      className="flex-1 rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-1.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                    />
                    <button
                      onClick={() => groupAction({ action: 'rename', name: renameVal })}
                      className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
                    >
                      Rename
                    </button>
                  </div>
                )}

                <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-gray-500">Members</p>
                <div className="mb-3 space-y-1">
                  {group.members.map((m) => (
                    <div key={m.accountId ?? m.copsName} className="flex items-center gap-2">
                      <Avatar src={m.avatar} name={m.copsName} elo={m.elo} size={26} frame={frameOf(m.accountId)} />
                      <Link href={`/profile/${m.accountId}`} className="flex-1 truncate text-sm text-gray-200 hover:text-cyan-400">
                        {m.copsName}
                      </Link>
                      {m.isOwner && <Crown size={13} className="text-amber-400" />}
                      {group.isOwner && !m.isOwner && m.accountId != null && (
                        <button onClick={() => groupAction({ action: 'removeMember', member: m.accountId })} className="text-gray-600 hover:text-red-400" title="Remove">
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {group.isOwner && addFriends.length > 0 && (
                  <>
                    <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-gray-500">Add a friend</p>
                    <div className="mb-3 max-h-32 space-y-1 overflow-y-auto">
                      {addFriends.map((f) => (
                        <button
                          key={f.accountId}
                          onClick={() => groupAction({ action: 'addMembers', members: [f.accountId] })}
                          className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/[0.05]"
                        >
                          <Avatar src={f.avatar} name={f.copsName} elo={f.elo} size={24} frame={frameOf(f.accountId)} />
                          <span className="flex-1 truncate text-sm text-gray-200">{f.copsName}</span>
                          <Plus size={14} className="text-cyan-400" />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('Leave this group?')) groupAction({ action: 'leave' });
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 hover:border-red-500/40 hover:text-red-400"
                  >
                    <LogOut size={13} /> Leave
                  </button>
                  {group.isOwner && (
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this group for everyone?')) groupAction({ action: 'delete' });
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {loadingThread && messages.length === 0 ? (
                <div className="flex justify-center py-16 text-cyan-400">
                  <Loader2 className="animate-spin" size={22} />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-gray-600">No messages yet — say hello</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex items-end gap-2 ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                    {!m.fromMe && active?.kind === 'group' && <Avatar src={m.fromAvatar} name={m.fromName} elo={m.fromElo} size={26} frame={frameOf(m.fromAccountId)} />}
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.fromMe ? 'rounded-br-sm bg-cyan-500 text-black' : 'rounded-bl-sm bg-white/[0.07] text-gray-100'}`}>
                      {!m.fromMe && active?.kind === 'group' && (
                        <p className={`mb-0.5 text-[11px] font-bold ${styleOf(m.fromAccountId)}`} style={styleOf(m.fromAccountId) ? undefined : { color: getTier(m.fromElo).color }}>
                          {m.fromName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words"><MessageText text={m.text} /></p>
                      {!String(m.id).startsWith('tmp') && (
                        <ReactionBar
                          messageId={m.id}
                          reactions={(active?.kind === 'group' ? groupRx : dmRx).reactionsOf(m.id)}
                          onToggle={(active?.kind === 'group' ? groupRx : dmRx).toggle}
                          align={m.fromMe ? 'right' : 'left'}
                        />
                      )}
                      <div className={`mt-0.5 text-[10px] ${m.fromMe ? 'text-black/50' : 'text-gray-500'}`}>{timeShort(m.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Message…"
                  className="max-h-32 flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Create group modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Users size={18} className="text-violet-300" /> New group
              </h2>
              <button onClick={() => setCreating(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <input
              value={gName}
              onChange={(e) => setGName(e.target.value.slice(0, 40))}
              placeholder="Group name"
              className="mb-3 w-full rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
            />

            <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-gray-500">Add friends</p>
            <div className="mb-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-1">
              {pickFriends.length === 0 ? (
                <p className="px-2 py-3 text-xs text-gray-600">
                  No friends yet.{' '}
                  <Link href="/friends" className="text-cyan-400 hover:underline">
                    Add some
                  </Link>
                  .
                </p>
              ) : (
                pickFriends.map((f) => {
                  const on = f.accountId != null && picked.includes(f.accountId);
                  return (
                    <button
                      key={f.accountId}
                      onClick={() => f.accountId != null && togglePick(f.accountId)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${on ? 'bg-violet-500/15' : 'hover:bg-white/[0.05]'}`}
                    >
                      <Avatar src={f.avatar} name={f.copsName} elo={f.elo} size={30} frame={frameOf(f.accountId)} />
                      <span className="flex-1 truncate text-sm font-bold text-white">{f.copsName}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? 'border-violet-400 bg-violet-500 text-black' : 'border-white/20'}`}>
                        {on && <Check size={12} />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {createErr ? <p className="mb-2 text-xs font-bold text-red-400">{createErr}</p> : null}

            <button
              onClick={submitCreate}
              disabled={createBusy || picked.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {createBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create group ({picked.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
