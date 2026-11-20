"use client";
/**
 * "연습생 등록하기". 회원이면 등록 화면(/register)으로, 아니면 로그인 시트(문구: 등록)를 띄운다.
 * 로그인을 마치면 시트가 돌아올 곳으로 /register 를 넘긴다.
 */
import Link from "next/link";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";

export function RegisterButton({
  className,
  children = "연습생 등록하기",
  current = false,
}: {
  className?: string;
  children?: React.ReactNode;
  current?: boolean;
}) {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  if (viewer === "member") {
    return (
      <Link className={className} href="/register" aria-current={current ? "page" : undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={() => openLogin("register")}>
      {children}
    </button>
  );
}
