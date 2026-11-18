/** 내 정보(/me). 조립은 features/me/MePage. */
import type { Metadata } from "next";
import { MePage } from "@/features/me/MePage";

export const metadata: Metadata = { title: "내 정보", robots: { index: false } };

export default function Page() {
  return <MePage />;
}
