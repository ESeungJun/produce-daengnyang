/**
 * 동영상(MP4·MOV)에서 촬영 위치 같은 메타데이터를 지운다(#31 보안 리뷰).
 * 휴대폰 카메라는 위치를 moov/udta(©xyz), moov/meta(com.apple.quicktime.location.ISO6709)에 넣는다.
 * 개인정보 처리방침이 "올릴 때 위치 정보를 지운다"고 약속하므로, 사진(다시 그리기)과 같이 동영상도 지우고 올린다.
 * 방법: 상자(box)를 지우면 뒤쪽 위치값(stco 의 chunk offset)이 어긋나므로, 크기는 그대로 두고
 *       1. 메타데이터 상자(udta·meta·uuid)의 내용을 0으로 채우고 2. 이름을 'free'(빈 자리)로 바꾼다. 재생기는 free 를 건너뛴다.
 * 내려가는 상자는 moov·trak·mdia·minf 뿐이다(위치가 들어가는 자리). 구조를 끝까지 못 읽으면 null(받지 않음).
 * WebM 은 휴대폰 카메라가 쓰지 않고 위치 칸도 거의 없어 손대지 않는다(부르는 쪽이 MP4·MOV 에만 쓴다).
 */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf"]);
const STRIP = new Set(["udta", "meta", "uuid"]);

const typeAt = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

/** 바꾼 상자 수를 돌려준다. 구조가 깨졌으면 null. bytes 를 그 자리에서 고친다 */
export function stripVideoMeta(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let stripped = 0;
  // [start, end) 구간의 상자들을 차례로 읽는다
  const walk = (start: number, end: number): boolean => {
    let at = start;
    while (at < end) {
      if (end - at < 8) return false;
      let size = view.getUint32(at);
      let head = 8;
      if (size === 1) {
        // 64비트 크기(큰 mdat)
        if (end - at < 16) return false;
        const big = view.getBigUint64(at + 8);
        if (big > BigInt(end - at)) return false;
        size = Number(big);
        head = 16;
      } else if (size === 0) {
        size = end - at; // 끝까지
      }
      if (size < head || at + size > end) return false;
      const type = typeAt(bytes, at + 4);
      if (STRIP.has(type)) {
        bytes.fill(0, at + head, at + size);
        bytes.set([0x66, 0x72, 0x65, 0x65], at + 4); // 'free'
        stripped += 1;
      } else if (CONTAINERS.has(type) && !walk(at + head, at + size)) {
        return false;
      }
      at += size;
    }
    return at === end;
  };
  return walk(0, bytes.length) ? stripped : null;
}
