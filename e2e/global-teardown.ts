/**
 * E2E 끝에 한 번(#48): 시험 파일이 중간에 멈춰 afterAll 이 못 돌았어도 시험용 주간 라운드(2099-12 1주차)를 원래 날짜로 닫는다.
 * 열린 채 남으면 로컬 자정 작업이 이틀 뒤 확정해 결과·알림이 생긴다.
 */
import { closeWeeklyForTest } from "./support";

export default async function globalTeardown() {
  closeWeeklyForTest();
}
