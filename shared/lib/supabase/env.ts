/**
 * Supabase 접속 값. 둘 다 브라우저에 나가도 되는 공개 값(publishable 키)이라 NEXT_PUBLIC_ 으로 빌드에 넣는다.
 * 비어 있으면 화면이 조용히 빈 목록을 보여 주는 대신 바로 알아챌 수 있게 던진다(.env.example 참고).
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 없어요(.env.local)");
  return { url, key };
}

/** 사진 버킷(공개). 경로는 DB 의 entry_photos.path·thumb_path 그대로다. */
export const PHOTO_BUCKET = "entry-photos";

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseEnv().url}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
