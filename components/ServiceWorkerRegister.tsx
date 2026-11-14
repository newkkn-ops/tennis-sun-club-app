'use client';
import React, { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('서비스 워커 등록 성공:', registration.scope);
        })
        .catch((error) => {
          console.error('서비스 워커 등록 실패:', error);
        });
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      alert('코트 배정 알림이 설정되었습니다!');
    }
  };

  return (
    <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex justify-between items-center">
      <span className="text-xs text-green-800 font-medium">
        🔔 내 차례가 되면 알림을 받아보세요
      </span>
      <button
        onClick={requestNotificationPermission}
        className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition"
      >
        알림 켜기
      </button>
    </div>
  );
}
