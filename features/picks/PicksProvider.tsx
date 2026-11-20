"use client";
/**
 * 오늘 남은 픽과 내가 픽한 글을 화면 전체가 같이 쓰는 곳. 레이아웃이 서버에서 처음 값을 넣어 준다.
 *
 * 픽 한 번의 순서:
 * 1. 로그인 전(guest)이면 Turnstile 확인 + 익명 로그인을 하고 이어서 픽한다(#3). 끝나면 viewer 를 화면에서만 "anon" 으로 바꾼다.
 *    router.refresh 를 하면 Providers 의 key 가 바뀌어 페이지 전체가 다시 그려지고(더 보기로 불러온 글·스크롤이 사라짐) 그래서 하지 않는다.
 *    손님 첫 픽이 처리되는 동안에는 다른 픽을 받지 않는다(익명 사용자가 둘 생기지 않게).
 * 2. 남은 픽이 없으면 서버에 보내지 않는다(익명은 시트, 회원은 한도 토스트). 서버도 같은 규칙으로 다시 막는다.
 * 3. cast_pick 을 부르고, 성공하면 남은 픽·픽한 글·화면의 표 수(+1)를 고친다. 실패는 messages.ts 의 반응을 따른다.
 * 4. 로그인 시트가 픽 때문에 떴으면 하려던 픽을 이 탭에 적어 두고(handoff.ts), 구글에서 회원으로 돌아오면 이어서 보낸다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnonSignInError, ensureAnonSession, type AnonFailReason } from "@/features/auth/session";
import { savePendingPick, takeFlash, takePendingPick } from "@/features/auth/handoff";
import { browserClient } from "@/shared/lib/supabase/client";
import type { Board } from "@/shared/lib/format";
import { kstDate } from "@/shared/lib/kst";
import { useToast } from "@/shared/ui/Toast";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { ANON_FAIL_TEXT, pickErrorOutcome, pickedText } from "./messages";

export type Viewer = "guest" | "anon" | "member";
/** unread: 회원의 안 읽은 알림 수(#6, "내 정보" 점). 픽과 함께 레이아웃이 한 번 읽는다 */
export type PicksInit = { viewer: Viewer; remaining: Record<Board, number>; picked: string[]; unread?: number };

type Ctx = {
  viewer: Viewer;
  remaining: Record<Board, number>;
  focusBoard: Board;
  setFocusBoard: (b: Board) => void;
  isPicked: (entryId: string) => boolean;
  bump: (entryId: string) => number;
  pending: ReadonlySet<string>;
  pick: (entryId: string, board: Board) => Promise<void>;
  /** 안 읽은 알림 수. 알림함이 읽음 처리하면 clearUnread 로 0 */
  unread: number;
  clearUnread: () => void;
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
  const [viewer, setViewer] = useState(init.viewer);
  const [unread, setUnread] = useState(init.unread ?? 0);
  const clearUnread = useCallback(() => setUnread(0), []);
  const guestBusy = useRef(false);
  // 픽 때문에 시트를 열 때는 하려던 픽을 적어 둔다(다른 이유로 열면 LoginSheet 가 지운다)
  const askLogin = useCallback(
    (p: { entryId: string; board: Board }, reason: "pick" | "ip" = "pick") => {
      savePendingPick(p);
      openLogin(reason);
    },
    [openLogin],
  );

  const pick = useCallback(
    async (entryId: string, board: Board) => {
      setFocusBoard(board);
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
        return o.kind === "sheet" ? askLogin({ entryId, board }, o.reason) : toast(o.text);
      }
      // 첫 픽(익명 로그인) 처리 중이면 받지 않는다. 상태(pending)는 다음 렌더에야 보이므로 ref 로 바로 막는다.
      if (viewer === "guest") {
        if (guestBusy.current) return;
        guestBusy.current = true;
      }
      setPending((p) => new Set(p).add(entryId));
      let res;
      let anonFail: AnonFailReason | null = null;
      try {
        // 첫 픽: 세션이 없으면 익명 로그인부터(봇 확인 포함). 실패하면 아래 catch 로 간다.
        if (viewer === "guest") {
          await ensureAnonSession();
          setViewer("anon");
        }
        res = await (await browserClient()).rpc("cast_pick", { p_entry_id: entryId });
      } catch (e) {
        // supabase-js 를 못 불러왔거나(네트워크) 익명 로그인·봇 확인이 실패했다. 버튼이 처리 중에 멈추지 않게 풀고 알린다.
        anonFail = e instanceof AnonSignInError ? e.reason : null;
        res = null;
      } finally {
        guestBusy.current = false;
        setPending((p) => {
          const n = new Set(p);
          n.delete(entryId);
          return n;
        });
      }
      if (anonFail) return toast(ANON_FAIL_TEXT[anonFail]);
      if (!res) return toast("픽을 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요");
      const { data, error } = res;
      if (error) {
        const o = pickErrorOutcome(error.message, board);
        if (error.message === "already_picked") setPicked((s) => new Set(s).add(entryId));
        return o.kind === "sheet" ? askLogin({ entryId, board }, o.reason) : toast(o.text);
      }
      const left = Number((data as { remaining?: number } | null)?.remaining ?? 0);
      // 익명은 두 게시판 합쳐 하루 1픽이라 한 번 쓰면 둘 다 0
      // 응답 순서가 뒤바뀌어도 남은 수가 다시 늘지 않게 작은 값을 받는다.
      setRemaining((r) => (viewer === "member" ? { ...r, [board]: Math.min(r[board], left) } : { dog: 0, cat: 0 }));
      setPicked((s) => new Set(s).add(entryId));
      setBumps((b) => ({ ...b, [entryId]: (b[entryId] ?? 0) + 1 }));
      toast(pickedText(board, left, viewer === "member"));
    },
    [viewer, remaining, day, askLogin, toast],
  );

  // 구글에서 돌아온 첫 화면: 남겨 둔 알림을 보여 주고, 회원이 됐으면 하려던 픽을 이어서 보낸다(한 번만)
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const flash = takeFlash();
    const p = viewer === "member" ? takePendingPick() : null;
    // 첫 렌더가 끝난 뒤에 실행한다(효과 안에서 바로 상태를 바꾸지 않게)
    // 정리 함수로 지우지 않는다: 개발 모드의 두 번 실행에서 ref 때문에 다시 걸리지 않아 영영 안 나간다
    setTimeout(() => {
      if (flash) toast(flash);
      if (p && !picked.has(p.entryId)) void pick(p.entryId, p.board);
    }, 0);
  }, [viewer, picked, pick, toast]);

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
      unread,
      clearUnread,
    }),
    [viewer, remaining, focusBoard, picked, bumps, pending, pick, unread, clearUnread],
  );
  return <PicksContext.Provider value={value}>{children}</PicksContext.Provider>;
}

export function usePicks() {
  const v = useContext(PicksContext);
  if (!v) throw new Error("PicksProvider 안에서만 쓸 수 있어요");
  return v;
}
