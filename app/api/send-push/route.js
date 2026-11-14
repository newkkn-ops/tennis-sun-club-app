import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID 설정
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'YOUR_VAPID_PRIVATE_KEY';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@tennisclub.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

// Supabase 관리자 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_KEY';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 코트 배정 시 선수들에게 웹 푸시 알림을 발송하는 API 엔드포인트
 * POST /api/send-push
 * Body: { userIds: string[], courtNumber: number, customTitle?: string, customBody?: string }
 */
export async function POST(request) {
  try {
    const { userIds, courtNumber, customTitle, customBody } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: '수신 대상 선수 ID 목록(userIds)이 필요합니다.' }, { status: 400 });
    }

    // 1. 대상 선수들의 push_subscription 정보 조회
    const { data: targetUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, name, push_subscription')
      .in('id', userIds)
      .not('push_subscription', 'is', null);

    if (fetchError) throw fetchError;

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        message: '푸시 알림을 구독한 선수가 없습니다.',
      });
    }

    // 2. 푸시 페이로드 생성
    const payload = JSON.stringify({
      title: customTitle || '🎾 코트 배정 안내',
      body: customBody || `코트 ${courtNumber}번에 배정되었습니다. 지금 바로 입장해 주세요!`,
      url: '/',
    });

    // 3. 각 선수에게 웹 푸시 발송
    const sendPromises = targetUsers.map(async (user) => {
      try {
        await webpush.sendNotification(user.push_subscription, payload);
        return { userId: user.id, status: 'fulfilled' };
      } catch (pushErr) {
        // 구독이 만료되거나 취소된 경우(410 Gone 등) DB에서 구독 정보 제거
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await supabase
            .from('users')
            .update({ push_subscription: null })
            .eq('id', user.id);
        }
        return { userId: user.id, status: 'rejected', error: pushErr.message };
      }
    });

    const results = await Promise.allSettled(sendPromises);
    const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value?.status === 'fulfilled').length;

    return NextResponse.json({
      success: true,
      sentCount,
      totalTargets: targetUsers.length,
      message: `${sentCount}명의 선수에게 코트 배정 푸시 알림을 발송했습니다.`,
    });
  } catch (err) {
    console.error('푸시 알림 발송 중 오류:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
