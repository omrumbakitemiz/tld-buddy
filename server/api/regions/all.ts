// return regions from tld-data/regions.json for now

export default defineEventHandler(async (event) => {
  const { regions } = (await import("../../../tld-data/regions.json")) as {
    regions: {
      name: string;
      slug: string;
      type: string;
      world: string;
      difficulty: string;
      area_size: number;
      modes: string[];
      release_date: string;
    }[];
  };

  console.log(regions);

  return regions;
});
