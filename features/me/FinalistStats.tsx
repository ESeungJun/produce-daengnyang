/**
 * 내 정보의 결선 진출 현황(#39). 최근 60일 안에 주간 1·2위로 결선에 오른 내 글마다
 * 응원단 수와 센터 주간 SNS 방문 수(사람 수)를 숫자로만 보여 준다(누가 들어왔는지는 주인에게도 보이지 않는다).
 * 데이터: my_finalist_stats(회원만). 없으면 칸을 두지 않는다. 문구 고르기는 finalistNote(시험: rules.test.ts).
 */
import Link from "next/link";
import type { Database } from "@/shared/lib/supabase/database.types";
import { roundName } from "@/shared/lib/format";
import { finalistNote, snsMovesText } from "@/features/cheer/rules";
import { ROLE_NAME } from "./rules";
import s from "./me.module.css";

type Row = Database["public"]["Functions"]["my_finalist_stats"]["Returns"][number];

export function FinalistStats({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby="fin-h">
      <h2 id="fin-h" className={s.h2}>
        결선 진출 현황
      </h2>
      <ul className={s.stats}>
        {rows.map((r) => {
          const rank = r.role === "center" ? 1 : 2;
          const sns = snsMovesText(r.sns_moves as number | null, r.center_done);
          return (
            <li key={r.entry_id}>
              <p className={s.statName}>
                <Link href={`/${r.board}/${r.entry_id}`}>{r.pet_name}</Link>
                <span className={s.statWhen}>
                  {Number(r.round_month.slice(5, 7))}월 {roundName("weekly", r.round_seq)}
                </span>
                <span className={s.state} data-tone="win">
                  {rank}위 · {ROLE_NAME[r.role as keyof typeof ROLE_NAME] ?? ""}
                </span>
              </p>
              <dl className={s.statNums}>
                <div>
                  <dt>응원단</dt>
                  <dd>{r.cheers.toLocaleString("ko-KR")}명</dd>
                </div>
                {r.role === "center" ? (
                  <div>
                    <dt>센터 주간 SNS 방문</dt>
                    <dd className={sns.number ? undefined : s.statWait}>{sns.text}</dd>
                  </div>
                ) : null}
              </dl>
              <p className={s.note}>{finalistNote(r)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
