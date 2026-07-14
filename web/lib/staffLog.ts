// Best-effort audit log for staff/moderation actions. Never throws.
export async function logStaff(
  db: any,
  entry: { actorId?: string | null; actorName?: string | null; action: string; target?: string | null; targetName?: string | null; details?: string | null }
): Promise<void> {
  try {
    await db.collection('staffLog').insertOne({
      actorId: entry.actorId || null,
      actorName: entry.actorName || 'Staff',
      action: entry.action,
      target: entry.target || null,
      targetName: entry.targetName || null,
      details: entry.details || null,
      createdAt: new Date(),
    });
  } catch {
    /* logging must never break the action */
  }
}
