const CACHE_NAME = 'tennis-club-v1';
const OFFLINE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// 1. 서비스 워커 설치 및 필수 파일 오프라인 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// 2. 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 3. 네트워크 요청 가로채기 (Network-First 전략: 실시간 점수 우선, 오프라인 시 캐시 반환)
self.addEventListener('fetch', (event) => {
  // Supabase API 요청 등 POST/PUT 요청은 캐싱에서 제외
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 정상 응답이면 최신 화면을 캐시에 업데이트
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 야외 코트에서 인터넷이 끊겼을 때 캐시된 화면 보여주기
        return caches.match(event.request);
      })
  );
});

// 4. 푸시 알림 수신 이벤트 처리 (코트 배정 및 경기 호출 알림)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {
    title: '🎾 코트 배정 안내',
    body: '다음 경기 순서입니다. 지정된 코트로 입장해 주세요!'
  };

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200], // 진동 패턴
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. 사용자가 푸시 알림을 터치했을 때 앱 화면 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
