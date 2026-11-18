/** 명예의 전당(/hall, #8). 조립은 features/hall/HallPage. */
import type { Metadata } from "next";
import { HallPage } from "@/features/hall/HallPage";

export const metadata: Metadata = {
  title: "명예의 전당",
  description: "라운드마다 1위에 오른 센터와 달마다 뽑힌 데뷔 멤버를 모았어요.",
};

export default function Page() {
  return <HallPage />;
}
