export interface EnkaStat {
  mainPropId?: string;
  appendPropId?: string;
  propValue?: number;
}

export interface EnkaEquipment {
  itemId?: number;
  weapon?: { level?: number; promoteLevel?: number; affixMap?: Record<string, number> };
  reliquary?: { level?: number; mainPropId?: number; appendPropIdList?: number[] };
  flat?: {
    nameTextMapHash?: string | number;
    setNameTextMapHash?: string | number;
    rankLevel?: number;
    icon?: string;
    itemType?: string;
    equipType?: string;
    weaponStats?: EnkaStat[];
    reliquaryMainstat?: EnkaStat;
    reliquarySubstats?: EnkaStat[];
  };
}

export interface EnkaAvatar {
  avatarId?: number;
  avatarID?: number;
  skillDepotId?: number;
  costumeId?: number;
  propMap?: Record<string, { val?: string | number; ival?: string | number }>;
  fightPropMap?: Record<string, number>;
  skillLevelMap?: Record<string, number>;
  proudSkillExtraLevelMap?: Record<string, number>;
  talentIdList?: number[];
  equipList?: EnkaEquipment[];
  fetterInfo?: { expLevel?: number };
}

export interface EnkaProfile {
  uid?: string;
  ttl?: number;
  region?: string;
  playerInfo: {
    nickname?: string;
    signature?: string;
    level?: number;
    worldLevel?: number;
    finishAchievementNum?: number;
    towerFloorIndex?: number;
    towerLevelIndex?: number;
    towerStarIndex?: number;
    nameCardId?: number;
    namecardId?: number;
    profilePicture?: { id?: number; avatarId?: number; costumeId?: number };
    showNameCardIdList?: number[];
    showAvatarInfoList?: { avatarId: number; level?: number; costumeId?: number }[];
  };
  avatarInfoList?: EnkaAvatar[];
}

export interface EnkaCharacterMetadata {
  Element?: string;
  NameTextMapHash?: number;
  SideIconName?: string;
  Consts?: string[];
  Skills?: Record<string, string>;
  SkillOrder?: number[];
  ProudMap?: Record<string, number>;
  Costumes?: Record<string, { icon?: string; art?: string }>;
  QualityType?: string;
}

export interface EnkaMetadata {
  characters: Record<string, EnkaCharacterMetadata>;
  text: Record<string, string>;
  namecards?: Record<string, { icon?: string }>;
  profilePictures?: Record<string, { iconPath?: string }>;
}
