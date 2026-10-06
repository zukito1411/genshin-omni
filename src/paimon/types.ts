export type PaimonPage = 'dashboard' | 'characters' | 'character' | 'weapons' | 'weapon' | 'artifacts' | 'artifact' | 'teams' | 'materials' | 'compare' | 'account' | 'profile' | 'map' | 'guides' | 'sources';
export interface PaimonReply { text: string; route?: string; actionLabel?: string; source?: 'ai' | 'native'; }
export interface PaimonContext { page: PaimonPage; name?: string; }
