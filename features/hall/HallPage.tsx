/**
 * 명예의 전당(/hall, #8): 지난 12개월 동안 데뷔(결선 1위)와 센터(주간 1위)를 달마다 모은다.
 * - 달 제목 아래 데뷔를 크게(사진 3:4, 이름을 사진 위에), 그 아래 그 달 라운드 센터를 작은 카드로.
 * - 1위 글이 숨겨지거나 지워지면 2위를 올리지 않고 그 자리를 빈 카드로 둔다(hall_of_fame 의 hidden, 2026-11-19 사용자 결정).
 * - 아직 결과가 없으면 안내 판과 게시판 가기 버튼.
 */
import Link from "next/link";
import { BOARD_NAME, count, roundName } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { createClient } from "@/shared/lib/supabase/server";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { LoginButton } from "@/features/auth/LoginButton";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { SiteNav } from "@/features/entries/SiteNav";
import { groupByMonth, loadHall, type HallCard } from "./api";
import s from "./hall.module.css";

/** "2026-11-01" → "2026년 11월" */
function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export async function HallPage() {
  // 전당은 핵심 흐름이 아니라 불러오기가 실패하면 오류 화면 대신 안내 판을 보여 준다
  const cards = await loadHall(await createClient()).catch(() => null);
  const months = groupByMonth(cards ?? []);
  const latest = months[0]?.month;
  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav current="hall" />} right={<PicksLeft />} login={<LoginButton />} />
      <div className={s.head}>
        <h1>명예의 전당</h1>
        <p>라운드마다 1위에 오른 센터와 달마다 뽑힌 데뷔 멤버예요.</p>
      </div>

      {months.length === 0 ? (
        <div className={s.empty} role="status">
          <b>{cards ? "아직 전당에 오른 아이가 없어요" : "전당을 불러오지 못했어요"}</b>
          <span>{cards ? "첫 라운드가 끝나면 댕댕이·냥이 1위가 여기 걸려요." : "잠시 뒤 다시 와 주세요. 게시판은 그대로 볼 수 있어요."}</span>
          <span className={s.emptyAct}>
            <Link className={ui.pill} href="/dog">
              댕댕이 연습생 보기
            </Link>
            <Link className={ui.ghost} href="/cat">
              냥이 연습생 보기
            </Link>
          </span>
        </div>
      ) : (
        months.map((m) => (
          <section key={m.month} className={s.month} aria-labelledby={`hall-${m.month}`}>
            <h2 id={`hall-${m.month}`}>{monthTitle(m.month)}</h2>
            {m.debut.length ? (
              <ul className={s.debuts} aria-label={`${monthTitle(m.month)} 데뷔`}>
                {m.debut.map((c) => (
                  <DebutCard key={`${c.board}-${c.round_month}`} c={c} eager={m.month === latest} />
                ))}
              </ul>
            ) : null}
            {m.center.length ? (
              <ul className={s.centers} aria-label={`${monthTitle(m.month)} 센터`}>
                {m.center.map((c) => (
                  <CenterCard key={`${c.board}-${c.round_seq}`} c={c} />
                ))}
              </ul>
            ) : null}
          </section>
        ))
      )}

    </div>
  );
}

/** 숨기거나 지운 1위 자리에 쓰는 문구. 이유(관리자 숨김·주인 삭제)는 알리지 않는다 */
const HIDDEN_NAME = "공개되지 않은 1위";

function DebutCard({ c, eager }: { c: HallCard; eager: boolean }) {
  const month = Number(c.round_month.slice(5, 7));
  if (c.hidden || !c.entry_id)
    return (
      <li className={s.debut}>
        <div className={s.placeholder}>
          <span className={s.debutText}>
            <small>
              {month}월 데뷔 · {BOARD_NAME[c.board]}
            </small>
            <b>{HIDDEN_NAME}</b>
          </span>
        </div>
      </li>
    );
  return (
    <li className={s.debut}>
      <Link href={`/${c.board}/${c.entry_id}`}>
        <img src={photoUrl(c.path) ?? undefined} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
        <span className={s.scrim} />
        <span className={s.debutText}>
          <small>
            {month}월 데뷔 · {BOARD_NAME[c.board]}
          </small>
          <b>{c.pet_name}</b>
          <span className={s.debutVotes}>{count(c.votes ?? 0)}표로 데뷔</span>
        </span>
      </Link>
    </li>
  );
}

function CenterCard({ c }: { c: HallCard }) {
  if (c.hidden || !c.entry_id)
    return (
      <li className={s.center}>
        <div className={s.centerHidden}>
          <span className={s.centerBlank} aria-hidden="true" />
          <small>
            {roundName(c.round_kind, c.round_seq)} 센터 · {BOARD_NAME[c.board]}
          </small>
          <b>{HIDDEN_NAME}</b>
        </div>
      </li>
    );
  return (
    <li className={s.center}>
      <Link href={`/${c.board}/${c.entry_id}`}>
        <img src={photoUrl(c.thumb_path) ?? undefined} alt="" loading="lazy" decoding="async" />
        <small>
          {roundName(c.round_kind, c.round_seq)} 센터 · {BOARD_NAME[c.board]}
        </small>
        <b>{c.pet_name}</b>
        <span>{count(c.votes ?? 0)}표</span>
      </Link>
    </li>
  );
}
