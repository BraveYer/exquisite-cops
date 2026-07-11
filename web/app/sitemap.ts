import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://exquisitecops.netlify.app';
  const routes = ['', '/leaderboard', '/shop', '/clans', '/tournaments', '/feed', '/updates', '/season', '/battlepass', '/matches'];
  return routes.map((r) => ({
    url: `${base}${r}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: r === '' ? 1 : 0.7,
  }));
}
