# 🎾 테니스 클럽 운영 어플 (Tennis Club App)

> 한국 동호인 테니스 문화(금배/은배/동배/국화/개나리/테린이 등급제)에 최적화된 **KDK 대진표 자동 편성, 본선 토너먼트 시드 배정, Supabase Realtime 코트 스코어보드, 개인 통산 전적 마이페이지, PWA 모바일 앱** 통합 운영 시스템입니다.

---

## 🌟 주요 기능

### 1. 🎾 KDK 대진표 자동 생성 엔진 (`lib/kdk.js`)
- **균등 출전 우선순위**: 경기 출전 횟수(`playCount`)가 적은 선수를 우선 배정하여 휴식 기회를 고르게 분배
- **몬테카를로(Monte Carlo) 시뮬레이션 (300회 시도)**:
  - 파트너 중복 방지 (페널티 +100)
  - 상대방 중복 최소화 (페널티 +20)
  - 등급 가중치(`금배: 10`, `은배: 8`, `동배: 6`, `테린이: 3` 등)를 반영한 **복식 팀 간 실력 밸런싱**

### 2. 🏆 본선 토너먼트 자동 생성 (`lib/tournament.js`)
- $2^n$ 규격(16강, 8강, 4강 등) 자동 계산
- 예선 상위 시드 순으로 **부전승(BYE)**을 자동 배정하여 8강 자동 직행 처리
- 인터랙티브 대진 브래킷 지원

### 3. 🔴 실시간 코트 현황판 & 모바일 스코어보드 (`components/TennisCourtBoard.jsx`)
- **Supabase Realtime (`postgres_changes`)** 연동
- 코트별 경기 상태(`🔴 경기 진행 중`, `⚪ 대기 중`, `🏁 경기 종료`)
- 운영자 및 코트 대표의 터치 스코어 입력 모달 $\rightarrow$ 전 접속자 스마트폰 화면 0.1초 내 즉각 반영

### 4. 👤 마이페이지 & 통산 전적 (`components/MyPage.jsx`)
- 개인별 통산 전적(총 경기, 승, 패, 승률 %, 총 득실차) 요약 카드
- 복식 `uuid[]` 배열 필터링을 통한 상세 경기 이력(승/패 뱃지, 세부 점수)

### 5. ⚙️ 회원 등급 및 운영자 권한 관리 (`components/AdminUserManagement.jsx`)
- 👑 Admin 권한 계정만 접근 가능 (하단 탭바 보안 제어)
- 클럽원 등급(금배~테린이) 실시간 수정 $\rightarrow$ 차기 KDK 대진 편성 시 가중치 즉각 반영

### 6. 📱 PWA (Progressive Web App) & 푸시 알림 (`public/sw.js`, `manifest.json`)
- `display: standalone`으로 스마트폰 홈 화면에 설치하여 앱스토어 앱처럼 구동
- **Network-First 오프라인 캐싱** 및 **코트 배정/경기 호출 푸시 알림 (`push`, `notificationclick`)** 지원

---

## 📁 프로젝트 구조

```
테니스 어플/
├── App.jsx / App.tsx              # 메인 통합 앱 엔트리 & 바텀 탭 네비게이션
├── index.html                     # PWA 메타태그 및 서비스워커 등록 메인 웹 페이지
├── manifest.json / public/        # PWA 매니페스트 설정
├── sw.js / public/sw.js           # 오프라인 캐싱 & 푸시 알림 서비스 워커
├── public/icons/                  # 192x192, 512x512 고화질 테니스 앱 아이콘
├── app/                           # Next.js 14 App Router 지원 (layout, page)
├── components/
│   ├── TennisCourtBoard.jsx       # 실시간 코트 현황판 & 스코어보드
│   ├── TournamentScheduleView.jsx # KDK & 토너먼트 시각 대진표
│   ├── MyPage.jsx                 # 마이페이지 & 개인 통산 전적
│   └── AdminUserManagement.jsx    # 회원 등급 및 운영자 권한 관리
├── lib/
│   ├── kdk.js / kdk.ts            # KDK 대진 생성 알고리즘 모듈
│   ├── tournament.js / .ts        # 본선 토너먼트 & 부전승 시드 엔진
│   ├── supabase.js                # Supabase 싱글톤 클라이언트
│   └── finalizeTournamentStats.js # 대회 마감 및 개인 통산 성적 Upsert 정산기
├── hooks/
│   └── useAuth.js / useAuth.ts    # Supabase Auth 세션 및 프로필 바인딩 훅
├── database/
│   └── schema.sql                 # PostgreSQL / Supabase DDL, Auth 외래키, 트리거, RLS
└── test/
    └── simulator.html             # 브라우저 즉시 검증 통합 시뮬레이터
```

---

## 🚀 빠른 시작

### 1. 환경 변수 설정
`.env.example`을 복사하여 `.env.local`을 생성하고 본인의 Supabase 키를 입력합니다:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. 데이터베이스 설정
`database/schema.sql`의 SQL 스크립트를 Supabase SQL Editor에 복사하여 실행합니다.

### 3. 브라우저에서 바로 확인하기
- `index.html` 또는 `test/simulator.html` 파일을 더블클릭하여 Chrome이나 Edge 브라우저로 열면, 서버 구동 없이도 모든 기능을 즉시 시뮬레이션하고 테스트할 수 있습니다.
