import { SupabaseClient } from '@supabase/supabase-js';

// VAPID 키 Base64 변환 유틸리티 함수
export function urlBase64ToUint8Array(base64String?: string): Uint8Array {
  if (!base64String) return new Uint8Array(0);
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 4단계: 클라이언트에서 푸시 구독 정보 저장하기
 * 사용자의 브라우저에서 PushManager 구독을 생성하고 Supabase users.push_subscription 컬럼에 저장
 */
export async function subscribeUserToPush(
  userId?: string,
  supabase?: SupabaseClient
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // VAPID 공개키 변환
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY 환경변수가 설정되지 않았습니다.');
    }
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // 푸시 구독 생성
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    // Supabase의 users 테이블에 push_subscription 데이터 저장
    if (supabase && userId) {
      const { error } = await supabase
        .from('users')
        .update({ push_subscription: subscription })
        .eq('id', userId);

      if (error) throw error;
    }

    alert('성공적으로 푸시 알림이 구독되었습니다!');
    return subscription;
  } catch (err: any) {
    console.error('푸시 구독 중 오류 발생:', err);
    alert('알림 구독에 실패했습니다.');
    return null;
  }
}
