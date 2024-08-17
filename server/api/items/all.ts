export default defineEventHandler(async (event) => {
  // get all json files from tld-data folder and return them
  const tools = await import("../../../tld-data/tools.json");
  const clothing = await import("../../../tld-data/clothing.json");
  const firstAid = await import("../../../tld-data/first-aid.json");
  const foods = await import("../../../tld-data/foods.json");
  const materials = await import("../../../tld-data/materials.json");

  return {
    tools,
    clothing,
    firstAid,
    foods,
    materials,
  };
});
