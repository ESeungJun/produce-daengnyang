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
/** 데뷔 화보의 GIF·동영상 버킷(공개, #31). 사진·미리보기 그림은 PHOTO_BUCKET 에 둔다. */
export const MEDIA_BUCKET = "debut-media";

/** GIF·동영상 파일인지(확장자로 가린다). 이런 파일은 MEDIA_BUCKET 에 있다. */
export const isMediaPath = (path: string) => /\.(gif|mp4|webm|mov)$/i.test(path);
/** 동영상 파일인지. 그림(img)으로 그릴 수 없는 파일을 거를 때 쓴다. */
export const isVideoPath = (path: string) => /\.(mp4|webm|mov)$/i.test(path);

/** 파일의 공개 주소. 확장자로 버킷을 고르므로 사진·GIF·동영상 모두 이 함수 하나로 부른다. */
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const bucket = isMediaPath(path) ? MEDIA_BUCKET : PHOTO_BUCKET;
  return `${supabaseEnv().url}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
