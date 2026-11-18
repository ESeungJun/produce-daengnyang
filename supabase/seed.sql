-- ─────────────────────────────────────────────────────────────
-- 로컬 개발용 예시 데이터(supabase start·db reset 때만 들어간다. 원격 DB 에는 넣지 않는다).
-- 날짜는 실행하는 날 기준이다: 그달·지난달 라운드를 만들고,
--   지난달 결선 → 이달의 데뷔, 이번 달 끝난 주간 라운드 → 센터·후보, 지금 라운드 → 게시판·차트(▲▼ 포함).
-- 사진 파일은 supabase/seed-photos.sh 가 로컬 Storage 에 올린다(CC0 사진, 출처는 seed-photos/credits.md).
-- 이름·표 수는 모두 예시다.
-- ─────────────────────────────────────────────────────────────
insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000aa01', 'seed1@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000aa02', 'seed2@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000aa03', 'seed3@example.com', false, '{}');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('seed-g1', '00000000-0000-0000-0000-00000000aa01', '{"sub":"seed-g1"}', 'google'),
  ('seed-g2', '00000000-0000-0000-0000-00000000aa02', '{"sub":"seed-g2"}', 'google'),
  ('seed-g3', '00000000-0000-0000-0000-00000000aa03', '{"sub":"seed-g3"}', 'google');

do $$
declare
  this_month date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  owners uuid[] := array['00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-00000000aa03']::uuid[];
  -- 게시판별 예시 이름·사진 번호·SNS
  dogs text[] := array['두부', '짱구', '콩이', '땅콩', '보리', '백설'];
  cats text[] := array['오레오', '솜이', '모카', '구름', '호랑', '치즈'];
  r record;
  e_id uuid;
  i int;
  b public.board_kind;
  names text[];
  votes int[] := array[3412, 3108, 2560, 1987, 1450, 12];
  prev int[] := array[2, 1, 6, 4, 5, null];   -- 오늘 0시 순위(▲▼ 보이게)
begin
  perform public.ensure_month_rounds((this_month - interval '1 month')::date);
  perform public.ensure_month_rounds(this_month);
  -- 이미 끝난 라운드는 결과가 확정된 것으로 둔다
  update public.rounds set finalized_at = ends_at + interval '1 minute' where ends_at <= now() and finalized_at is null;

  -- 끝난 라운드마다 게시판별 3마리와 결과(1·2·3위)
  for r in select * from public.rounds where ends_at <= now() and month >= (this_month - interval '1 month')::date order by starts_at loop
    foreach b in array array['dog', 'cat']::public.board_kind[] loop
      names := case when b = 'dog' then dogs else cats end;
      for i in 1..3 loop
        e_id := gen_random_uuid();
        insert into public.entries (id, round_id, board, owner_id, pet_name, bio, instagram, pick_count, created_at)
        values (e_id, r.id, b, owners[i], names[1 + (r.seq + i + case when r.kind = 'final' then 3 else 0 end) % 6],
                '예시 소개예요. 산책과 간식을 좋아해요.', 'https://www.instagram.com/' || case when b = 'dog' then 'dog' else 'cat' end || '.seed' || i || '/',
                50000 / i - r.seq * 900, r.starts_at + interval '1 hour');
        insert into public.entry_photos (entry_id, position, path, thumb_path)
        values (e_id, 0, owners[i] || '/seed-' || b || (1 + (r.seq + i) % 5) || '.webp', owners[i] || '/seed-' || b || (1 + (r.seq + i) % 5) || '-t.webp');
        insert into public.round_results (round_id, board, rank, entry_id, votes, role)
        values (r.id, b, i, e_id, 50000 / i - r.seq * 900,
                case when i = 1 and r.kind = 'final' then 'debut' when i = 1 then 'center' when i = 2 and r.kind = 'weekly' then 'finalist' end::public.result_role);
      end loop;
    end loop;
  end loop;

  -- 지금 열린 라운드: 게시판마다 6마리, 표 수와 오늘 0시 순위
  for r in select * from public.rounds where now() >= starts_at and now() < ends_at loop
    foreach b in array array['dog', 'cat']::public.board_kind[] loop
      names := case when b = 'dog' then dogs else cats end;
      for i in 1..6 loop
        e_id := gen_random_uuid();
        insert into public.entries (id, round_id, board, owner_id, pet_name, bio, instagram, pick_count, last_pick_at, created_at)
        values (e_id, r.id, b, owners[1 + i % 3], names[i], '예시 소개예요. 웃는 얼굴이 자랑이에요.',
                case when i % 2 = 1 then 'https://www.instagram.com/' || b || '.' || i || '/' end,
                votes[i] - case when b = 'cat' then 431 else 0 end, now() - interval '1 hour' * i, r.starts_at + interval '1 hour' * (7 - i));
        insert into public.entry_photos (entry_id, position, path, thumb_path)
        values (e_id, 0, owners[1 + i % 3] || '/seed-' || b || (1 + (i - 1) % 5) || '.webp', owners[1 + i % 3] || '/seed-' || b || (1 + (i - 1) % 5) || '-t.webp');
        if i = 1 then
          insert into public.entry_photos (entry_id, position, path, thumb_path)
          values (e_id, 1, owners[2] || '/seed-' || b || '5.webp', owners[2] || '/seed-' || b || '5-t.webp');
        end if;
        if prev[i] is not null then
          insert into public.rank_snapshots (entry_id, kst_date, round_id, board, rank) values (e_id, public.kst_today(), r.id, b, prev[i]);
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- 조회수 토큰(#5, count_view). 로컬 개발용 값이라 공개돼도 된다. 원격 값은 따로 만들어 Vault·Worker 비밀값에만 둔다.
-- .env.local 의 VIEW_TOKEN 과 같아야 로컬에서 조회수가 올라간다.
select vault.create_secret('local-dev-view-token', 'view_token');
