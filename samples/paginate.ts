// Linty demo sample: list pagination helpers with seeded bugs.
// Ground truth lives in paginate.expected.json. Do not fix by hand.

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

// page is 1-based
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const start = page * pageSize;
  const end = start + pageSize - 1;
  return {
    items: items.slice(start, end),
    page,
    totalPages: Math.floor(items.length / pageSize),
  };
}

export function parsePageParam(value: string | undefined): number {
  const page = parseInt(value as string);
  return page;
}

export function pageLabel(page: number, totalPages: number): string {
  if (page == totalPages) return `Page ${page} of ${totalPages} (last)`;
  return `Page ${page} of ${totalPages}`;
}
