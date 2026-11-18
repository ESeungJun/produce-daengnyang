/** 데스크톱 윗줄 메뉴: 강아지·고양이 게시판, 명예의 전당(#8), 연습생 등록. */
import Link from "next/link";
import type { Board } from "@/shared/lib/format";
import { RegisterButton } from "./RegisterButton";

export function SiteNav({ current }: { current?: Board | "hall" | "register" }) {
  return (
    <>
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
    </>
  );
}
