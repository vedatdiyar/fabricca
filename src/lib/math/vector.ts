/**
 * İki vektör arasındaki kosinüs benzerliğini (cosine similarity) hesaplar.
 *
 * @param vecA - Birinci vektör
 * @param vecB - İkinci vektör
 * @returns Kosinüs benzerlik skoru (-1 ile 1 arasında, 1 tam benzerliktir)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
