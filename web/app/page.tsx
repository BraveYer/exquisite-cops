'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // <-- LIBRĂRIA PENTRU REDIRECT AUTOMAT
import { signIn, signOut, useSession } from "next-auth/react";
import { Shield, Trophy, Users, Crown } from 'lucide-react';

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter(); // <-- Funcția care te mută de pe o pagină pe alta
  
  const [elo, setElo] = useState<number | string | null>(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0 });
  
  const [inQueue, setQueue] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const MAX_PLAYERS = 1; // Păstrează 1 pentru teste

  // 1. Tragem datele tale
  useEffect(() => {
    if (session) {
      fetch('/api/user')
        .then(res => res.json())
        .then(data => {
          setElo(data.elo);
          setStats({ wins: data.wins, losses: data.losses });
        })
        .catch(() => setElo("Err"));
    }
  }, [session]);

  // 2. Verificăm Coada (Queue)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/queue')
        .then(res => res.json())
        .then(data => {
          setQueueCount(data.count);
          if (session && data.players.some((p: any) => p.discordId === session.user?.name)) {
            setQueue(true);
          } else {
            setQueue(false);
          }
        });
    }, 2000);
    return () => clearInterval(interval);
  }, [session]);

  // 3. RADAR PENTRU AUTO-REDIRECT LA MECI (REPARAT)
  useEffect(() => {
    // Se activează DOAR dacă ești logat ȘI ai apăsat pe Search (inQueue)
    if (!session || !inQueue) return; 

    const matchCheck = setInterval(() => {
      fetch('/api/match/current', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (data.matchId) {
            setQueue(false); // Oprește statusul de search
            router.push(`/match/${data.matchId}`); // Te teleportează
          }
        })
        .catch(err => console.error("Radar Error:", err));
    }, 2000);
    
    return () => clearInterval(matchCheck);
  }, [session, inQueue, router]);

  const toggleQueue = async () => {
    const action = inQueue ? 'leave' : 'join';
    await fetch('/api/queue', { method: 'POST', body: JSON.stringify({ action }) });
    setQueue(!inQueue);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-cyan-500 pb-20">
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#0d0d0d]">
        <h1 className="text-xl font-bold tracking-tighter italic text-cyan-400">EXQUISITE COPS</h1>
        <div className="flex items-center gap-6">
          <Link href="/leaderboard" className="text-sm font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <Trophy size={16} /> LEADERBOARD
          </Link>
          <button 
            onClick={() => session ? signOut() : signIn('discord', { callbackUrl: '/' })}
            className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-cyan-400 transition-all text-sm"
          >
            {session ? `LOGOUT (${session.user?.name})` : "CONNECT WITH DISCORD"}
          </button>
        </div>
      </nav>

      {/* BANNER MECI ACTIV - Apare doar dacă ai un meci găsit de radar */}
{session && inQueue === false && (
  <div className="max-w-6xl mx-auto px-6 mt-4">
    <div id="active-match-banner" className="hidden bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
        <p className="text-amber-400 font-bold uppercase tracking-widest text-xs">You have an ongoing match!</p>
      </div>
      <button 
        onClick={() => fetch('/api/match/current').then(res => res.json()).then(data => router.push(`/match/${data.matchId}`))}
        className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-2 rounded-xl font-black text-xs transition-all uppercase"
      >
        Return to Match
      </button>
    </div>
  </div>
)}

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-8 uppercase tracking-widest">
          <Shield size={14} /> Live System Connected
        </div>
        
        <h2 className="text-6xl md:text-8xl font-black mb-6 tracking-tight">
          CRITICAL OPS <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 uppercase">
            Ranked Hub
          </span>
        </h2>
        
        {/* STATS GRID */}
        {session && (
          <div className="max-w-3xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-cyan-500/10 border border-cyan-500/30 p-6 rounded-3xl backdrop-blur-sm">
              <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2">Rating</p>
              <p className="text-5xl font-black text-white">{elo ?? '...'}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Combat History</p>
              <div className="flex justify-center gap-6 items-center h-full pb-4">
                <div className="text-center">
                  <p className="text-3xl font-black text-green-400">{stats.wins}</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">Wins</p>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="text-center">
                  <p className="text-3xl font-black text-red-400">{stats.losses}</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">Losses</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Efficiency</p>
              <p className="text-5xl font-black text-white">
                {stats.wins + stats.losses > 0 
                  ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
                  : 0}<span className="text-2xl text-gray-400">%</span>
              </p>
            </div>
          </div>
        )}

        {/* BUTONUL MAGIC */}
        <div className="flex flex-wrap justify-center gap-4 mt-8 mb-16">
          {session ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <button 
                onClick={toggleQueue}
                className={`w-full max-w-md ${inQueue ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]'} text-black px-12 py-5 rounded-2xl font-black text-xl transition-all transform hover:scale-105`}
              >
                {inQueue ? "CANCEL SEARCH" : "START SEARCHING MATCH"}
              </button>
              {inQueue ? (
                <div className="animate-pulse flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-sm">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  Searching for match... {queueCount} / {MAX_PLAYERS}
                </div>
              ) : (
                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                  Players in queue: <span className="text-gray-300">{queueCount}</span> / {MAX_PLAYERS}
                </p>
              )}
            </div>
          ) : (
             <button onClick={() => signIn('discord', { callbackUrl: '/' })} className="bg-cyan-500 hover:bg-cyan-400 text-black px-8 py-4 rounded-xl font-black text-lg transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
               JOIN THE RANKED
             </button>
          )}
        </div>

        {/* PARTY SYSTEM UI (Ca pe Spand) */}
        {session && (
          <div className="max-w-3xl mx-auto bg-white/5 border border-white/10 rounded-3xl p-6 text-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-gray-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <Users size={16} /> PARTY <span className="text-white">1/5</span>
              </h3>
              <button className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-colors uppercase">
                Leave Party
              </button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2">
              {/* Tu (Host) */}
              <div className="bg-white/5 border border-cyan-500/30 p-4 rounded-2xl flex flex-col items-center min-w-[120px] relative">
                <div className="absolute -top-2 -right-2 bg-cyan-500 text-black p-1 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                  <Crown size={12} strokeWidth={4} />
                </div>
                <div className="w-16 h-16 bg-gray-700 rounded-xl mb-3 overflow-hidden border-2 border-cyan-400">
                  <img src={session.user?.image || "https://i.imgur.com/6NBH9uV.png"} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <p className="font-bold text-sm truncate w-full text-center">{session.user?.name}</p>
                <p className="text-cyan-400 text-xs font-black">{elo} ELO</p>
                <p className="text-[10px] text-cyan-500 font-bold uppercase mt-1">Host</p>
              </div>

              {/* Slots Libere */}
              {[1, 2, 3, 4].map((slot) => (
                <div key={slot} className="bg-white/5 border border-white/10 border-dashed p-4 rounded-2xl flex flex-col items-center justify-center min-w-[120px] opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="w-12 h-12 bg-black/50 rounded-xl mb-3 flex items-center justify-center">
                    <Users size={20} className="text-gray-500" />
                  </div>
                  <p className="text-gray-500 text-xs font-bold uppercase">Invite</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}