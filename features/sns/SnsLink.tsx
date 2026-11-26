"use client";
/**
 * SNS 로 나가는 링크. 누르면 클릭을 기록하고 새 탭으로 연다. 기록이 실패해도 이동은 그대로 된다.
 * 각 앱의 아이콘 타일로 보여 준다(#16). #21 부터 화면에는 아이콘만 둔다(사용자 의견). 이름·아이디는 읽기 도구용 label 로.
 * iconOnly=false 는 글자를 함께 써야 하는 특별한 자리에만 남겨 둔 선택지다.
 */
import { SNS_NAME, type SnsLinkInfo } from "@/shared/lib/format";
import { SnsIcon } from "./SnsIcon";
import { trackSns, type SnsPlace } from "./track";
import s from "./sns.module.css";

export function SnsLink({
  entryId,
  sns,
  place,
  className,
  children,
  iconOnly = true,
  iconSize = "md",
  label,
}: {
  entryId: string;
  sns: SnsLinkInfo;
  place: SnsPlace;
  className?: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
  iconSize?: "sm" | "md" | "lg";
  /** iconOnly 일 때 읽기 도구가 읽을 이름(기본: "@아이디 인스타") */
  label?: string;
}) {
  return (
    <a
      className={`${className ?? ""} ${iconOnly ? "" : s.withIcon}`}
      href={sns.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackSns([entryId], sns.kind, place)}
      data-track="sns_click"
      data-track-kind={sns.kind}
      data-track-place={place}
      aria-label={iconOnly ? (label ?? `${sns.handle} ${SNS_NAME[sns.kind]}`) : undefined}
    >
      <SnsIcon kind={sns.kind} size={iconSize} />
      {iconOnly ? null : (children ?? `${SNS_NAME[sns.kind]} ${sns.handle}`)}
    </a>
  );
}
