'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { EP_PACKS } from '../lib/shop';

declare global {
  interface Window {
    paypal?: any;
  }
}

function PayPalButtons({ packId, onDone }: { packId: string; onDone: (ep: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ref.current || !window.paypal) return;
    ref.current.innerHTML = '';
    let btns: any;
    try {
      btns = window.paypal.Buttons({
        style: { color: 'gold', shape: 'pill', label: 'paypal', height: 44 },
        createOrder: async () => {
          const r = await fetch('/api/paypal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', packId }) });
          const d = await r.json();
          if (!d.id) throw new Error(d.error || 'create failed');
          return d.id;
        },
        onApprove: async (data: any) => {
          const r = await fetch('/api/paypal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'capture', orderId: data.orderID, packId }) });
          const d = await r.json();
          if (d.ok) onDone(d.credited);
          else setErr(d.error || 'Payment could not be verified.');
        },
        onError: () => setErr('Payment error — please try again.'),
      });
      btns.render(ref.current).catch(() => {});
    } catch {
      setErr('PayPal failed to load.');
    }
    return () => {
      try {
        btns?.close();
      } catch {
        /* ignore */
      }
    };
  }, [packId, onDone]);

  return (
    <div>
      <div ref={ref} />
      {err ? <p className="mt-2 text-xs font-bold text-red-400">{err}</p> : null}
    </div>
  );
}

export default function EpPacks({ onCredited }: { onCredited?: (ep: number) => void }) {
  const [cfg, setCfg] = useState<{ enabled: boolean; clientId: string | null; currency: string } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/paypal')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCfg(d || { enabled: false, clientId: null, currency: 'USD' }))
      .catch(() => setCfg({ enabled: false, clientId: null, currency: 'USD' }));
  }, []);

  useEffect(() => {
    if (!cfg?.enabled || !cfg.clientId) return;
    if (window.paypal) {
      setSdkReady(true);
      return;
    }
    if (document.getElementById('paypal-sdk')) return;
    const s = document.createElement('script');
    s.id = 'paypal-sdk';
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${cfg.currency || 'USD'}`;
    s.onload = () => setSdkReady(true);
    s.onerror = () => setSdkReady(false);
    document.body.appendChild(s);
  }, [cfg]);

  const demoBuy = async (packId: string) => {
    setBusy(packId);
    setMsg('');
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'buyPack', packId }) });
      const d = await r.json().catch(() => ({}));
      if (d.credited) {
        setMsg(`+${d.credited} EP added (demo).`);
        onCredited?.(d.credited);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
        <Sparkles size={15} className="text-violet-300" /> Buy EP
      </h2>
      {cfg && !cfg.enabled ? (
        <p className="mb-3 text-xs text-gray-600">
          Demo mode — purchases credit EP instantly. Add <span className="text-gray-400">PAYPAL_CLIENT_ID</span> and <span className="text-gray-400">PAYPAL_SECRET</span> to enable real PayPal checkout.
        </p>
      ) : (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-400/80">
          <ShieldCheck size={13} /> Secure checkout with PayPal.
        </p>
      )}

      {msg ? <p className="mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-200">{msg}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        {EP_PACKS.map((p) => {
          const isSel = selected === p.id;
          return (
            <div key={p.id} className={`rounded-2xl border bg-white/[0.03] p-4 text-center transition-colors ${isSel ? 'border-violet-400/60' : 'border-white/10'}`}>
              <Coins size={22} className="mx-auto mb-1 text-amber-400" />
              <p className="text-xl font-black text-amber-300">
                {p.ep.toLocaleString()} <span className="text-xs text-amber-500/70">EP</span>
              </p>
              {p.bonus ? <p className="text-[11px] font-bold text-emerald-400">{p.bonus}</p> : <p className="text-[11px] text-transparent">.</p>}
              {cfg?.enabled ? (
                <button onClick={() => setSelected(p.id)} className={`mt-3 w-full rounded-full py-2 text-sm font-black transition-colors ${isSel ? 'bg-violet-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {p.price}
                </button>
              ) : (
                <button onClick={() => demoBuy(p.id)} disabled={!!busy} className="mt-3 w-full rounded-full bg-violet-500 py-2 text-sm font-black text-white hover:bg-violet-400 disabled:opacity-50">
                  {busy === p.id ? <Loader2 size={14} className="mx-auto animate-spin" /> : p.price}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {cfg?.enabled && selected ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Pay for {EP_PACKS.find((p) => p.id === selected)?.ep.toLocaleString()} EP</p>
          {sdkReady ? (
            <PayPalButtons
              key={selected}
              packId={selected}
              onDone={(ep) => {
                setSelected(null);
                setMsg(`+${ep.toLocaleString()} EP added — thank you!`);
                onCredited?.(ep);
              }}
            />
          ) : (
            <div className="flex justify-center py-4 text-cyan-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
