/**
 * 게시판 이름 검색칸(#5). 서버가 그리는 GET 폼이라 스크립트 없이도 동작한다(/dog?q=콩이).
 * 정렬(최신순)은 숨은 칸으로 유지한다. 두 글자 미만은 브라우저가 막고(minLength), 주소로 들어와도 DB 가 무시한다.
 * 검색 중이면 아래에 "‘콩이’ 검색 결과 · 지우기"를 보여 준다.
 */
import Link from "next/link";
import type { Board } from "@/shared/lib/format";
import { BOARD_NAME } from "@/shared/lib/format";
import ui from "@/shared/ui/ui.module.css";
import { SEARCH_MAX, SEARCH_MIN, boardHref, isSearch } from "./search";
import s from "./entries.module.css";

export function SearchBox({ board, sort, q }: { board: Board; sort: "popular" | "latest"; q: string }) {
  return (
    <div className={s.search}>
      <form role="search" action={`/${board}`} method="get" className={s.searchForm}>
        {sort === "latest" ? <input type="hidden" name="sort" value="latest" /> : null}
        <label className={s.searchField}>
          <span className={s.srOnly}>{BOARD_NAME[board]} 연습생 이름</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            minLength={SEARCH_MIN}
            maxLength={SEARCH_MAX}
            placeholder="이름으로 찾기 (두 글자부터)"
            enterKeyHint="search"
            autoComplete="off"
          />
        </label>
        <button type="submit" className={ui.pill}>
          찾기
        </button>
      </form>
      {q && isSearch(q) ? (
        <p className={s.searchNote} role="status">
          ‘{q}’ 검색 결과 ·{" "}
          <Link href={boardHref(board, sort, "")}>검색 지우기</Link>
        </p>
      ) : q ? (
        <p className={s.searchNote} role="status">
          두 글자부터 찾을 수 있어요. 전체 연습생을 보여 드려요.
        </p>
      ) : null}
    </div>
  );
}
