/**
 * 모든 화면의 뿌리 레이아웃.
 * - 글꼴: 제호·숫자 Black Han Sans, 본문 Gowun Dodum(확정안 V2A). next/font 가 자체 호스팅해 외부 요청이 없다.
 *   한글은 글자 묶음이 많아 미리 불러오기(preload)를 끄고, 쓰는 글자 묶음만 그때 받게 한다.
 * - 색은 shared/styles/tokens.css 의 변수만 쓴다. 라이트·다크는 기기 설정을 따른다(테마 전환 버튼은 #4).
 */
import type { Metadata, Viewport } from "next";
import { Black_Han_Sans, Gowun_Dodum } from "next/font/google";
import "./globals.css";

const display = Black_Han_Sans({ weight: "400", subsets: ["latin"], preload: false, variable: "--font-display" });
const body = Gowun_Dodum({ weight: "400", subsets: ["latin"], preload: false, variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "프로듀스 댕냥", template: "%s · 프로듀스 댕냥" },
  description: "우리 애를 데뷔시켜 주세요. 강아지·고양이 사진 오디션, 매주 센터를 뽑고 월말에 데뷔해요.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F4F1" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
