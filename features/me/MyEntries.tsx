"use client";
/**
 * 내 글 목록(my_entries). 줄마다 사진·이름·라운드·상태·표 수, 그리고 보기·고치기·지우기.
 * 고치기·지우기는 투표 중인 글만. 지우면 등록 횟수는 돌아오지 않는다(설계서 5절)는 것을 확인 시트에서 알린다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOARD_NAME, count } from "@/shared/lib/format";
import { browserClient } from "@/shared/lib/supabase/client";
import { photoUrl } from "@/shared/lib/supabase/env";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import { roundTitle } from "@/features/rounds/schedule";
import { RegisterButton } from "@/features/entries/RegisterButton";
import { entryState, type MyEntry } from "./rules";
import s from "./me.module.css";

export function MyEntries({ entries }: { entries: MyEntry[] }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<MyEntry | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const list = entries.filter((e) => !gone.has(e.id));

  async function remove() {
    const e = target;
    setTarget(null);
    if (!e) return;
    const sb = await browserClient();
    const { error } = await sb.rpc("delete_entry", { p_entry_id: e.id });
    if (error) return toast("지우지 못했어요. 잠시 뒤 다시 눌러 주세요");
    setGone((g) => new Set(g).add(e.id));
    toast(`${e.pet_name} 글을 지웠어요`);
    router.refresh();
  }

  if (list.length === 0) {
    return (
      <div className={s.empty}>
        <p>아직 올린 아이가 없어요.</p>
        <RegisterButton className={s.emptyCta}>첫 연습생 등록하기</RegisterButton>
      </div>
    );
  }

  return (
    <>
      <ul className={s.list}>
        {list.map((e) => {
          const st = entryState(e);
          const thumb = photoUrl(e.thumb_path);
          return (
            <li key={e.id} className={s.row}>
              <Link href={`/${e.board}/${e.id}`} className={s.thumb} tabIndex={-1} aria-hidden="true">
                {thumb ? <img src={thumb} alt="" /> : null}
              </Link>
              <div className={s.info}>
                <p className={s.name}>
                  <Link href={`/${e.board}/${e.id}`}>{e.pet_name}</Link>
                  <span className={s.state} data-tone={st.tone}>
                    {st.label}
                  </span>
                </p>
                <p className={s.meta}>
                  {BOARD_NAME[e.board]} · {roundTitle(e.round)} · {e.pick_count === null ? "표 수 가림" : `${count(e.pick_count)}표`}
                </p>
                {st.editable ? (
                  <p className={s.acts}>
                    <Link href={`/${e.board}/${e.id}/edit`}>고치기</Link>
                    <button type="button" onClick={() => setTarget(e)}>
                      지우기
                    </button>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Sheet
        open={target !== null}
        title={`${target?.pet_name ?? ""} 글을 지울까요?`}
        body="받은 표도 함께 사라지고, 이번 라운드 등록 횟수는 돌아오지 않아요."
        mainLabel="지우기"
        subLabel="그대로 둘게요"
        onMain={remove}
        onClose={() => setTarget(null)}
        danger
      />
    </>
  );
}
