'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Base64 VAPID 키를 Uint8Array로 변환하는 표준 헬퍼
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export default function ServiceWorkerRegister({ userId }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. 브라우저가 서비스 워커 및 푸시 알림을 지원하는지 확인
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] 서비스 워커 등록 성공:', registration.scope);
          // 기존 구독 여부 확인
          return registration.pushManager.getSubscription();
        })
        .then((subscription) => {
          if (subscription) {
            setIsSubscribed(true);
          }
        })
        .catch((error) => {
          console.error('[PWA] 서비스 워커 등록 실패:', error);
        });
    }

    if (Notification.permission === 'granted') {
      setIsSubscribed(true);
    }
  }, []);

  // 2. 알림 권한 요청 및 PushSubscription DB 저장
  const requestNotificationPermission = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('알림 권한이 거절되었습니다.');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // 브라우저 PushManager를 통해 푸시 구독 생성
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      console.log('[PWA] 발급된 PushSubscription:', subscription);

      // 현재 유저 ID 확인 (prop 또는 세션)
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }

      // Supabase users 테이블의 push_subscription 컬럼에 저장
      if (targetUserId) {
        const { error: dbError } = await supabase
          .from('users')
          .update({
            push_subscription: subscription.toJSON(),
          })
          .eq('id', targetUserId);

        if (dbError) {
          console.error('[PWA] 구독 정보 DB 저장 실패:', dbError);
        } else {
          console.log('[PWA] 구독 정보 Supabase 저장 완료!');
        }
      }

      setIsSubscribed(true);
      alert('🎾 코트 배정 알림이 설정되었습니다!\n경기 호출 시 스마트폰으로 알림이 전송됩니다.');
    } catch (err) {
      console.error('[PWA] 푸시 구독 처리 중 오류:', err);
      alert('푸시 알림 구독 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 이미 구독한 경우 배너 숨김 처리
  if (isSubscribed) {
    return null;
  }

  return (
    <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 flex justify-between items-center transition-all">
      <div className="flex items-center gap-2">
        <span className="text-base">🔔</span>
        <span className="text-xs text-green-800 font-medium">
          내 차례가 되면 알림을 받아보세요
        </span>
      </div>
      <button
        onClick={requestNotificationPermission}
        disabled={loading}
        className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 shadow-xs transition disabled:opacity-50"
      >
        {loading ? '연결 중...' : '알림 켜기'}
      </button>
    </div>
  );
}
