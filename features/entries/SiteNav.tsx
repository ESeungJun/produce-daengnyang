/** 윗줄 메뉴: 홈(#20, 로고 말고도 홈으로 가는 길), 강아지·고양이 게시판, 명예의 전당(#8), 연습생 등록. */
import Link from "next/link";
import type { Board } from "@/shared/lib/format";
import { RememberBoard } from "@/features/featured/RememberBoard";
import { RegisterButton } from "./RegisterButton";

export function SiteNav({ current }: { current?: Board | "home" | "hall" | "register" }) {
  return (
    <>
      <Link href="/" aria-current={current === "home" ? "page" : undefined}>
        홈
      </Link>
      <Link href="/dog" aria-current={current === "dog" ? "page" : undefined}>
        댕댕이
      </Link>
      <Link href="/cat" aria-current={current === "cat" ? "page" : undefined}>
        냥이
      </Link>
      <Link href="/hall" aria-current={current === "hall" ? "page" : undefined}>
        명예의 전당
      </Link>
      <RegisterButton current={current === "register"} />
      {/* 게시판·글 상세에서 그 게시판을 기억해 메인 표지가 그쪽 데뷔부터 보이게(#25) */}
      {current === "dog" || current === "cat" ? <RememberBoard board={current} /> : null}
    </>
  );
}
