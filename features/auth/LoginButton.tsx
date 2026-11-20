"use client";
/**
 * 윗줄 오른쪽 끝. 회원이면 "내 정보"(/me, 휴대폰·데스크톱), 로그인 전·익명이면 데스크톱에서만 "구글로 로그인".
 * 안 읽은 알림이 있으면 "내 정보" 옆에 점(#6 알림함).
 * 휴대폰 손님은 남은 픽 버튼(게시판·글 상세)이 로그인 길이라 그 자리를 남은 픽에 준다.
 * 남은 픽이 없는 화면(메인 등, TopBar .solo, #20)에서는 휴대폰에도 짧은 "로그인" 알약을 보여 준다(로그인 길이 사라지지 않게).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePicks } from "@/features/picks/PicksProvider";
import { page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "./LoginSheet";

export function LoginButton() {
  const { viewer, unread } = usePicks();
  const openLogin = useLoginSheet();
  const path = usePathname();
  if (viewer === "member") {
    return (
      <Link className={page.me} href="/me" aria-current={path === "/me" ? "page" : undefined} aria-label={unread ? `내 정보, 새 알림 ${unread}개` : undefined}>
        내 정보
        {unread ? <span className={page.dot} aria-hidden="true" /> : null}
      </Link>
    );
  }
  return (
    <>
      <button type="button" className={`${ui.pill} ${page.deskOnly}`} onClick={() => openLogin("login")}>
        구글로 로그인
      </button>
      <button type="button" className={`${ui.pill} ${page.soloMobile}`} onClick={() => openLogin("login")}>
        로그인
      </button>
    </>
  );
}
