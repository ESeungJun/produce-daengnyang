/**
 * 데뷔 화보 동영상·GIF 규칙(#31, 2026-11-19 사용자 결정). 화면(GalleryForm·media.ts)과 시험이 같이 쓴다.
 * DB check_gallery_set 의 한도와 같아야 한다: GIF 5MB, 동영상 20MB·2개, 화보 10칸(GALLERY_MAX).
 */
import type { GalleryKind } from "@/features/entries/api";

export const MEDIA_LIMIT = {
  gifBytes: 5 * 1024 * 1024,
  videoBytes: 20 * 1024 * 1024,
  videoSeconds: 15,
  videos: 2,
} as const;

export type MediaError = "not_media" | "not_image" | "too_big" | "unsupported" | "gif_too_big" | "gif_unreadable" | "video_too_big" | "video_too_long" | "video_unreadable" | "too_many_videos";

export const MEDIA_ERROR_TEXT: Record<MediaError, string> = {
  not_media: "사진·GIF·동영상(MP4·WebM·MOV)만 넣을 수 있어요",
  not_image: "이 사진은 열 수 없어요. JPG·PNG 로 다시 골라 주세요",
  too_big: "사진이 너무 커요. 다른 사진을 골라 주세요",
  unsupported: "이 브라우저에서는 사진을 줄일 수 없어요. 최신 크롬·사파리에서 올려 주세요",
  gif_too_big: "GIF 는 5MB 까지예요. 더 짧은 GIF 를 골라 주세요",
  gif_unreadable: "이 GIF 는 열 수 없어요. 다른 GIF 를 골라 주세요",
  video_too_big: "동영상은 20MB 까지예요. 사진 앱의 편집에서 앞뒤를 잘라 짧게 만들어 주세요",
  video_too_long: "동영상은 15초까지예요. 사진 앱의 편집에서 앞뒤를 잘라 다시 골라 주세요",
  video_unreadable: "이 동영상은 열 수 없어요. 다른 동영상을 골라 주세요",
  too_many_videos: "동영상은 2개까지예요",
};

/** 파일 형식(MIME)으로 종류를 정한다. 받지 않는 형식이면 null */
export function mediaKindOf(type: string): GalleryKind | null {
  if (type === "image/gif") return "gif";
  if (type.startsWith("image/")) return "photo";
  if (type === "video/mp4" || type === "video/webm" || type === "video/quicktime") return "video";
  return null;
}

/** GIF·동영상을 올릴 때 붙일 확장자. DB 는 이 확장자로 종류를 다시 확인한다 */
export function mediaExt(type: string): "gif" | "mp4" | "webm" | "mov" {
  if (type === "image/gif") return "gif";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  return "mp4";
}
