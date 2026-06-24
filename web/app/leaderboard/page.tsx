'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ArrowLeft, Medal } from 'lucide-react';

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setPlayers(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-cyan-500 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header-ul paginii */}
        <div className="flex items-center justify-between mb-12">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors font-bold">
            <ArrowLeft size={20} /> BACK TO HUB
          </Link>
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 flex items-center gap-3">
            <Trophy className="text-cyan-400" /> TOP 50 PLAYERS
          </h1>
        </div>

        {/* Tabelul de Leaderboard */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
          {loading ? (
            <div className="p-12 text-center text-cyan-400 font-bold animate-pulse">Loading legends...</div>
          ) : (
            <div className="divide-y divide-white/10">
              {players.map((player, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-6 transition-colors hover:bg-white/5 ${index === 0 ? 'bg-amber-500/10' : ''}`}
                >
                  <div className="flex items-center gap-6">
                    {/* Rank Number */}
                    <div className={`text-2xl font-black w-10 text-center ${
                      index === 0 ? 'text-amber-400' : 
                      index === 1 ? 'text-gray-300' : 
                      index === 2 ? 'text-amber-700' : 'text-gray-600'
                    }`}>
                      #{index + 1}
                    </div>
                    
                    {/* Nume Jucator */}
                    <div>
                      <p className="text-xl font-bold flex items-center gap-2">
                        {player.discordId}
                        {index === 0 && <Medal size={18} className="text-amber-400" />}
                      </p>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                        {player.wins || 0}W / {player.losses || 0}L
                      </p>
                    </div>
                  </div>

                  {/* ELO */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-cyan-500 uppercase tracking-widest mb-1">Rating</p>
                    <p className={`text-3xl font-black ${index === 0 ? 'text-amber-400' : 'text-white'}`}>
                      {player.elo}
                    </p>
                  </div>
                </div>
              ))}
              
              {players.length === 0 && !loading && (
                <div className="p-12 text-center text-gray-500 font-bold">No players registered yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}