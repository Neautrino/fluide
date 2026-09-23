/** SOURCE OF TRUTH: local text embedding generation (S1-3 Tier 2).
 * WHAT: wraps @huggingface/transformers' feature-extraction pipeline with
 * Xenova/all-MiniLM-L6-v2 (384-dim, ~23MB, ONNX, runs in-process).
 * WHY: no API key, no network call, no per-request cost, fully
 * self-hostable -- matches Fluide's self-hosted-first principle better
 * than an API-only Jev/embeddings-service path would.
 * WHERE: model downloads once to a local cache dir on first call, then
 * reuses the pipeline singleton for every subsequent embed().
 */
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as Promise<FeatureExtractionPipeline>
  }
  return extractorPromise
}

/** Embeds a single string to a 384-dim mean-pooled, L2-normalized vector. */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

/** Embeds many strings in one batched forward pass -- cheaper than N embed() calls. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const extractor = await getExtractor()
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  const dims = output.dims as number[]
  const flat = output.data as Float32Array
  const batchSize = dims[0] ?? 0
  const dim = dims[1] ?? 0
  const vectors: number[][] = []
  for (let i = 0; i < batchSize; i++) {
    vectors.push(Array.from(flat.slice(i * dim, (i + 1) * dim)))
  }
  return vectors
}
