'use client';

import type { FC } from 'react';
import WatchingEffect from './WatchingEffect';
import CosmosEffect from './CosmosEffect';
import FallingStarsEffect from './FallingStarsEffect';
import LuckyEraEffect from './LuckyEraEffect';
import RawrSplashEffect from './RawrSplashEffect';
import ZenGardenEffect from './ZenGardenEffect';
import CountingSheepEffect from './CountingSheepEffect';
import StageEffect from './StageEffect';
import RandomEffect from './RandomEffect';
import { pageThemeClass } from './ProfileCosmetics';

// Registry of animated profile themes. To add a new effect: build a component and add it here.
const EFFECTS: Record<string, FC> = {
  theme_watching: WatchingEffect,
  theme_cosmos: CosmosEffect,
  theme_fallingstars: FallingStarsEffect,
  theme_lucky: LuckyEraEffect,
  theme_rawr: RawrSplashEffect,
  theme_zen: ZenGardenEffect,
  theme_sheep: CountingSheepEffect,
  theme_stage_orange: () => <StageEffect variant="orange" />,
  theme_stage_teal: () => <StageEffect variant="teal" />,
  theme_random: RandomEffect,
};

export default function ProfileEffect({ theme }: { theme?: string | null }) {
  if (!theme) return null;
  const Comp = EFFECTS[theme];
  if (Comp) return <Comp />;
  return <div className={`pointer-events-none fixed inset-0 z-0 ${pageThemeClass(theme)}`} />;
}
