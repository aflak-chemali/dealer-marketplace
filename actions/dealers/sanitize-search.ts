/**
 * Strips characters that have meaning inside PostgREST `or()` filters so user
 * search input cannot inject extra filter clauses.
 */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()*%\\:."']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
