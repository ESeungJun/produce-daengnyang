/**
 * 공유 미리보기 이미지(#8, 1200×630). 카톡·인스타·X 가 링크를 펼칠 때 가져가는 그림이다.
 * - 글: 왼쪽 대표 사진, 오른쪽 게시판·이름·"우리 애 픽해 주세요"(기획서 공유 문구).
 * - 사이트·명예의 전당: 사진 없이 흰 바탕에 분홍 제호.
 * 동작 순서
 * 1. 그림에 쓰는 글자만 담은 한글 글꼴을 Google Fonts 에서 받는다(text= 로 그 글자만, TTF). 매번 글자가 달라 요청마다 받는다.
 * 2. 사진은 서버가 직접 JPEG 로 받아 data 주소로 넣는다(photoData. next/og 가 WebP 를 못 그리고, 로컬 127.0.0.1 주소도 막아서).
 * 3. 글꼴을 못 받으면 글자 없이 사진(또는 분홍 판)만 그린다. 깨진 네모 글자가 공유되는 것보다 낫다.
 * 색은 tokens.css 값을 그대로 적는다(이미지에는 CSS 변수가 없다). 라이트 테마 하나로 그린다(메신저 미리보기 배경이 제각각이라).
 */
import { ImageResponse } from "next/og";
import { PHOTO_BUCKET, supabaseEnv } from "@/shared/lib/supabase/env";

export const OG_SIZE = { width: 1200, height: 630 };
const C = { paper: "#FFFFFF", paper2: "#F0F0F0", ink: "#141414", ink2: "#5F5F5F", pinkText: "#C2255F" };
const UA = "produce-daengnyang-og"; // 브라우저가 아닌 이름이면 Google Fonts 가 next/og 가 읽는 TTF 를 준다

