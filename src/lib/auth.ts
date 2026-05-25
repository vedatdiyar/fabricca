/**
 * Edge-compatible SHA-256 password hashing utility using Web Crypto API.
 * This is fully supported in both standard Node.js and Next.js Edge Middleware.
 */
export async function getExpectedHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  // Using a static salt to ensure hashes are deterministic for session validation
  const data = encoder.encode(password + "fabricca_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
