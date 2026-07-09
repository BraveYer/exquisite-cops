// Small helper to drop a notification for a user. Best-effort: never throws.
export async function notify(
  db: any,
  userId: string,
  n: { type: string; title: string; body?: string; link?: string | null }
) {
  try {
    await db.collection('notifications').insertOne({
      userId,
      type: n.type,
      title: n.title,
      body: n.body || '',
      link: n.link || null,
      read: false,
      createdAt: new Date(),
    });
  } catch {
    /* ignore */
  }
}
