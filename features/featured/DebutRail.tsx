/**
 * 메인 양옆 세로 배너(#16): 왼쪽 데뷔 댕댕이, 오른쪽 데뷔 냥이. 화면 폭 1280px 이상에서만 보이고 스크롤해도 따라온다.
 * 사진(여러 장이면 자동으로 넘김)·이름·표 수 어디를 눌러도 글 상세로 간다. SNS 는 아래 앱 아이콘 버튼.
 * 그 게시판에 데뷔가 없으면(숨김 등) 게시판으로 가는 빈 배너.
 * 노출 기록은 표지와 같은 자리(cover)로 센다. 휴대폰 표지와 동시에 보이는 일은 없다(화면 폭으로 나뉨). 배너만 따로 보려면
 * record_sns 의 자리 허용값에 rail 을 더해야 해서 #16 에서는 합쳐 센다(설계서 4-8).
 */
import Link from "next/link";
import { BOARD_NAME, SNS_NAME, count, snsLinks, type Board } from "@/shared/lib/format";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { debutPhotos, type FeaturedCard } from "./api";
import { PhotoFade } from "./PhotoFade";
import s from "./featured.module.css";

/** 가운데 표지와 같은 사진이 나란히 보이지 않게, 사진이 여러 장이면 두 번째 장부터 돌린다 */
export function railPhotos(paths: string[]): string[] {
  return paths.length > 1 ? [...paths.slice(1), paths[0]] : paths;
}

export function DebutRail({ board, card, debutMonth }: { board: Board; card?: FeaturedCard; debutMonth: string }) {
  const title = `${debutMonth}월 데뷔 · ${BOARD_NAME[board]}`;
  if (!card) {
    return (
      <aside className={s.rail} aria-label={title}>
        <Link className={`${s.railCard} ${s.railBlank}`} href={`/${board}`}>
          <span className={s.kick}>{title}</span>
          <b>이번 달 {BOARD_NAME[board]} 데뷔는 쉬어요</b>
          <span>{BOARD_NAME[board]} 게시판 보기 →</span>
        </Link>
      </aside>
    );
  }
  const sns = snsLinks(card);
  return (
    <aside className={s.rail} aria-label={title}>
      <Link className={s.railCard} href={`/${card.board}/${card.entry_id}`}>
        <PhotoFade paths={railPhotos(debutPhotos(card))} alt={`${title} ${card.pet_name}`} eager />
        <span className={s.scrim} />
        <span className={s.railLines}>
          <span className={s.kick}>{title}</span>
          <span className={s.railName}>{card.pet_name}</span>
          <span className={s.cap}>{count(card.votes)}표로 데뷔</span>
        </span>
      </Link>
      {sns.length ? (
        <Impression className={s.railSns} ids={[card.entry_id]} place="cover">
          <span className={s.railSnsCap}>{card.pet_name} SNS 구경 가기</span>
          {sns.map((x) => (
            <SnsLink
              key={x.kind}
              className={s.railSnsBtn}
              entryId={card.entry_id}
              sns={x}
              place="cover"
              iconOnly
              iconSize="lg"
              label={`${card.pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`}
            />
          ))}
        </Impression>
      ) : null}
    </aside>
  );
}
