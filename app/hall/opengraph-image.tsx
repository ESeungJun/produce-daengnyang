/** 명예의 전당 공유 미리보기(#8). */
import { OG_SIZE, siteOgImage } from "@/features/share/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "프로듀스 댕냥 명예의 전당";

export default function Image() {
  return siteOgImage("명예의 전당", "주차마다 1위에 오른 센터와 달마다 뽑힌 데뷔 멤버");
}
