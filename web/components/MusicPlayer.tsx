'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music2 } from 'lucide-react';

type Track = { src: string; title: string };

export default function MusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load track list + persisted prefs once.
  useEffect(() => {
    fetch('/api/music')
      .then(r => (r.ok ? r.json() : { tracks: [] }))
      .then(d => { setTracks(d.tracks || []); setReady(true); })
      .catch(() => setReady(true));
    try {
      const v = localStorage.getItem('exq-music-vol');
      if (v != null) setVolume(Math.min(1, Math.max(0, parseFloat(v))));
      const i = localStorage.getItem('exq-music-idx');
      if (i != null) setIndex(Math.max(0, parseInt(i) || 0));
    } catch {}
  }, []);

  // Apply + persist volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try { localStorage.setItem('exq-music-vol', String(volume)); } catch {}
  }, [volume]);

  // Persist current track.
  useEffect(() => {
    try { localStorage.setItem('exq-music-idx', String(index)); } catch {}
  }, [index]);

  // When the track changes while playing, keep playing the new src.
  useEffect(() => {
    const a = audioRef.current;
    if (a && playing) a.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || tracks.length === 0) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try { await a.play(); setPlaying(true); } catch {}
    }
  };

  const go = (dir: number) => {
    if (tracks.length === 0) return;
    setIndex(prev => (prev + dir + tracks.length) % tracks.length);
  };

  if (!ready || tracks.length === 0) return null;

  const current = tracks[Math.min(index, tracks.length - 1)];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <audio
        ref={audioRef}
        src={current?.src}
        onEnded={() => go(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0b0f]/90 p-1.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md">
        <button
          onClick={toggle}
          title={playing ? 'Pause' : 'Play'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-black transition-colors hover:bg-cyan-300"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        {open ? (
          <div className="flex items-center gap-2 pr-2">
            <button onClick={() => go(-1)} title="Previous" className="text-gray-400 transition-colors hover:text-white">
              <SkipBack size={16} />
            </button>
            <div className="min-w-0 max-w-[9rem]">
              <p className="truncate text-xs font-bold text-white">{current?.title}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">{playing ? 'Now playing' : 'Paused'}</p>
            </div>
            <button onClick={() => go(1)} title="Next" className="text-gray-400 transition-colors hover:text-white">
              <SkipForward size={16} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="h-1 w-16 cursor-pointer accent-cyan-400"
              title="Volume"
            />
            <button onClick={() => setOpen(false)} title="Hide" className="text-gray-500 transition-colors hover:text-white">
              <Music2 size={15} />
            </button>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} title="Music" className="pr-2 text-gray-400 transition-colors hover:text-cyan-400">
            <Music2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
