/**
 * 데뷔 화보 상세(#17). 데뷔한 글(get_entry.debut)은 일반 상세 대신 잡지 화보처럼 보여 준다.
 * 순서: 꽉 찬 표지(첫 사진 + 큰 이름 + 데뷔 표 수) → 소개 인용 + SNS·공유 + 인스타에 올리기(#18) → 사진 벽(원래 사진 + 화보 사진) → 천천히 흐르는 사진 띠 → 응원 댓글.
 * 들어올 때 꽃가루가 한 번 터진다(Confetti, 같은 글은 세션에 한 번). 사진 벽은 눌러서 크게 본다(PhotoWall, #24).
 * 공유·SNS·인스타 기록은 자리 debut 로 남겨 일반 상세(detail)와 나눠 센다(#24). '움직임 줄이기'면 꽃가루·흐름 없이 사진만(CSS).
 * 주인에게는 "화보 올리기"(사진·GIF·동영상 최대 10칸, #31, /<게시판>/<글>/gallery) 길을 둔다. 숨긴 글은 이 화면을 쓰지 않는다(DetailPage 가 거른다).
 * 부르는 곳: features/entries/DetailPage.
 */
import Link from "next/link";
import { BOARD_NAME, SNS_NAME, count, snsLinks, type Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { LoginButton } from "@/features/auth/LoginButton";
import { Comments } from "@/features/comments/Comments";
import type { loadComments } from "@/features/comments/api";
import { ReportButton } from "@/features/comments/ReportButton";
import { CopyLink } from "@/features/entries/CopyLink";
import type { EntryDetail } from "@/features/entries/api";
import { SiteNav } from "@/features/entries/SiteNav";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { ShareVisit } from "@/features/share/ShareVisit";
import { Confetti } from "./Confetti";
import { InstaShare } from "./InstaShare";
import { PhotoWall } from "./PhotoWall";
import { GALLERY_MAX } from "./limits";
import d from "@/features/entries/entries.module.css";
import s from "./debut.module.css";

type Props = {
  e: EntryDetail;
  board: Board;
  comments: Awaited<ReturnType<typeof loadComments>> | null;
};

/** "N월 데뷔"는 결선(마지막 주차) 라운드가 있던 달이다. 메인 표지의 "10월 데뷔"와 같은 셈(MainPage debutMonth) */
const debutMonthOf = (month: string) => Number(month.slice(5, 7));

export function DebutDetail({ e, board, comments }: Props) {
  const all = [...e.photos, ...e.gallery];
  const sns = e.sns_open ? snsLinks(e) : [];
  const m = debutMonthOf(e.round.month);
  // 흐르는 띠는 끊김 없이 돌도록 같은 목록을 두 번 잇는다(띠 전체가 읽기 도구에서 숨김). 세 바퀴(3분) 돌고 멈춘다
  // 넓은 화면에서도 띠 끝이 비지 않게 한 벌을 8장 이상으로 채운다(사진이 적으면 되풀이)
  const strip = Array.from({ length: Math.ceil(8 / all.length) }, () => all).flat();

  return (
    <div className={`${page.page} ${s.debut}`}>
      <TopBar back={{ href: `/${board}`, label: `${BOARD_NAME[board]} 연습생` }} nav={<SiteNav current={board} />} login={<LoginButton />} />
      <ShareVisit entryId={e.id} place="debut" />
      <Confetti entryId={e.id} />

      <header className={s.cover}>
        <img src={photoUrl(all[0]?.path) ?? undefined} alt={`${e.pet_name} 데뷔 화보 표지`} fetchPriority="high" decoding="async" />
        <span className={s.scrim} aria-hidden="true" />
        <div className={s.coverText}>
          <span className={s.kick}>
            {m}월 데뷔 · {BOARD_NAME[board]}
          </span>
          <h1>{e.pet_name}</h1>
          <p>{e.pick_count !== null ? `${count(e.pick_count)}표로 데뷔` : "데뷔 평가 통과"}</p>
        </div>
      </header>

      <section className={s.intro}>
        {e.bio ? (
          <blockquote>
            <p>{e.bio}</p>
          </blockquote>
        ) : null}
        <Impression className={s.act} ids={sns.length ? [e.id] : []} place="debut">
          {sns.map((x) => (
            <SnsLink key={x.kind} className={s.snsBtn} entryId={e.id} sns={x} place="debut" iconSize="lg" label={`${e.pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`} />
          ))}
          <CopyLink entryId={e.id} name={e.pet_name} place="debut" text={`${e.pet_name} ${m}월 데뷔했어요! 화보 보러 오세요`} />
          {e.is_mine ? null : <ReportButton target="entry" targetId={e.id} className={d.reportLink} />}
        </Impression>
        {/* 인스타 이미지 올리기(#18): 누구나(주인이 자랑하고, 팬이 퍼뜨린다) */}
        <InstaShare entryId={e.id} board={board} name={e.pet_name} />
        {e.is_mine ? (
          <div className={s.owner}>
            <p>
              <b>데뷔를 축하해요!</b> 화보에 사진·GIF·동영상을 {GALLERY_MAX}칸까지 더 올릴 수 있어요({e.gallery.length}/{GALLERY_MAX}).
            </p>
            <Link className={ui.pill} href={`/${board}/${e.id}/gallery`}>
              화보 올리기
            </Link>
          </div>
        ) : null}
      </section>

      <section className={s.wallSec} aria-labelledby="debut-wall">
        <h2 id="debut-wall">
          {e.pet_name} 화보 <small>{all.length}컷</small>
        </h2>
        <PhotoWall photos={all} name={e.pet_name} />
      </section>

      <div className={s.strip} aria-hidden="true">
        <div className={s.stripTrack}>
          {[...strip, ...strip].map((p, i) => (
            <img key={`${p.path}-${i}`} src={photoUrl(p.thumb_path) ?? undefined} alt="" loading="lazy" decoding="async" />
          ))}
        </div>
      </div>

      {/* 데뷔 화보는 다음 달 내내 메인에서 손님이 가장 많이 들어오는 곳이라, 지금 오디션으로 가는 길을 둔다 */}
      <p className={s.next}>
        <span>다음 데뷔는 지금 오디션에서 뽑아요.</span>
        <Link className={ui.pill} href={`/${board}`}>
          {BOARD_NAME[board]} 연습생 픽하러 가기
        </Link>
      </p>

      <div className={s.comments}>
        {comments ? <Comments entryId={e.id} petName={e.pet_name} initial={comments.items} total={comments.total} loadFailed={comments.failed} /> : null}
      </div>
    </div>
  );
}
