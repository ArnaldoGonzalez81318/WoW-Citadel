export enum FactionType {
	HORDE = "HORDE",
	ALLIANCE = "ALLIANCE",
}

export enum GenderType {
	MALE = "MALE",
	FEMALE = "FEMALE",
}

export interface Player {
	wow_accounts: WowAccount[];
}

export interface WowAccount {
	characters: Character[];
}

export interface Character {
	character: {
		href: string;
	};
	name: string;
	realm: {
		name: string;
	};
	playableClass: {
		svg: string;
	};
	playableRace: {
		name: string;
	};
	gender: {
		type: GenderType;
		name: string;
	};
	faction: {
		type: FactionType;
		name: string;
	};
	level: number;
}