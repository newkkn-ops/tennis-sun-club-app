import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Vercel 정적 평가 방지 (런타임에 동적 실행)
export const dynamic = 'force-dynamic';

export async function POST(request) {
  // ✅ VAPID 설정을 POST 함수 내부로 이동합니다 (빌드 타임 에러 방지)
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
      );
    }
  } catch (vapidErr) {
    console.warn('VAPID 설정 경고:', vapidErr.message);
  }

  try {
    // 1. Supabase 클라이언트 초기화 (런타임 생성)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, message: 'Supabase 접속 정보가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { userIds, title, message, url } = body;
    // userIds: 알림을 받을 사용자 UUID 배열 (예: 코트에 배정된 선수들)

    if (!userIds || userIds.length === 0) {
      return NextResponse.json(
        { success: false, message: '알림을 받을 수신자가 없습니다.' },
        { status: 400 }
      );
    }

    // 2. Supabase의 users 테이블에서 대상 사용자들의 푸시 구독 정보 조회
    const { data: users, error } = await supabase
      .from('users')
      .select('id, push_subscription')
      .in('id', userIds);

    if (error) throw error;

    // 3. 보낼 푸시 메시지 페이로드 구성
    const pushPayload = JSON.stringify({
      title: title || '🎾 테니스 클럽 코트 배정 안내',
      body: message || body.body || '다음 경기 순서입니다. 지정된 코트로 입장해 주세요!',
      url: url || '/',
    });

    // 4. 대상 사용자들에게 각각 웹 푸시 전송 실행
    const notifications = (users || []).map(async (user) => {
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
