/**
 * 데뷔 화보 인스타 이미지(#18). 스토리 1080×1920 · 피드 1080×1350.
 * 웹사이트가 인스타에 직접 올리는 길은 인스타가 막아 두어, 이미지를 만들어 휴대폰 공유창(InstaShare)으로 넘긴다.
 * 사진을 꽉 채우고 아래 그늘 위에 "10월 데뷔 · 댕댕이" 알약, 큰 이름, 표 수, 맨 아래 사이트 이름·주소를 둔다(메인 표지와 같은 모양).
 * 스토리는 인스타가 위아래 250px 쯤을 가리므로 글은 아래 여백을 넓게 둔다.
 * 글꼴·사진은 og.tsx 와 같은 방식으로 받는다(글꼴 실패면 글자 없이 사진만, 사진 실패면 회색 판).
 */
import { ImageResponse } from "next/og";
import { googleFont, photoData } from "./og";

export const INSTA_FORMATS = {
  story: { width: 1080, height: 1920, bottom: 300 },
  feed: { width: 1080, height: 1350, bottom: 96 },
} as const;
export type InstaFormat = keyof typeof INSTA_FORMATS;

export function isInstaFormat(v: string): v is InstaFormat {
  return v === "story" || v === "feed";
}

/** 이름이 길면 줄인다(이름은 20자까지). 폭 1080 기준 */
export function instaNameSize(name: string): number {
  const n = [...name].length;
  return n <= 3 ? 220 : n <= 5 ? 180 : n <= 8 ? 130 : n <= 12 ? 96 : 72;
}

const C = { ink: "#141414", white: "#FFFFFF", butter: "#FFE58A", pink: "#E0457B", shade: "rgba(0,0,0," };

type Insta = { format: InstaFormat; petName: string; kick: string; votes: string; photo: string | null | undefined; host: string };

export async function instaImage({ format, petName, kick, votes, photo, host }: Insta): Promise<ImageResponse> {
  const f = INSTA_FORMATS[format];
  const brand = "프로듀스 댕냥";
  const [display, body, src] = await Promise.all([
    googleFont("Black Han Sans", brand + petName + kick),
    googleFont("Gowun Dodum", votes + host + "데뷔 화보"),
    photoData(photo, f.width, f.height),
  ]);
  const fonts = [
    ...(display ? [{ name: "display", data: display, weight: 400 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "body", data: body, weight: 400 as const, style: "normal" as const }] : []),
  ];
  const text = !!(display && body);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#F0F0F0" }}>
        {src ? <img src={src} alt="" width={f.width} height={f.height} style={{ position: "absolute", left: 0, top: 0, width: f.width, height: f.height, objectFit: "cover" }} /> : null}
        {text ? (
          // next/og 는 묶음(<>)을 따로 놓을 수 있어 화면 전체 상자로 감싼다
          <div style={{ position: "absolute", left: 0, top: 0, width: f.width, height: f.height, display: "flex" }}>
            {/* 위 그늘(사이트 이름) · 아래 그늘(글) */}
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 360, display: "flex", background: `linear-gradient(${C.shade}0.45), ${C.shade}0))` }} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: f.height * 0.55, display: "flex", background: `linear-gradient(${C.shade}0), ${C.shade}0.35) 40%, ${C.shade}0.72))` }} />
            <div style={{ position: "absolute", left: 72, right: 72, top: format === "story" ? 220 : 64, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", fontFamily: "display", fontSize: 48, color: C.white }}>
                프로듀스&nbsp;<span style={{ color: C.butter }}>댕냥</span>
              </div>
              <div style={{ display: "flex", fontFamily: "body", fontSize: 32, color: C.white, opacity: 0.9 }}>데뷔 화보</div>
            </div>
            <div style={{ position: "absolute", left: 72, right: 72, bottom: f.bottom, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", fontFamily: "display", fontSize: 40, color: C.ink, background: C.butter, borderRadius: 999, padding: "10px 28px" }}>{kick}</div>
              <div style={{ display: "flex", fontFamily: "display", fontSize: instaNameSize(petName), lineHeight: 1.05, color: C.white, marginTop: 18, letterSpacing: -3 }}>{petName}</div>
              <div style={{ display: "flex", fontFamily: "body", fontSize: 38, color: C.white, background: C.pink, borderRadius: 14, padding: "10px 22px", marginTop: 18 }}>{votes}</div>
              <div style={{ display: "flex", fontFamily: "body", fontSize: 30, color: C.white, opacity: 0.85, marginTop: 36 }}>{host}</div>
            </div>
          </div>
        ) : null}
      </div>
    ),
    { width: f.width, height: f.height, fonts, headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } },
  );
}
