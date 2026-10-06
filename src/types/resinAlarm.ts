export interface PushResinAlarm { target: number; state: 'armed' | 'delivered' | 'unavailable'; dueAt: number; expiresAt: number; tag: string; requestId?: string; }
export function isPushResinAlarm(value: unknown): value is PushResinAlarm {
  if (!value || typeof value !== 'object') return false;
  const alarm = value as PushResinAlarm;
  return Number.isInteger(alarm.target) && alarm.target > 0 && alarm.target <= 1000 && ['armed', 'delivered', 'unavailable'].includes(alarm.state) && Number.isFinite(alarm.dueAt) && Number.isFinite(alarm.expiresAt) && /^resin-[a-f\d]{24}$/.test(alarm.tag);
}
