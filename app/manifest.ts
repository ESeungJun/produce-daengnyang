/**
 * 웹 앱 manifest(#8, /manifest.webmanifest). 홈 화면에 추가하면 주소창 없는 앱으로 열린다.
 * 아이콘은 scripts/icons/make.sh 로 만든다(public/icons). 아이폰 아이콘은 app/apple-icon.png.
 * 아이폰·아이패드 웹 푸시는 이렇게 설치한 앱 안에서만 된다(iOS 16.4+, PushToggle).
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "프로듀스 댕냥",
    short_name: "댕냥",
    description: "댕댕이·냥이 사진 오디션. 매주 센터를 뽑고 월말에 데뷔해요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
