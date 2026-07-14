'use client';

import { useEffect, useRef, useState } from 'react';
import { frameClass, nameClass, themeClass } from './ProfileCosmetics';
import { Coins, Check, Loader2, Package } from 'lucide-react';

declare global {
  interface Window { paypal?: any }
}

type Bundle = { id: string; name: string; desc: string; items: string[]; ep: number; usd: number; rarity: string; ownedCount: number; owned: boolean };

function ItemPreview({ id }: { id: string }) {
  if (id.startsWith('frame_')) {
    return (
      <div className={`h-10 w-10 ${frameClass(id)}`}>
        <div className="h-full w-full rounded-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40" />
      </div>
    );
  }
  if (id.startsWith('theme_')) return <div className={`h-10 w-10 rounded-lg ${themeClass(id)}`} />;
  return <span className={`text-xl font-black text-white ${nameClass(id)}`}>Aa</span>;
}

function BundlePayPal({ bundleId, currency, onDone }: { bundleId: string; currency: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!ref.current || !window.paypal) return;
    ref.current.innerHTML = '';
    let btns: any;
    try {
      btns = window.paypal.Buttons({
        style: { color: 'gold', shape: 'pill', label: 'paypal', height: 40 },
        createOrder: async () => {
          const r = await fetch('/api/paypal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', bundleId }) });
          const d = await r.json();
          if (!d.id) throw new Error(d.error || 'create failed');
          return d.id;
        },
        onApprove: async (data: any) => {
          const r = await fetch('/api/paypal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'capture', orderId: data.orderID, bundleId }) });
          const d = await r.json();
          if (d.ok) onDone();
          else setErr(d.error || 'Payment could not be verified.');
        },
        onError: () => setErr('Payment error — please try again.'),
      });
      btns.render(ref.current).catch(() => {});
    } catch {
      setErr('PayPal failed to load.');
    }
    return () => { try { btns?.close(); } catch { /* ignore */ } };
  }, [bundleId, onDone]);
  return (
    <div>
      <div ref={ref} />
      {err ? <p className="mt-1 text-xs font-bold text-red-400">{err}</p> : null}
      <p className="mt-1 text-center text-[10px] text-gray-600">Paid in {currency}</p>
    </div>
  );
}

export default function Bundles({ onChanged }: { onChanged?: () => void }) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [balance, setBalance] = useState(0);
  const [cfg, setCfg] = useState<{ enabled: boolean; clientId: string; currency: string } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [openCash, setOpenCash] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = () =>
    fetch('/api/economy', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setBundles(d.bundles || []); setBalance(d.balance || 0); } })
      .catch(() => {});

  useEffect(() => {
    load();
    fetch('/api/paypal').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setCfg(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!cfg?.enabled || !cfg.clientId) return;
    if (window.paypal) { setSdkReady(true); return; }
    const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${cfg.currency || 'USD'}`;
    const found = Array.from(document.querySelectorAll('script')).find((s) => (s as HTMLScriptElement).src.startsWith('https://www.paypal.com/sdk/js'));
    if (found) {
      found.addEventListener('load', () => setSdkReady(true));
      if (window.paypal) setSdkReady(true);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => setSdkReady(true);
    document.body.appendChild(s);
  }, [cfg]);

  const buyEp = async (b: Bundle) => {
    setBusy(b.id);
    setMsg('');
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'buyBundle', bundleId: b.id }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMsg(`Unlocked ${b.name}!`); await load(); onChanged?.(); }
      else setMsg(d?.error || 'Purchase failed.');
    } catch {
      setMsg('Purchase failed.');
    } finally {
      setBusy('');
    }
  };

  if (bundles.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
        <Package size={16} className="text-violet-400" /> Bundles
      </h2>
      {msg ? <p className="mb-3 text-xs font-bold text-cyan-300">{msg}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {bundles.map((b) => {
          return (
            <div key={b.id} className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">{b.name}</p>
                {b.owned && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400">Owned</span>}
              </div>
              <div className="mb-3 flex items-center gap-3">
                {b.items.map((id) => (
                  <ItemPreview key={id} id={id} />
                ))}
                <span className="ml-auto text-[11px] text-gray-500">{b.ownedCount}/{b.items.length} owned</span>
              </div>
              <p className="mb-3 text-xs text-gray-500">{b.desc}</p>
              {b.owned ? (
                <p className="rounded-xl bg-white/5 py-2 text-center text-xs font-bold text-gray-500">You own this set</p>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => buyEp(b)}
                    disabled={busy === b.id || balance < b.ep}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-40"
                  >
                    {busy === b.id ? <Loader2 size={13} className="animate-spin" /> : <><Coins size={13} /> Buy · {b.ep.toLocaleString()} EP</>}
                  </button>
                  {cfg?.enabled && (
                    openCash === b.id ? (
                      sdkReady ? (
                        <BundlePayPal bundleId={b.id} currency={cfg.currency} onDone={() => { setMsg(`Unlocked ${b.name}!`); setOpenCash(null); load(); onChanged?.(); }} />
                      ) : (
                        <p className="text-center text-xs text-gray-500">Loading PayPal…</p>
                      )
                    ) : (
                      <button onClick={() => setOpenCash(b.id)} className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white">
                        Or buy with cash · ${b.usd.toFixed(2)}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
