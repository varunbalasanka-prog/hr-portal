/** Login usernames map to a pseudo-email inside Supabase Auth, e.g. "caratlane - theni" -> caratlane.theni@<domain>. */
export function usernameToEmail(username: string): string {
  const slug = username.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `${slug}@${process.env.AUTH_EMAIL_DOMAIN ?? "staff.balasanka-hr.local"}`;
}
