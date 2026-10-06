import type { PrivateProfile } from '../types/myProfile';

export type ResinReading = Pick<NonNullable<PrivateProfile['notes']>, 'resin' | 'maxResin' | 'recoverySeconds'>;
export function validResin(reading: ResinReading | null | undefined): reading is ResinReading & { resin: number; maxResin: number } {
  return Boolean(reading && Number.isInteger(reading.resin) && Number.isInteger(reading.maxResin) && reading.maxResin! >= 1 && reading.maxResin! <= 1000 && reading.resin! >= 0 && reading.resin! <= reading.maxResin!);
}

/** Estimate when to CHECK actual resin; never use an estimate as an alert. */
export function resinDueAt(reading: ResinReading, target: number, readAt: number): number | null {
  if (!validResin(reading) || !Number.isInteger(target) || target < 1 || target > reading.maxResin || !Number.isFinite(readAt)) return null;
  if (reading.resin >= target) return readAt;
  const recovery = reading.recoverySeconds;
  const remaining = reading.maxResin - reading.resin;
  if (recovery === null || !Number.isInteger(recovery) || recovery <= 0 || recovery > remaining * 480) return null;
  return readAt + Math.max(1, recovery - (reading.maxResin - target) * 480) * 1000;
}
