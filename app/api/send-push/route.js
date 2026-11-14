import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID 키 설정 (환경 변수에서 불러옴)
webpush.setVapidDetails(
  'mailto:admin@tennisclub.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Supabase 서버사이드 클라이언트 (데이터 조회를 위해 Service Role Key 또는 권한이 부여된 키 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { userIds, title, message, url } = body; 
    // userIds: 알림을 받을 사용자 UUID 배열 (예: 코트에 배정된 선수들)

    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ success: false, message: '알림을 받을 수신자가 없습니다.' }, { status: 400 });
    }

    // 1. Supabase의 users 테이블에서 대상 사용자들의 푸시 구독 정보 조회
    const { data: users, error } = await supabase
      .from('users')
      .select('id, push_subscription')
      .in('id', userIds);

    if (error) throw error;

    // 2. 보낼 푸시 메시지 페이로드 구성
    const pushPayload = JSON.stringify({
      title: title || '🎾 테니스 클럽 코트 배정 안내',
      body: message || body.body || '다음 경기 순서입니다. 지정된 코트로 입장해 주세요!',
      url: url || '/'
    });

    // 3. 대상 사용자들에게 각각 웹 푸시 전송 실행
    const notifications = users.map(async (user) => {
      // 구독 정보가 없는 회원은 패스
      if (!user.push_subscription) return { userId: user.id, status: 'no_subscription' };

      try {
        await webpush.sendNotification(user.push_subscription, pushPayload);
        return { userId: user.id, status: 'success' };
      } catch (err) {
        console.error(`유저 ${user.id} 푸시 전송 실패:`, err);
        return { userId: user.id, status: 'failed', error: err.message };
      }
    });

    const results = await Promise.all(notifications);

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('푸시 API 서버 에러:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
