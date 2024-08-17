export type Region = {
  name: string;
  slug: string;
  type: string;
  world: string;
  difficulty: string;
  area_size: number;
  modes: string[];
  release_date: string;
}

export type RegionItem = {
  id: number;
  regionSlug: string;
  itemName: string;
  itemType: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RegionDetails = Region & {
  items: RegionItem[];
}
