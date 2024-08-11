// return region details by id by filtering all items based on region id
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  console.log('slug', slug);
  

  if (!slug) {
    return new Response('Not Found', { status: 404 });
  }

  // get all regions from tld-data/regions.json
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

  const region = regions.find((region) => region.slug === slug);

  if (!region) {
    return new Response('Not Found', { status: 404 });
  }

  const response = {
    ...region,
    items: [
      {
        name: "Test Item",
        description: "This is a test item",
      },
      {
        name: "Test Item 2",
        description: "This is a test item 2",
      }
    ]
  };

  return response;
});
