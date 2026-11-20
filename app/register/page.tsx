/** 연습생 등록(/register). 조립은 features/register/RegisterPage. */
import type { Metadata } from "next";
import { RegisterPage } from "@/features/register/RegisterPage";

export const metadata: Metadata = { title: "연습생 등록", robots: { index: false } };

type Props = { searchParams: Promise<{ submit?: string }> };

/** ?submit=1: 폼을 다 쓰고 등록을 눌렀다가 로그인하고 돌아온 길(로그인 창 submit) */
export default async function Page({ searchParams }: Props) {
  const { submit } = await searchParams;
  return <RegisterPage resumeSubmit={submit === "1"} />;
}
