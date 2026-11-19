/** 동영상 위치 지우기(#31): 상자 크기를 지키면서 udta·meta·uuid 만 비우는지 */
import { describe, expect, it } from "vitest";
import { stripVideoMeta } from "./videoMeta";

/** 상자 하나를 만든다: [크기 4바이트][이름 4글자][내용] */
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const body = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(8 + body);
  new DataView(out.buffer).setUint32(0, 8 + body);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  let at = 8;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
const text = (s: string) => new TextEncoder().encode(s);
const join = (...p: Uint8Array[]) => box("____", ...p).slice(8);
const has = (b: Uint8Array, s: string) => new TextDecoder("latin1").decode(b).includes(s);

describe("stripVideoMeta", () => {
  const GPS = "+37.5665+126.9780/";
  const make = () =>
    join(
      box("ftyp", text("qt  ")),
      box("moov", box("mvhd", text("header")), box("meta", text(`com.apple.quicktime.location.ISO6709${GPS}`)), box("trak", box("tkhd", text("t")), box("udta", text(`\xa9xyz${GPS}`)))),
      box("mdat", text("frames")),
    );

  it("moov·trak 안의 위치를 지우고 크기는 그대로", () => {
    const file = make();
    const len = file.length;
    expect(has(file, GPS)).toBe(true);
    expect(stripVideoMeta(file)).toBe(2);
    expect(file.length).toBe(len);
    expect(has(file, GPS)).toBe(false);
    expect(has(file, "free")).toBe(true);
    // 재생에 쓰는 상자는 그대로
    expect(has(file, "mvhd") && has(file, "tkhd") && has(file, "frames")).toBe(true);
  });

  it("위치가 없으면 0개, 내용 그대로", () => {
    const file = join(box("ftyp", text("isom")), box("moov", box("mvhd", text("h"))), box("mdat", text("x")));
    const copy = file.slice();
    expect(stripVideoMeta(file)).toBe(0);
    expect(file).toEqual(copy);
  });

  it("끝까지 가는 크기 0 상자를 읽는다", () => {
    const tail = box("mdat", text("frames"));
    new DataView(tail.buffer).setUint32(0, 0);
    expect(stripVideoMeta(join(box("ftyp", text("isom")), box("moov", box("udta", text(GPS))), tail))).toBe(1);
  });

  it("64비트 크기 상자를 읽는다", () => {
    const big = new Uint8Array(16 + 4);
    const v = new DataView(big.buffer);
    v.setUint32(0, 1);
    big.set(text("mdat"), 4);
    v.setBigUint64(8, BigInt(big.length));
    expect(stripVideoMeta(join(box("ftyp", text("isom")), box("moov", box("meta", text(GPS))), big))).toBe(1);
  });

  it("크기가 파일을 넘거나 잘린 파일은 null", () => {
    const file = join(box("ftyp", text("isom")), box("moov", box("udta", text(GPS))));
    new DataView(file.buffer).setUint32(0, 999);
    expect(stripVideoMeta(file)).toBeNull();
    expect(stripVideoMeta(text("not a video"))).toBeNull();
  });
});
