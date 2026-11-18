"use client";
/**
 * 게시판 목록. 서버가 첫 24개를 넣어 주고, "더 보기"를 누르면 브라우저에서 board_entries 를 이어 부른다.
 * 정렬이 바뀌면 주소(?sort=)가 바뀌어 서버가 처음부터 다시 그린다(key 로 상태 초기화).
 * 순위 알약은 인기순(가림 기간 아님)일 때만.
 */
import { useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import type { Board } from "@/shared/lib/format";
import ui from "@/shared/ui/ui.module.css";
import { PAGE_SIZE, type BoardEntry, type BoardSort } from "./api";
import { EntryCard } from "./EntryCard";
import s from "./entries.module.css";

/** seed: 서버가 첫 목록을 만들 때 쓴 섞기 seed. 이어 불러올 때도 같은 값을 넘겨야 순서가 이어진다. */
export function BoardGallery({ board, sort, seed, initial, showRank }: { board: Board; sort: BoardSort; seed: string | null; initial: BoardEntry[]; showRank: boolean }) {
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    setLoading(true);
    setFailed(false);
    const res = await browserClient()
      .then((supabase) =>
        supabase.rpc("board_entries", {
          p_board: board,
          p_sort: sort,
          p_limit: PAGE_SIZE,
          p_offset: items.length,
          ...(seed ? { p_seed: seed } : {}),
        }),
      )
      .catch(() => null);
    setLoading(false);
    if (!res || res.error) return setFailed(true);
    const { data } = res;
    const next = data ?? [];
    // 그사이 순위가 바뀌어 같은 글이 다시 올 수 있어 한 번만 둔다.
    setItems((cur) => {
      const seen = new Set(cur.map((e) => e.id));
      return [...cur, ...next.filter((e) => !seen.has(e.id))];
    });
    if (next.length < PAGE_SIZE) setDone(true);
  }

  return (
    <>
      <ul className={s.gal}>
        {items.map((e, i) => (
          <EntryCard key={e.id} e={e} board={board} showRank={showRank} eager={i < 2} />
        ))}
      </ul>
      {!done ? (
        <div className={s.more}>
          {failed ? (
            <p className={s.moreFail} role="status">
              더 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.
            </p>
          ) : null}
          <button type="button" className={ui.ghost} onClick={more} disabled={loading}>
            {loading ? "불러오는 중…" : failed ? "다시 불러오기" : "더 보기"}
          </button>
        </div>
      ) : null}
    </>
  );
}
