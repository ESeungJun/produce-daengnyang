"use client";
/**
 * 윗줄 오른쪽 끝. 회원이면 "내 정보"(/me, 휴대폰·데스크톱), 로그인 전·익명이면 데스크톱에서만 "구글로 로그인".
 * 휴대폰 손님은 픽·등록을 누를 때 로그인 시트가 뜨므로 윗줄 자리를 남은 픽에 준다.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePicks } from "@/features/picks/PicksProvider";
import { page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "./LoginSheet";

export function LoginButton() {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  const path = usePathname();
  if (viewer === "member") {
    return (
      <Link className={page.me} href="/me" aria-current={path === "/me" ? "page" : undefined}>
        내 정보
      </Link>
    );
  }
  return (
    <button type="button" className={`${ui.pill} ${page.deskOnly}`} onClick={() => openLogin("login")}>
      구글로 로그인
    </button>
  );
}
