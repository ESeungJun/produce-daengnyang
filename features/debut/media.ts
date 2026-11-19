"use client";
/**
 * 데뷔 화보에 넣을 파일 하나를 올릴 꼴로 만든다(#31). 부르는 곳: GalleryForm.
 * - 사진: 지금처럼 WebP 두 장으로 줄인다(processPhoto).
 * - GIF: 줄이면 움직임이 사라져서 원본 그대로 올리고(5MB 이하), 첫 장면을 미리보기 그림으로 만든다.
 * - 동영상: 브라우저에서 줄일 수 없어 원본 그대로(20MB·15초 이하). 첫 장면을 그려 미리보기 그림(poster)으로 쓴다.
 *   MP4·MOV 는 올리기 전에 촬영 위치 같은 메타데이터를 지운다(videoMeta.ts, 개인정보 처리방침의 약속).
 *   첫 장면을 못 그리면(크롬의 아이폰 HEVC 등) 다른 사람도 못 볼 가능성이 커서 받지 않는다.
 * 한도는 DB(check_gallery_set)도 다시 확인한다. 길이(15초)만은 DB 가 모르므로 여기서만 본다.
 */
import { PhotoError, draw, processPhoto, type ProcessedPhoto } from "@/features/register/photo";
import { PHOTO_LONG } from "@/features/register/fields";
import { MEDIA_LIMIT, mediaKindOf, type MediaError } from "./mediaRules";
import { stripVideoMeta } from "./videoMeta";

export type NewMedia =
  | { media: "photo"; photo: ProcessedPhoto; preview: Blob }
  | { media: "gif" | "video"; file: Blob; thumb: Blob; preview: Blob };

export class MediaFail extends Error {
  constructor(readonly reason: MediaError) {
    super(reason);
  }
}

export async function processMedia(file: File): Promise<NewMedia> {
  const kind = mediaKindOf(file.type);
  if (!kind) throw new MediaFail("not_media");
  if (kind === "photo") {
    const photo = await processPhoto(file).catch((e) => {
      throw new MediaFail(e instanceof PhotoError ? e.reason : "not_image");
    });
    return { media: "photo", photo, preview: photo.thumb };
  }
  if (kind === "gif") {
    if (file.size > MEDIA_LIMIT.gifBytes) throw new MediaFail("gif_too_big");
    // createImageBitmap 은 GIF 의 첫 장면을 준다. 미리보기 그림은 사진과 같은 크기로(화보 벽의 자리 그림)
    // 첫 장면 그림이 너무 크거나 이 브라우저가 못 그리면 사진과 같은 이유를 그대로 알린다
    const { big } = await processPhoto(file).catch((e) => {
      throw new MediaFail(e instanceof PhotoError && e.reason !== "not_image" ? e.reason : "gif_unreadable");
    });
    return { media: "gif", file, thumb: big, preview: big };
  }
  if (file.size > MEDIA_LIMIT.videoBytes) throw new MediaFail("video_too_big");
  const thumb = await videoPoster(file);
  return { media: "video", file: await withoutMeta(file), thumb, preview: thumb };
}

/** MP4·MOV 는 위치 같은 메타데이터를 지운 사본을 올린다. 구조를 못 읽는 파일은 받지 않는다(다른 사람도 못 볼 가능성이 크다) */
async function withoutMeta(file: File): Promise<Blob> {
  if (file.type === "video/webm") return file;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (stripVideoMeta(bytes) === null) throw new MediaFail("video_unreadable");
  return new Blob([bytes], { type: file.type });
}

/** 동영상 길이를 보고, 앞쪽 한 장면을 그려 WebP 로 만든다 */
async function videoPoster(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    // 1. 길이는 메타데이터만으로 안다(아이폰 사파리는 재생 전에는 장면을 받지 않는 일이 많다)
    await waitFor(v, "loadedmetadata");
    // 길이를 모르는 파일(일부 녹화 WebM)은 15초를 확인할 수 없어 받지 않는다(길이 초과와 다른 문구)
    if (!Number.isFinite(v.duration)) throw new MediaFail("video_unreadable");
    if (v.duration > MEDIA_LIMIT.videoSeconds + 0.5) throw new MediaFail("video_too_long");
    // 2. 장면이 아직 없으면 소리 없이 잠깐 재생해 깨운다(파일을 고른 직후라 사용자 동작으로 친다)
    if (v.readyState < 2) {
      await v.play().catch(() => null);
      v.pause();
      if (v.readyState < 2) await waitFor(v, "loadeddata");
    }
    // 첫 프레임이 검은 화면인 영상이 많아 조금 뒤 장면을 쓴다
    v.currentTime = Math.min(0.5, v.duration / 2);
    await waitFor(v, "seeked");
    if (!v.videoWidth || !v.videoHeight) throw new MediaFail("video_unreadable");
    const bmp = await createImageBitmap(v).catch(() => {
      throw new MediaFail("video_unreadable");
    });
    try {
      return await draw(bmp, PHOTO_LONG, 0.82);
    } catch (e) {
      throw new MediaFail(e instanceof PhotoError ? e.reason : "video_unreadable");
    } finally {
      bmp.close();
    }
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** 이벤트 한 번을 기다린다. 오류나 10초 넘김이면 읽을 수 없는 동영상으로 본다 */
function waitFor(v: HTMLVideoElement, ev: "loadedmetadata" | "loadeddata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (ok: boolean) => {
      clearTimeout(t);
      v.removeEventListener(ev, onOk);
      v.removeEventListener("error", onErr);
      if (ok) resolve();
      else reject(new MediaFail("video_unreadable"));
    };
    const onOk = () => done(true);
    const onErr = () => done(false);
    const t = setTimeout(() => done(false), 10_000);
    v.addEventListener(ev, onOk, { once: true });
    v.addEventListener("error", onErr, { once: true });
  });
}
