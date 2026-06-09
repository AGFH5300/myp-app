export const QUESTION_ASSET_BUCKET = 'question-assets'
const SIGNED_URL_TTL_SECONDS = 60 * 30

type SupabaseLike = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
      upload: (path: string, file: File, options?: { upsert?: boolean; contentType?: string }) => Promise<{ data: unknown; error: unknown }>
    }
  }
}

export function isDirectAssetUrl(value: string | null | undefined) {
  return Boolean(value && (/^https?:\/\//i.test(value) || value.startsWith('/')))
}

export async function resolveQuestionAssetUrl(supabase: SupabaseLike, value: string | null | undefined) {
  if (!value) return null
  if (isDirectAssetUrl(value)) return value

  const { data, error } = await supabase.storage
    .from(QUESTION_ASSET_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export type QuestionAssetRow = {
  storage_path: string | null
  public_url: string | null
  label?: string | null
  sort_order?: number | null
}

export type ResolvedQuestionAsset = {
  url: string
  label: string | null
}

export async function resolveQuestionAssetImages(supabase: SupabaseLike, assets: QuestionAssetRow[], fallbackValue: string | null | undefined) {
  const sourceAssets = assets.length ? assets : fallbackValue ? [{ storage_path: fallbackValue, public_url: null, label: null }] : []
  const resolved = await Promise.all(sourceAssets.map(async (asset) => {
    const url = await resolveQuestionAssetUrl(supabase, asset.storage_path || asset.public_url)
    return url ? { url, label: asset.label ?? null } : null
  }))

  return resolved.filter((asset): asset is ResolvedQuestionAsset => Boolean(asset))
}

export async function uploadQuestionAsset(supabase: SupabaseLike, file: File | null, folder: 'questions' | 'markschemes') {
  if (!file || file.size === 0) return null

  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset'
  const path = `${folder}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from(QUESTION_ASSET_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })

  if (error) throw new Error(`Could not upload ${folder} asset.`)
  return path
}