export async function googleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`, {
      headers: { "User-Agent": UA },
    }).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * 사진을 받아 data 주소로. next/og 는 WebP 를 그리지 못해(빈칸이 됨) JPEG·PNG 만 쓴다.
 * 1. Supabase 이미지 변환(render)으로 width×height(기본 504×630, 인스타 이미지 #18 은 1080 폭) JPEG 를 받는다(Accept 에 webp 가 없으면 JPEG 로 준다. 운영 Pro 요금제에서 켜져 있음).
 * 2. 변환이 안 되면(로컬 등) 원본이 JPEG·PNG 일 때만 쓴다. 둘 다 아니면 null → 분홍 판.
 */
export async function photoData(path: string | null | undefined, width = 504, height = 630): Promise<string | null> {
  if (!path) return null;
  const { url } = supabaseEnv();
  const key = path.split("/").map(encodeURIComponent).join("/");
  const tries = [
    `${url}/storage/v1/render/image/public/${PHOTO_BUCKET}/${key}?width=${width}&height=${height}&resize=cover&quality=80`,
    `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${key}`,
  ];
  for (const u of tries) {
    try {
      // no-store: Next 의 fetch 캐시에 사진 원본을 담지 않는다(개발 서버에서 큰 응답을 캐시하다 멈췄다)
      const res = await fetch(u, { headers: { Accept: "image/jpeg,image/png" }, cache: "no-store" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/(jpeg|png)$/.test(type)) {
        // 본문은 기다리지 않고 버린다(Next 개발 서버의 fetch 에서 cancel 을 기다리면 끝나지 않았다)
        res.body?.cancel().catch(() => {});
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 8 * 1024 * 1024) continue;
      return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
      // 다음 방법
    }
  }
  return null;
}

/** 이름이 길면 글자를 줄인다(이름은 20자까지). */
export function nameSize(name: string): number {
  const n = [...name].length;
  return n <= 4 ? 132 : n <= 7 ? 104 : n <= 11 ? 80 : 60;
}

/** photo: 대표 사진의 저장소 경로(entry_photos.path) */
type EntryOg = { petName: string; boardName: string; photo: string | null | undefined };

const HEADERS = { "Cache-Control": "public, max-age=600, s-maxage=3600" };

/** 글 하나의 미리보기 */
export async function entryOgImage({ petName, boardName, photo }: EntryOg): Promise<ImageResponse> {
  const lines = { brand: "프로듀스 댕냥", board: `${boardName} 연습생`, ask: "우리 애 픽해 주세요", foot: "매주 센터 · 월말 데뷔 · 표는 무료" };
  const [display, body, src] = await Promise.all([
    googleFont("Black Han Sans", lines.brand + petName),
    googleFont("Gowun Dodum", lines.board + lines.ask + lines.foot),
    photoData(photo),
  ]);
  const fonts = [
    ...(display ? [{ name: "display", data: display, weight: 400 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "body", data: body, weight: 400 as const, style: "normal" as const }] : []),
  ];
  const text = !!(display && body);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.paper }}>
        {src ? (
          <img src={src} alt="" width={text ? 504 : 1200} height={630} style={{ objectFit: "cover", width: text ? 504 : 1200, height: 630 }} />
        ) : (
          // 사진을 못 받았을 때: 빈 판 대신 회색 판에 제호(사진이 깨진 것처럼 보이지 않게)
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: text ? 504 : 1200, height: 630, background: C.paper2 }}>
            {display ? <div style={{ display: "flex", fontFamily: "display", fontSize: 150, color: C.pinkText }}>댕냥</div> : null}
          </div>
        )}
        {text ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "56px 56px 52px" }}>
            <div style={{ display: "flex", fontFamily: "display", fontSize: 36, color: C.ink, letterSpacing: -1 }}>
              프로듀스&nbsp;<span style={{ color: C.pinkText }}>댕냥</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignSelf: "flex-start", fontFamily: "body", fontSize: 26, color: C.ink, background: C.paper2, borderRadius: 999, padding: "8px 22px", marginBottom: 22 }}>
                {lines.board}
              </div>
              <div style={{ display: "flex", fontFamily: "display", fontSize: nameSize(petName), color: C.ink, lineHeight: 1, letterSpacing: -2 }}>{petName}</div>
              <div style={{ display: "flex", fontFamily: "body", fontSize: 44, color: C.pinkText, marginTop: 26 }}>{lines.ask}</div>
            </div>
            <div style={{ display: "flex", fontFamily: "body", fontSize: 24, color: C.ink2 }}>{lines.foot}</div>
          </div>
        ) : null}
      </div>
    ),
    { ...OG_SIZE, fonts, headers: HEADERS },
  );
}

/** 사이트·명예의 전당처럼 글이 아닌 화면의 미리보기 */
export async function siteOgImage(title: string, sub: string): Promise<ImageResponse> {
  const [display, body] = await Promise.all([googleFont("Black Han Sans", "프로듀스댕냥" + title), googleFont("Gowun Dodum", sub)]);
  const fonts = [
    ...(display ? [{ name: "display", data: display, weight: 400 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "body", data: body, weight: 400 as const, style: "normal" as const }] : []),
  ];
  return new ImageResponse(
    (
      // 흰 종이 바탕 + 분홍 제호("분홍은 누르는 곳·맨 아래 제호에만" 규칙, #8 후속). 사이트 맨 아래 큰 제호와 같은 모양
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 88px", background: C.paper, color: C.ink }}>
        {display ? (
          // next/og 는 묶음(<>)을 부모 방향과 다르게 놓을 수 있어 세로 상자로 감싼다
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ display: "flex", fontFamily: "display", fontSize: 48, color: C.pinkText }}>프로듀스</div>
            <div style={{ display: "flex", fontFamily: "display", fontSize: 200, lineHeight: 1.05, marginTop: 4, color: C.pinkText }}>댕냥</div>
            {title ? <div style={{ display: "flex", fontFamily: "display", fontSize: 64, marginTop: 20 }}>{title}</div> : null}
          </div>
        ) : null}
        {body ? <div style={{ display: "flex", fontFamily: "body", fontSize: 32, marginTop: 18, color: C.ink2 }}>{sub}</div> : null}
      </div>
    ),
    { ...OG_SIZE, fonts, headers: HEADERS },
  );
}
