/** 화보 동영상·GIF 규칙(#31): 종류 판정과 올릴 확장자. DB check_gallery_set 이 확장자로 종류를 다시 보므로 둘이 어긋나면 안 된다 */
import { describe, expect, it } from "vitest";
import { MEDIA_ERROR_TEXT, MEDIA_LIMIT, mediaExt, mediaKindOf } from "./mediaRules";

describe("mediaKindOf", () => {
  it("GIF 는 사진이 아니라 gif", () => expect(mediaKindOf("image/gif")).toBe("gif"));
  it("다른 그림은 사진", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic"]) expect(mediaKindOf(t)).toBe("photo");
  });
  it("MP4·WebM·MOV 는 동영상", () => {
    for (const t of ["video/mp4", "video/webm", "video/quicktime"]) expect(mediaKindOf(t)).toBe("video");
  });
  it("그 밖의 동영상·파일은 받지 않는다", () => {
    for (const t of ["video/x-msvideo", "video/ogg", "application/pdf", ""]) expect(mediaKindOf(t)).toBeNull();
  });
});

describe("mediaExt", () => {
  it("형식마다 DB 가 아는 확장자", () => {
    expect(mediaExt("image/gif")).toBe("gif");
    expect(mediaExt("video/mp4")).toBe("mp4");
    expect(mediaExt("video/webm")).toBe("webm");
    expect(mediaExt("video/quicktime")).toBe("mov");
  });
  it("동영상으로 판정된 형식은 모두 DB 정규식(gif|mp4|webm|mov)에 맞는 확장자를 받는다", () => {
    for (const t of ["image/gif", "video/mp4", "video/webm", "video/quicktime"]) expect(mediaExt(t)).toMatch(/^(gif|mp4|webm|mov)$/);
  });
});

describe("한도", () => {
  it("사용자 결정(2026-11-19): GIF 5MB, 동영상 20MB·15초·2개", () => {
    expect(MEDIA_LIMIT).toEqual({ gifBytes: 5 * 1024 * 1024, videoBytes: 20 * 1024 * 1024, videoSeconds: 15, videos: 2 });
  });
  it("오류 문구는 한도 숫자와 맞는다", () => {
    expect(MEDIA_ERROR_TEXT.gif_too_big).toContain("5MB");
    expect(MEDIA_ERROR_TEXT.video_too_big).toContain("20MB");
    expect(MEDIA_ERROR_TEXT.video_too_long).toContain("15초");
    expect(MEDIA_ERROR_TEXT.too_many_videos).toContain("2개");
  });
});
