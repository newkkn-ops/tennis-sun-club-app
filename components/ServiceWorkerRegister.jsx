'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeUserToPush } from '../lib/pushNotification';

export default function ServiceWorkerRegister({ userId }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. 브라우저가 서비스 워커 및 푸시 알림을 지원하는지 확인
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('서비스 워커 등록 성공:', registration.scope);
          return registration.pushManager.getSubscription();
        })
        .then((subscription) => {
          if (subscription) {
            setIsSubscribed(true);
          }
        })
        .catch((error) => {
          console.error('서비스 워커 등록 실패:', error);
        });
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      setIsSubscribed(true);
    }
  }, []);

  // 2. 알림 권한 요청 및 PushSubscription DB 저장 (4단계 함수 연동)
  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // 현재 로그인된 유저 ID 확인
      let targetUserId = userId;
      if (!targetUserId && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }

      const subscription = await subscribeUserToPush(targetUserId, supabase);
      if (subscription) {
        setIsSubscribed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      aria-label="코트 배정 알림 설정"
      className="px-4 py-2 bg-green-50 border-b border-green-100 flex justify-between items-center transition-all"
    >
      <div className="flex items-center space-x-2">
        <span className="text-base" role="img" aria-label="notification">
          🔔
        </span>
        <span className="text-xs text-green-900 font-medium">
          {isSubscribed
            ? '코트 배정 실시간 알림이 활성화되어 있습니다.'
            : '내 차례가 되면 스마트폰으로 알림을 받아보세요'}
        </span>
      </div>

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading || isSubscribed}
        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors shadow-xs ${
          isSubscribed
            ? 'bg-green-100 text-green-700 cursor-default'
            : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
        }`}
      >
        {loading ? '연결 중...' : isSubscribed ? '알림 켜짐 ✓' : '알림 켜기'}
      </button>
    </aside>
  );
}
