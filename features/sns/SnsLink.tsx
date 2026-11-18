"use client";
/**
 * SNS 로 나가는 링크. 누르면 클릭을 기록하고 새 탭으로 연다. 기록이 실패해도 이동은 그대로 된다.
 */
import { SNS_NAME, type SnsLinkInfo } from "@/shared/lib/format";
import { trackSns, type SnsPlace } from "./track";

export function SnsLink({
  entryId,
  sns,
  place,
  className,
  children,
}: {
  entryId: string;
  sns: SnsLinkInfo;
  place: SnsPlace;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      className={className}
      href={sns.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackSns([entryId], sns.kind, place)}
    >
      {children ?? `${sns.handle} ${SNS_NAME[sns.kind]} 구경 가기`}
    </a>
  );
}
