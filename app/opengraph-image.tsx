/** 사이트 공유 미리보기(#8). 메인·게시판처럼 따로 그림이 없는 화면이 함께 쓴다. */
import { OG_SIZE, siteOgImage } from "@/features/share/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "프로듀스 댕냥, 댕댕이·냥이 사진 오디션";

export default function Image() {
  return siteOgImage("", "댕댕이·냥이 사진 오디션 · 매주 센터, 월말 데뷔");
}
