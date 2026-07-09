// Premium club tag styles, bought by the leader with their EP and shown wherever [TAG] appears.

export type ClubTagStyle = { id: string; name: string; price: number; rarity: 'rare' | 'epic' | 'legendary' };

export const CLUB_TAG_STYLES: ClubTagStyle[] = [
  { id: 'tag_cyan', name: 'Cyan Gradient', price: 1500, rarity: 'rare' },
  { id: 'tag_fire', name: 'Fire Gradient', price: 2200, rarity: 'epic' },
  { id: 'tag_gold', name: 'Gold Foil', price: 3000, rarity: 'epic' },
  { id: 'tag_prism', name: 'Prism Wave', price: 5000, rarity: 'legendary' },
];

export function getClubStyle(id: string): ClubTagStyle | undefined {
  return CLUB_TAG_STYLES.find((s) => s.id === id);
}

export const CLUB_RARITY_COLOR: Record<string, string> = {
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};
