export function getVideoUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return `${baseUrl}/storage/v1/object/public/cvr-videos/${path}`;
}
