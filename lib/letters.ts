import "server-only";
import { notFound } from "next/navigation";
import { lookupToken } from "./candidate-token";

/** Candidate + branch for a letter link. The token is a random UUID, so links can't be guessed from a mobile number. */
export async function loadLetter(token: string) {
  const found = await lookupToken(token);
  if (!found) notFound();
  const { candidate: c, branch } = found;
  const address = branch?.address ?? "Balasanka Group of Companies, Tamil Nadu";
  const companyName = address.split(",")[0].trim();
  return { c, branch, address, companyName };
}
