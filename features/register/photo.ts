"use client";
/**
 * 고른 사진을 브라우저에서 다시 그려 WebP 두 장(큰 사진 1600·목록 480)을 만든다(설계서 1-7).
 * 캔버스에 다시 그리면 EXIF(촬영 위치 등)가 따라오지 않는다. 휴대폰 사진의 회전값은 createImageBitmap 이 반영한다.
 * WebP 를 못 만드는 브라우저(사파리: 캔버스가 WebP 대신 PNG 를 준다)는 JPEG 로 만든다. Storage 는 WebP·JPEG·2MB 만 받는다.
 * 큰 사진이 2MB 를 넘으면 품질을 낮춰 한 번 더 만든다.
 */
import { PHOTO_LONG, THUMB_LONG, fitSize } from "./fields";

export type ProcessedPhoto = { big: Blob; thumb: Blob };

/** 올릴 파일 확장자(Blob 형식으로 정한다) */
export const photoExt = (b: Blob) => (b.type === "image/jpeg" ? "jpg" : "webp");


const LIMIT = 2 * 1024 * 1024;

export class PhotoError extends Error {
  constructor(readonly reason: "not_image" | "too_big" | "unsupported") {
    super(reason);
  }
}

/** 이 브라우저가 캔버스에서 WebP 를 만들 수 있는지(한 번만 확인). 못 하면 JPEG 로 만든다. */
let webpOk: boolean | null = null;
function canWebp(): boolean {
  if (webpOk === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpOk;
}

async function draw(bmp: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const { w, h } = fitSize(bmp.width, bmp.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("unsupported");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const type = canWebp() ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  // 그래도 다른 형식이 오면 Storage 가 받지 않으므로 여기서 멈춘다.
  if (!blob || blob.type !== type) throw new PhotoError("unsupported");
  return blob;
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  if (!file.type.startsWith("image/")) throw new PhotoError("not_image");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // HEIC 처럼 브라우저가 읽지 못하는 형식
    throw new PhotoError("not_image");
  }
  try {
    let big = await draw(bmp, PHOTO_LONG, 0.86);
    if (big.size > LIMIT) big = await draw(bmp, PHOTO_LONG, 0.7);
    if (big.size > LIMIT) throw new PhotoError("too_big");
    const thumb = await draw(bmp, THUMB_LONG, 0.82);
    return { big, thumb };
  } finally {
    bmp.close();
  }
}
