/** 데스크톱 윗줄 메뉴: 강아지·고양이 게시판, 연습생 등록. 명예의 전당은 #8 에서 더한다. */
import Link from "next/link";
import type { Board } from "@/shared/lib/format";
import { RegisterButton } from "./RegisterButton";

export function SiteNav({ current }: { current?: Board }) {
  return (
    <>
      <Link href="/dog" aria-current={current === "dog" ? "page" : undefined}>
        강아지
      </Link>
      <Link href="/cat" aria-current={current === "cat" ? "page" : undefined}>
        고양이
      </Link>
      <RegisterButton />
    </>
  );
}
