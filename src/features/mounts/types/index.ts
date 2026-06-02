export type LinkReference = {
  href: string;
};

export type LocalizedString = string | { [locale: string]: string | undefined };

export type MountSummary = {
  id: number;
  name: string;
  href: string;
  description?: string;
  source?: string;
  displayId?: number;
};

export type MountIndexEntry = {
  id: number;
  name: string;
  key: LinkReference;
};

export type MountIndexResponse = {
  mounts: MountIndexEntry[];
};

export type MountDetail = {
  id: number;
  name: string;
  description: string;
  source?: string;
  href: string;
  displayId?: number;
};
