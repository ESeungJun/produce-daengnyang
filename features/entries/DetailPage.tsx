/**
 * 글 상세: 사진(1~3장) · 이름 · 큰 픽 버튼 · 소개 · SNS 구경 가기 · 공유.
 * 응원 댓글·신고는 #6(features/comments), 공유 미리보기 이미지는 #8 에서 더한다.
 * getEntry 는 요청 하나 안에서 한 번만 부른다(제목 metadata 와 화면이 같이 쓴다).
 * 조회수는 여기서 센다(views.ts, 응답 뒤). 내 글·숨김 글은 세지 않는다. 가림 기간에는 DB 가 view_count 를 null 로 줘서 숨는다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BOARD_NAME, deadlineLabel, snsLinks, type Board } from "@/shared/lib/format";
import { Impression } from "@/features/sns/Impression";
import { CenterBanner } from "@/features/featured/CenterBanner";
import { getFeatured } from "@/features/featured/server";
import { SnsLink } from "@/features/sns/SnsLink";
import { createClient } from "@/shared/lib/supabase/server";
import { Notice } from "@/shared/ui/Notice";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { LoginButton } from "@/features/auth/LoginButton";
import { PickButton } from "@/features/picks/PickButton";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { VoteCount } from "@/features/picks/VoteCount";
import { roundTitle } from "@/features/rounds/schedule";
import { loadEntry } from "./api";
import { Comments } from "@/features/comments/Comments";
import { loadComments } from "@/features/comments/api";
import { ReportButton } from "@/features/comments/ReportButton";
import { CopyLink } from "./CopyLink";
import { NewEntryBanner } from "./NewEntryBanner";
import { ShareVisit } from "@/features/share/ShareVisit";
import { PhotoPager } from "./PhotoPager";
import { SiteNav } from "./SiteNav";
import { countView } from "./views";
import s from "./entries.module.css";

export const getEntry = cache(async (id: string) => loadEntry(await createClient(), id));

/** fresh: 등록 직후(?new=1). 내 글일 때만 공유 띠를 띄운다 */
export async function DetailPage({ board, id, fresh = false }: { board: Board; id: string; fresh?: boolean }) {
  void getFeatured().catch(() => null); // 위 센터 띠를 글과 같이 읽기 시작
  const supabase = await createClient();
  // 댓글도 글과 같이 읽기 시작한다(entry_comments 가 숨김·삭제 글을 스스로 거르므로 글 결과를 기다릴 필요가 없다)
  const commentsP = loadComments(supabase, id);
  const e = await getEntry(id);
  if (e === "deleted") {
    return (
      <Notice
        title="지워진 글이에요"
        body={`주인이 글을 지웠어요. ${BOARD_NAME[board]} 게시판에서 다른 연습생을 만나 보세요.`}
        action={
          <Link className={ui.ghost} href={`/${board}`}>
            {BOARD_NAME[board]} 게시판 가기
          </Link>
        }
      />
    );
  }
  if (!e || e.board !== board) notFound();
  if (!e.is_mine && !e.hidden) {
    const { data } = await supabase.auth.getClaims();
    await countView(e.id, data?.claims?.sub ?? null);
  }
  // 숨긴 글은 주인에게만 보이고 댓글도 받지 않는다(add_comment 가 막는다)
  const comments = e.hidden ? null : await commentsP;

  const closed = e.is_mine ? "mine" : !e.round.open ? "ended" : undefined;
  const sns = snsLinks(e);
  // 등록 직후면 첫 화면에서 보이게 맨 위(센터 띠 자리)에 공유 띠를 둔다
  const showFresh = fresh && e.is_mine && e.round.open;

  return (
    <div className={page.page}>
      <TopBar back={{ href: `/${board}`, label: `${BOARD_NAME[board]} 연습생` }} nav={<SiteNav current={board} />} right={<PicksLeft board={board} />} login={<LoginButton />} />
      <ShareVisit entryId={e.id} />
      {showFresh ? <NewEntryBanner entryId={e.id} name={e.pet_name} /> : <CenterBanner board={board} />}
      <div className={s.detail}>
        <PhotoPager photos={e.photos} name={e.pet_name} />
        <div>
          <div className={s.dtHead}>
            <div>
              <h1>{e.pet_name}</h1>
              <p>
                {roundTitle(e.round)} · <VoteCount entryId={e.id} base={e.pick_count} pickedToday={e.picked_today} />표
                {e.view_count !== null ? ` · 조회 ${e.view_count.toLocaleString("ko-KR")}` : ""}
                {e.round.open ? ` · ${deadlineLabel(e.round.ends_at)}` : ""}
              </p>
            </div>
            <PickButton entryId={e.id} board={board} size="lg" pickedToday={e.picked_today} closed={closed} />
          </div>
          {e.bio ? <p className={s.bio}>{e.bio}</p> : null}
          {closed === "mine" && !showFresh ? (
            <p className={s.notice}>
              내 아이 글이에요. 내 글에는 픽할 수 없어요. 공유해서 응원을 받아 보세요.
              {e.round.open && !e.hidden ? (
                <>
                  {" "}
                  <Link href={`/${board}/${e.id}/edit`}>글 고치기</Link>
                </>
              ) : null}
            </p>
          ) : null}
          {closed === "ended" ? <p className={s.notice}>마감된 라운드라 픽할 수 없어요. 지금 라운드는 {BOARD_NAME[board]} 게시판에서 볼 수 있어요.</p> : null}
          {e.hidden ? <p className={s.notice}>관리자가 숨긴 글이에요. 나에게만 보이고, 숨긴 동안은 댓글도 보이지 않아요.</p> : null}
          {e.round.blind ? <p className={s.notice}>마감 전 24시간부터 결과가 나올 때까지 표 수를 가려요.</p> : null}
          {/* SNS 가 있을 때만 노출을 센다(이동률의 분모). */}
          <Impression className={s.dtAct} ids={sns.length ? [e.id] : []} place="detail">
            {sns.map((x) => (
              <SnsLink key={x.kind} className={ui.pill} entryId={e.id} sns={x} place="detail" />
            ))}
            <CopyLink entryId={e.id} name={e.pet_name} place="detail" />
            {/* 신고는 주요 행동(인스타·공유)과 같은 무게로 두지 않고 줄 끝의 작은 밑줄 글자로 둔다(#6 디자인 리뷰) */}
            {e.is_mine ? null : <ReportButton target="entry" targetId={e.id} className={s.reportLink} />}
          </Impression>
          {comments ? <Comments entryId={e.id} petName={e.pet_name} initial={comments.items} total={comments.total} loadFailed={comments.failed} /> : null}
        </div>
      </div>
    </div>
  );
}
