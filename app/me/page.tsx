/** 내 정보(/me). 조립은 features/me/MePage. */
import type { Metadata } from "next";
import { MePage } from "@/features/me/MePage";

export const metadata: Metadata = { title: "내 정보", robots: { index: false } };

type Props = { searchParams: Promise<{ leave?: string }> };

/** ?leave=1: 탈퇴 전 구글 확인을 마치고 돌아온 길(AccountActions) */
export default async function Page({ searchParams }: Props) {
  const { leave } = await searchParams;
  return <MePage resumeLeave={leave === "1"} />;
}
