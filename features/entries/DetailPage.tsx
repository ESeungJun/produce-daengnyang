/**
 * 글 상세: 사진(1~3장) · 이름 · 큰 픽 버튼 · 소개 · SNS 구경 가기 · 공유.
 * 응원 댓글은 #6, 공유 미리보기 이미지는 #8 에서 더한다.
 * getEntry 는 요청 하나 안에서 한 번만 부른다(제목 metadata 와 화면이 같이 쓴다).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BOARD_NAME, SNS_NAME, deadlineLabel, snsHandle, type Board, type SnsKind } from "@/shared/lib/format";
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
import { CopyLink } from "./CopyLink";
import { PhotoPager } from "./PhotoPager";
import { SiteNav } from "./SiteNav";
import s from "./entries.module.css";

export const getEntry = cache(async (id: string) => loadEntry(await createClient(), id));

export async function DetailPage({ board, id }: { board: Board; id: string }) {
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

  const closed = e.is_mine ? "mine" : !e.round.open ? "ended" : undefined;
  const sns = (["instagram", "tiktok", "youtube"] as SnsKind[])
    .map((k) => ({ k, url: e[k], handle: e[k] ? snsHandle(e[k]!) : null }))
    .filter((x): x is { k: SnsKind; url: string; handle: string } => !!x.url && !!x.handle);

  return (
    <div className={page.page}>
      <TopBar back={{ href: `/${board}`, label: `${BOARD_NAME[board]} 연습생` }} nav={<SiteNav current={board} />} right={<PicksLeft board={board} />} login={<LoginButton />} />
      <div className={s.detail}>
        <PhotoPager photos={e.photos} name={e.pet_name} />
        <div>
          <div className={s.dtHead}>
            <div>
              <h1>{e.pet_name}</h1>
              <p>
                {/* 조회수는 record_view(서버 키)를 연결한 뒤에 보여 준다. 지금은 늘 0이라 숨긴다. */}
                {roundTitle(e.round)} · <VoteCount entryId={e.id} base={e.pick_count} pickedToday={e.picked_today} />표
                {e.round.open ? ` · ${deadlineLabel(e.round.ends_at)}` : ""}
              </p>
            </div>
            <PickButton entryId={e.id} board={board} size="lg" pickedToday={e.picked_today} closed={closed} />
          </div>
          {e.bio ? <p className={s.bio}>{e.bio}</p> : null}
          {closed === "mine" ? <p className={s.notice}>내 아이 글이에요. 내 글에는 픽할 수 없어요. 공유해서 응원을 받아 보세요.</p> : null}
          {closed === "ended" ? <p className={s.notice}>마감된 라운드라 픽할 수 없어요. 지금 라운드는 {BOARD_NAME[board]} 게시판에서 볼 수 있어요.</p> : null}
          {e.hidden ? <p className={s.notice}>관리자가 숨긴 글이에요. 나에게만 보여요.</p> : null}
          {e.round.blind ? <p className={s.notice}>마감 전 24시간부터 결과가 나올 때까지 표 수를 가려요.</p> : null}
          <div className={s.dtAct}>
            {sns.map((x) => (
              <a key={x.k} className={ui.pill} href={x.url} target="_blank" rel="noopener noreferrer">
                {x.handle} {SNS_NAME[x.k]} 구경 가기
              </a>
            ))}
            <CopyLink name={e.pet_name} />
          </div>
        </div>
      </div>
    </div>
  );
}
