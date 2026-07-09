'use client';

import type { FC } from 'react';
import WatchingEffect from './WatchingEffect';
import CosmosEffect from './CosmosEffect';
import FallingStarsEffect from './FallingStarsEffect';
import LuckyEraEffect from './LuckyEraEffect';
import RawrSplashEffect from './RawrSplashEffect';
import ZenGardenEffect from './ZenGardenEffect';
import { pageThemeClass } from './ProfileCosmetics';

// Registry of animated profile themes. To add a new effect: build a component and add it here.
const EFFECTS: Record<string, FC> = {
  theme_watching: WatchingEffect,
  theme_cosmos: CosmosEffect,
  theme_fallingstars: FallingStarsEffect,
  theme_lucky: LuckyEraEffect,
  theme_rawr: RawrSplashEffect,
  theme_zen: ZenGardenEffect,
};

export default function ProfileEffect({ theme }: { theme?: string | null }) {
  if (!theme) return null;
  const Comp = EFFECTS[theme];
  if (Comp) return <Comp />;
  return <div className={`pointer-events-none fixed inset-0 z-0 ${pageThemeClass(theme)}`} />;
}
