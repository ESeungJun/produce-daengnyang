"use client";
/**
 * SNS 로 나가는 링크. 누르면 클릭을 기록하고 새 탭으로 연다. 기록이 실패해도 이동은 그대로 된다.
 * 앞에 각 앱의 아이콘 타일을 붙인다(#16, 눈에 잘 띄게). iconOnly 면 아이콘만(이름은 읽기 도구용 글자로).
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
  iconOnly = false,
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
      aria-label={iconOnly ? (label ?? `${sns.handle} ${SNS_NAME[sns.kind]}`) : undefined}
    >
      <SnsIcon kind={sns.kind} size={iconSize} />
      {iconOnly ? null : (children ?? `${SNS_NAME[sns.kind]} ${sns.handle}`)}
    </a>
  );
}
