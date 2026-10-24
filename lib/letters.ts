import "server-only";
import { notFound } from "next/navigation";
import { lookupToken } from "./candidate-token";

/** Candidate + branch for a letter link. The token is a random UUID, so links can't be guessed from a mobile number.
 *  An expired link returns { expired: true } so the page can say so. */
export async function loadLetter(token: string) {
  const found = await lookupToken(token);
  if (!found) notFound();
  if (found.expired) return { expired: true as const };
  const { candidate: c, branch } = found;
  const address = branch?.address ?? "Balasanka Group of Companies, Tamil Nadu";
  const companyName = address.split(",")[0].trim();
  return { expired: false as const, c, branch, address, companyName };
}
