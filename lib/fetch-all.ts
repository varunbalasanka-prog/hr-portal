type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Supabase returns at most 1000 rows per request (a server setting that .limit() can't raise),
 * so read a list in pages. `page(from, to)` must apply a stable order and .range(from, to).
 */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}
