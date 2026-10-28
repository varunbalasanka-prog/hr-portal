/** Poster QR codes use hr.balasanka.in/j/<code>, where <code> is the start of the branch id.
 *  Nothing is stored: the code is always worked out from the id, so it never changes and old posters keep working. */
export const SHORT_CODE_LENGTH = 6;

export const shortCode = (branchId: string) => branchId.replace(/-/g, "").slice(0, SHORT_CODE_LENGTH).toLowerCase();

/** The one branch whose id starts with this code, or null when none or more than one does. */
export function branchForCode<T extends { id: string }>(code: string, branches: T[]): T | null {
  const c = code.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (c.length < SHORT_CODE_LENGTH) return null;
  const hits = branches.filter((b) => b.id.replace(/-/g, "").toLowerCase().startsWith(c));
  return hits.length === 1 ? hits[0] : null;
}
