/** 없는 주소·지워진 글. */
import { Notice } from "@/shared/ui/Notice";

export default function NotFound() {
  return <Notice title="찾는 페이지가 없어요" body="주소가 바뀌었거나 글이 지워졌을 수 있어요. 메인에서 이번 주 연습생을 만나 보세요." />;
}
