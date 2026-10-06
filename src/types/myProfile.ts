export interface ConnectedRole { uid: string; region: string; server: string; nickname: string; level: number | null; }
export interface ProfileArtwork { uid: string; avatar: string; namecard: string; }
export interface ProfileSession { available: boolean; connected: boolean; directLogin?: boolean; roles?: ConnectedRole[]; csrf?: string; expiresAt?: number; }
export interface PrivateCharacter { id: number; name: string; icon: string; element: string; rarity: number | null; level: number | null; friendship: number | null; constellation: number | null; }
export interface PrivateStat { label: string; value: string; }
export interface PrivateEquipment { name: string; icon: string; level: number | null; stats: PrivateStat[]; }
export interface PrivateBuild extends PrivateCharacter {
  image: string; stats: PrivateStat[];
  weapon: (PrivateEquipment & { refinement: number | null; rarity: number | null }) | null;
  artifacts: Array<PrivateEquipment & { slot: string; set: string }>;
  skills: Array<{ name: string; icon: string; level: number | null; description: string }>;
  constellations: Array<{ name: string; icon: string; unlocked: boolean; description: string }>;
}
export interface PrivateProfile {
  role: ConnectedRole; updatedAt: number; unavailable: string[];
  stats: { achievements: number | null; daysActive: number | null; characters: number | null; abyss: string | null; theaterAct: number | null; stygian: string | null; waypoints: number | null; domains: number | null; chests: Array<{ label: string; value: number | null }> };
  notes: null | { resin: number | null; maxResin: number | null; recoverySeconds: number | null; commissions: number | null; maxCommissions: number | null; commissionRewardClaimed: boolean | null; realmCurrency: number | null; maxRealmCurrency: number | null; expeditions: Array<{ icon: string; status: string; remainingSeconds: number | null }> };
  exploration: Array<{ name: string; icon: string; percentage: number | null; level: number | null }>;
  characters: PrivateCharacter[];
}
