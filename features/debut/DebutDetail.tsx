/**
 * 데뷔 화보 상세(#17). 데뷔한 글(get_entry.debut)은 일반 상세 대신 잡지 화보로 보여 준다.
 * 순서: 패션 매거진 웹 화보(Magazine: 꽉 찬 표지 → 사진 지면·글 꼭지 → 맺음, #31)
 *       → SNS·공유 + 인스타에 올리기(#18) + 주인 안내 → 천천히 흐르는 사진 띠 → 응원 댓글.
 * 이름(h1)·소개 덱·표 수는 잡지 표지에, "다음 데뷔는 지금 오디션에서" 길은 화보 맺음에 있다.
 * 들어올 때 꽃가루가 한 번 터진다(Confetti, 같은 글은 세션에 한 번). 사진은 눌러서 크게 본다(Magazine, #24).
 * 공유·SNS·인스타 기록은 자리 debut 로 남겨 일반 상세(detail)와 나눠 센다(#24). '움직임 줄이기'면 꽃가루·흐름 없이 사진만(CSS).
 * 주인에게는 "화보 올리기"(사진·GIF·동영상 최대 20칸과 글 꼭지, #31, /<게시판>/<글>/gallery) 길을 둔다. 숨긴 글은 이 화면을 쓰지 않는다(DetailPage 가 거른다).
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
import { isNote, type EntryDetail } from "@/features/entries/api";
import { SiteNav } from "@/features/entries/SiteNav";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { ShareVisit } from "@/features/share/ShareVisit";
import { Confetti } from "./Confetti";
import { InstaShare } from "./InstaShare";
import { Magazine } from "./Magazine";
import { GALLERY_MAX } from "./limits";
import d from "@/features/entries/entries.module.css";
import s from "./debut.module.css";
import mag from "./magazine.module.css";

type Props = {
  e: EntryDetail;
  board: Board;
  comments: Awaited<ReturnType<typeof loadComments>> | null;
};

/** "N월 데뷔"는 결선(마지막 주차) 라운드가 있던 달이다. 메인 표지의 "10월 데뷔"와 같은 셈(MainPage debutMonth) */
const debutMonthOf = (month: string) => Number(month.slice(5, 7));

export function DebutDetail({ e, board, comments }: Props) {
  // 사진·GIF·동영상 칸(표지·띠·컷 수)과, 글 꼭지까지 섞인 지면 순서(벽)
  const shots = e.gallery.filter((g) => !isNote(g));
  const all = [...e.photos, ...shots];
  const sns = e.sns_open ? snsLinks(e) : [];
  const m = debutMonthOf(e.round.month);
  // 흐르는 띠는 끊김 없이 돌도록 같은 목록을 두 번 잇는다(띠 전체가 읽기 도구에서 숨김). 세 바퀴(3분) 돌고 멈춘다
  // 넓은 화면에서도 띠 끝이 비지 않게 한 벌을 8장 이상으로 채운다(사진이 적으면 되풀이)
  // 칸이 하나도 없으면(이론상 원래 사진이 늘 있지만) 띠를 그리지 않는다(8/0 = Infinity 길이 배열 방지)
  const strip = all.length ? Array.from({ length: Math.ceil(8 / all.length) }, () => all).flat() : [];

  return (
    <div className={`${page.page} ${s.debut}`}>
      <TopBar back={{ href: `/${board}`, label: `${BOARD_NAME[board]} 연습생` }} nav={<SiteNav current={board} />} login={<LoginButton />} />
      <ShareVisit entryId={e.id} place="debut" />
      <Confetti entryId={e.id} />

      <Magazine
        entryId={e.id}
        items={[...e.photos, ...e.gallery]}
        name={e.pet_name}
        bio={e.bio}
        board={board}
        boardName={BOARD_NAME[board]}
        issue={`${e.round.month.slice(0, 4)}.${e.round.month.slice(5, 7)}`}
        month={m}
        votes={e.pick_count !== null ? `${count(e.pick_count)}표로 데뷔` : "데뷔 평가 통과"}
        editHref={e.is_mine ? `/${board}/${e.id}/gallery` : undefined}
        coverActions={
          // 표지를 보고 바로 팔로우·공유하게(#31 사용자 결정 안 A). 아래 SNS 칸(debut)과 자리를 나눠 센다.
          // 공유하기는 늘 있으므로 SNS 가 없는 글도 노출을 남겨 공유율의 분모로 쓴다(SNS 유무는 분석에서 나눈다)
          <Impression className={mag.coverSns} ids={[e.id]} place="debut_cover">
            {sns.map((x) => (
              <SnsLink key={x.kind} entryId={e.id} sns={x} place="debut_cover" iconSize="md" label={`${e.pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`} />
            ))}
            <CopyLink entryId={e.id} name={e.pet_name} place="debut_cover" className={mag.coverShare} text={`${e.pet_name} ${m}월 데뷔했어요! 화보 보러 오세요`} />
          </Impression>
        }
      />

      {/* 화보 맺음의 "SNS·공유" 길이 오는 자리 */}
      <section className={s.intro} id="debut-share">
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
              <b>데뷔를 축하해요!</b> 화보에 사진·GIF·동영상을 {GALLERY_MAX}칸까지, 소개·소감 같은 글도 함께 올릴 수 있어요({shots.length}/{GALLERY_MAX}).
            </p>
            <Link className={ui.pill} href={`/${board}/${e.id}/gallery`}>
              화보 올리기
            </Link>
          </div>
        ) : null}
      </section>

      {strip.length ? (
        <div className={s.strip} aria-hidden="true">
          <div className={s.stripTrack}>
            {[...strip, ...strip].map((p, i) => (
              <img key={`${p.path}-${i}`} src={photoUrl(p.thumb_path) ?? undefined} alt="" loading="lazy" decoding="async" />
            ))}
          </div>
        </div>
      ) : null}

      {/* 화보 맺음의 "응원 댓글 쓰기" 길이 오는 자리 */}
      <div className={s.comments} id="debut-cheer">
        {comments ? <Comments entryId={e.id} petName={e.pet_name} initial={comments.items} total={comments.total} loadFailed={comments.failed} /> : null}
      </div>
    </div>
  );
}
