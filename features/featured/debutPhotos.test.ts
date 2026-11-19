import { describe, expect, it } from "vitest";
import { debutPhotos, type FeaturedCard } from "./api";

const card = (over: Partial<FeaturedCard>) => ({ path: "a.webp", ...over }) as FeaturedCard;

describe("debutPhotos (#16 데뷔 사진 자동 넘김)", () => {
  it("사진 목록이 있으면 그 순서대로", () => expect(debutPhotos(card({ photos: [{ path: "x", thumb_path: null }, { path: "y", thumb_path: null }] }))).toEqual(["x", "y"]));
  it("목록이 없거나 비면 대표 사진 한 장", () => {
    expect(debutPhotos(card({}))).toEqual(["a.webp"]);
    expect(debutPhotos(card({ photos: [] }))).toEqual(["a.webp"]);
  });
  it("대표 사진도 없으면 빈 목록", () => expect(debutPhotos(card({ path: null as unknown as string }))).toEqual([]));
});

import { railPhotos } from "./DebutRail";
describe("railPhotos (#16 세로 배너는 두 번째 장부터)", () => {
  it("여러 장이면 한 칸 돌림", () => expect(railPhotos(["a", "b", "c"])).toEqual(["b", "c", "a"]));
  it("한 장·빈 목록은 그대로", () => {
    expect(railPhotos(["a"])).toEqual(["a"]);
    expect(railPhotos([])).toEqual([]);
  });
});

import { duoGalleryPhoto } from "./DebutDuo";
describe("duoGalleryPhoto (#26 한쪽 보기 대각선 오른쪽 칸)", () => {
  it("화보 사진이 있으면 마지막 장(세로 배너 첫 장과 겹치지 않게)", () =>
    expect(duoGalleryPhoto(card({ gallery: [{ path: "g1", thumb_path: null }, { path: "g2", thumb_path: null }] }))).toBe("g2"));
  it("화보 사진이 없거나 비면 null(원래 사진을 다른 구도로)", () => {
    expect(duoGalleryPhoto(card({}))).toBeNull();
    expect(duoGalleryPhoto(card({ gallery: [] }))).toBeNull();
  });
});
