// return regions from tld-data/regions.json for now
import { Region } from "~~/server/api/regions/type";

export default defineEventHandler(async () => {
  // const { regions } = (await import("../../../tld-data/regions.json")) as {
  //   regions: Region[];
  // };

  return [];
});
