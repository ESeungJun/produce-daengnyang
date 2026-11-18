/** 등록·수정이 DB 에서 거절됐을 때 화면 문구(create_entry·update_entry 의 P0001 메시지). */
export const ENTRY_ERROR_TEXT: Record<string, string> = {
  no_round: "지금 열린 주차가 없어요. 다음 주차에 올려 주세요",
  final_period: "지금은 데뷔 평가 기간이라 등록을 쉬어요. 다음 달 1일부터 다시 받아요",
  entry_limit: "이번 주차에는 두 번까지 올릴 수 있어요. 다음 주차에 또 올려 주세요",
  invalid_name: "이름을 1~20자로 적어 주세요. 보이지 않는 특수 글자는 쓸 수 없어요",
  invalid_bio: "소개는 100자까지 적을 수 있어요",
  invalid_sns: "SNS 주소를 다시 확인해 주세요. 프로필 주소만 받아요",
  invalid_photo: "사진을 다시 골라 주세요. 같은 사진을 두 번 쓸 수 없어요",
  photos_locked: "픽을 받은 뒤에는 사진을 바꿀 수 없어요. 이름·소개·SNS 는 바꿀 수 있어요",
  round_closed: "주차가 끝나서 더는 고칠 수 없어요",
  not_owner: "내 글만 고칠 수 있어요",
  not_found: "글을 찾지 못했어요. 지워졌을 수 있어요",
  signin_required: "구글로 로그인한 회원만 올릴 수 있어요",
};

export function entryErrorText(message: string | undefined): string {
  return (message && ENTRY_ERROR_TEXT[message]) || "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요";
}
