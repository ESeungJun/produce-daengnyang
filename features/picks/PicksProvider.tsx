"use client";
/**
 * 오늘 남은 픽과 내가 픽한 글을 화면 전체가 같이 쓰는 곳. 레이아웃이 서버에서 처음 값을 넣어 준다.
 *
 * 픽 한 번의 순서:
 * 1. 로그인 전(guest)이면 로그인 시트를 띄운다. 익명 첫 픽은 #3 에서 여기에 붙는다.
 * 2. 남은 픽이 없으면 서버에 보내지 않는다(익명은 시트, 회원은 한도 토스트). 서버도 같은 규칙으로 다시 막는다.
 * 3. cast_pick 을 부르고, 성공하면 남은 픽·픽한 글·화면의 표 수(+1)를 고친다. 실패는 messages.ts 의 반응을 따른다.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import type { Board } from "@/shared/lib/format";
import { kstDate } from "@/shared/lib/kst";
import { useToast } from "@/shared/ui/Toast";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { pickErrorOutcome, pickedText } from "./messages";

export type Viewer = "guest" | "anon" | "member";
export type PicksInit = { viewer: Viewer; remaining: Record<Board, number>; picked: string[] };

type Ctx = {
  viewer: Viewer;
  remaining: Record<Board, number>;
  focusBoard: Board;
  setFocusBoard: (b: Board) => void;
  isPicked: (entryId: string) => boolean;
  bump: (entryId: string) => number;
  pending: ReadonlySet<string>;
  pick: (entryId: string, board: Board) => Promise<void>;
};

const PicksContext = createContext<Ctx | null>(null);

export function PicksProvider({ init, children }: { init: PicksInit; children: React.ReactNode }) {
  const [remaining, setRemaining] = useState(init.remaining);
  const [picked, setPicked] = useState(() => new Set(init.picked));
  const [bumps, setBumps] = useState<Record<string, number>>({});
  const [focusBoard, setFocusBoard] = useState<Board>("dog");
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  // 탭을 연 채 자정(KST)을 넘기면 어제 상태로 픽이 막히지 않게, 상태를 만든 날짜를 같이 둔다.
  const [day, setDay] = useState(() => kstDate());
  const toast = useToast();
  const openLogin = useLoginSheet();
  const viewer = init.viewer;

  const pick = useCallback(
    async (entryId: string, board: Board) => {
      setFocusBoard(board);
      if (viewer === "guest") return openLogin("pick");
      let left0 = remaining[board];
      const today = kstDate();
      if (today !== day) {
        const limit = viewer === "member" ? 3 : 1;
        setDay(today);
        setRemaining({ dog: limit, cat: limit });
        setPicked(new Set());
        setBumps({});
        left0 = limit;
      }
      if (left0 <= 0) {
        const o = pickErrorOutcome(viewer === "member" ? "daily_limit" : "anon_limit", board);
        return o.kind === "sheet" ? openLogin("pick") : toast(o.text);
      }
      setPending((p) => new Set(p).add(entryId));
      const { data, error } = await browserClient().rpc("cast_pick", { p_entry_id: entryId });
      setPending((p) => {
        const n = new Set(p);
        n.delete(entryId);
        return n;
      });
      if (error) {
        const o = pickErrorOutcome(error.message, board);
        if (error.message === "already_picked") setPicked((s) => new Set(s).add(entryId));
        return o.kind === "sheet" ? openLogin("pick") : toast(o.text);
      }
      const left = Number((data as { remaining?: number } | null)?.remaining ?? 0);
      // 익명은 두 게시판 합쳐 하루 1픽이라 한 번 쓰면 둘 다 0
      // 응답 순서가 뒤바뀌어도 남은 수가 다시 늘지 않게 작은 값을 받는다.
      setRemaining((r) => (viewer === "member" ? { ...r, [board]: Math.min(r[board], left) } : { dog: 0, cat: 0 }));
      setPicked((s) => new Set(s).add(entryId));
      setBumps((b) => ({ ...b, [entryId]: (b[entryId] ?? 0) + 1 }));
      toast(pickedText(board, left, viewer === "member"));
    },
    [viewer, remaining, day, openLogin, toast],
  );

  const value = useMemo<Ctx>(
    () => ({
      viewer,
      remaining,
      focusBoard,
      setFocusBoard,
      isPicked: (id) => picked.has(id),
      bump: (id) => bumps[id] ?? 0,
      pending,
      pick,
    }),
    [viewer, remaining, focusBoard, picked, bumps, pending, pick],
  );
  return <PicksContext.Provider value={value}>{children}</PicksContext.Provider>;
}

export function usePicks() {
  const v = useContext(PicksContext);
  if (!v) throw new Error("PicksProvider 안에서만 쓸 수 있어요");
  return v;
}
