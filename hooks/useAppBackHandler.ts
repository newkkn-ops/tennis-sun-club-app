'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseAppBackHandlerOptions {
  /**
   * 이전 단계(모달 닫기, 하위 탭/화면 복귀, 이전 탭 이동 등)가 있으면 처리 후 true 반환.
   * 더 이상 돌아갈 이전 단계가 없는 최상위(루트) 화면이면 false 반환.
   */
  onGoPreviousStep: () => boolean;
  /** 루트 화면에서 백버튼 두 번 누르기 판정 시간 (기본 2500ms) */
  doublePressWindowMs?: number;
}

export interface UseAppBackHandlerResult {
  showExitConfirmModal: boolean;
  backToastMessage: string | null;
  isAppExited: boolean;
  triggerBackAction: () => void;
  cancelExitApp: () => void;
  confirmExitApp: () => void;
  restartApp: () => void;
}

/**
 * 모바일(PWA / WebView / Android / 브라우저) 백버튼 단계별 뒤로가기 & 2회 연속 입력 시 앱 종료 확인 훅
 * - 백버튼을 눌러도 앱이 바로 종료되지 않고 히스토리 가드를 유지
 * - 매 백버튼 입력마다 전단계(열린 모달 ➔ 하위 화면 ➔ 이전 탭)로 순차 이동
 * - 최상위 화면에서 백버튼을 1회 누르면 안내 토스트 표시, 2회 연속 누르면 앱 종료 확인 알람 표시
 * - 확인 클릭 시 앱 안전 종료 처리
 */
export function useAppBackHandler({
  onGoPreviousStep,
  doublePressWindowMs = 2500,
}: UseAppBackHandlerOptions): UseAppBackHandlerResult {
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [backToastMessage, setBackToastMessage] = useState<string | null>(null);
  const [isAppExited, setIsAppExited] = useState(false);

  const onGoPreviousStepRef = useRef(onGoPreviousStep);
  const showExitModalRef = useRef(showExitConfirmModal);
  const lastRootBackPressRef = useRef<number>(0);
  const isExitingRef = useRef<boolean>(false);
  const mountedAtRef = useRef<number>(Date.now());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onGoPreviousStepRef.current = onGoPreviousStep;
  }, [onGoPreviousStep]);

  useEffect(() => {
    showExitModalRef.current = showExitConfirmModal;
  }, [showExitConfirmModal]);

  const showToast = useCallback((msg: string, duration = 2200) => {
    setBackToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setBackToastMessage(null);
    }, duration);
  }, []);

  const armHistoryGuard = useCallback(() => {
    if (typeof window === 'undefined' || isExitingRef.current) return;
    try {
      window.history.pushState({ sunTennisBackGuard: true, ts: Date.now() }, '', window.location.href);
    } catch {
      // 일부 제한된 샌드박스 환경 무시
    }
  }, []);

  const triggerBackAction = useCallback(() => {
    if (isExitingRef.current) return;

    // 1. 이미 앱 종료 확인 모달이 떠 있으면 백버튼 시 모달 닫기(취소)
    if (showExitModalRef.current) {
      setShowExitConfirmModal(false);
      lastRootBackPressRef.current = 0;
      return;
    }

    // 2. 전단계로 이동 시도 (모달 닫기 / 하위 단계 / 이전 탭)
    const movedToPrevious = onGoPreviousStepRef.current();
    if (movedToPrevious) {
      lastRootBackPressRef.current = 0;
      showToast('⬅️ 이전 단계로 이동했습니다.', 1300);
      return;
    }

    // 3. 더 이상 전단계가 없는 최상위 화면: 2회 연속 백버튼 감지
    const now = Date.now();
    if (now - lastRootBackPressRef.current <= doublePressWindowMs) {
      // 두 번째 백버튼 입력 -> 앱 종료 확인 알람(모달) 표시
      lastRootBackPressRef.current = 0;
      setBackToastMessage(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setShowExitConfirmModal(true);
    } else {
      // 첫 번째 백버튼 입력 -> 바로 종료하지 않고 재입력 안내
      lastRootBackPressRef.current = now;
      showToast('⬅️ 뒤로가기를 한 번 더 누르면 앱 종료 확인 창이 열립니다.', doublePressWindowMs);
    }
  }, [doublePressWindowMs, showToast]);

  const cancelExitApp = useCallback(() => {
    setShowExitConfirmModal(false);
    lastRootBackPressRef.current = 0;
    armHistoryGuard();
  }, [armHistoryGuard]);

  const confirmExitApp = useCallback(() => {
    isExitingRef.current = true;
    setShowExitConfirmModal(false);
    setBackToastMessage(null);

    if (typeof window !== 'undefined') {
      const win = window as any;
      const nav = navigator as any;

      try {
        // 1) Capacitor / Ionic 네이티브 앱 종료
        if (win.Capacitor?.Plugins?.App?.exitApp) {
          win.Capacitor.Plugins.App.exitApp();
          return;
        }
        // 2) Cordova 네이티브 앱 종료
        if (nav.app?.exitApp) {
          nav.app.exitApp();
          return;
        }
        // 3) Android WebView 브릿지 종료
        if (win.Android?.finish) {
          win.Android.finish();
          return;
        }
        if (win.AndroidBridge?.exitApp) {
          win.AndroidBridge.exitApp();
          return;
        }
      } catch {
        // 웹 환경 폴백 진행
      }

      // 4) PWA / 창 닫기 시도
      try {
        window.close();
      } catch {
        // 일반 브라우저 탭 보안 정책으로 창 닫기가 제한될 수 있음
      }
    }

    // 5) 브라우저 환경에서도 안전하게 종료 완료 화면으로 전환
    setIsAppExited(true);
  }, []);

  const restartApp = useCallback(() => {
    isExitingRef.current = false;
    lastRootBackPressRef.current = 0;
    setIsAppExited(false);
    setShowExitConfirmModal(false);
    armHistoryGuard();
  }, [armHistoryGuard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    mountedAtRef.current = Date.now();
    isExitingRef.current = false;

    // 초기 진입/새로고침 시 백버튼 가로채기용 히스토리 가드 등록 (새로고침 시 중복 스택 방지)
    if (!window.history.state?.sunTennisBackGuard) {
      armHistoryGuard();
    }

    const handlePopState = () => {
      if (isExitingRef.current) return;
      // 새로고침 직후 일부 모바일 브라우저(Safari/WebView)가 자동 발생시키는 초기 popstate 무시
      if (Date.now() - mountedAtRef.current < 350) {
        armHistoryGuard();
        return;
      }
      // 앱이 바로 종료되거나 이탈하지 않도록 즉시 가드 재등록
      armHistoryGuard();
      triggerBackAction();
    };

    const handleNativeBackButton = (ev: Event) => {
      ev.preventDefault();
      triggerBackAction();
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('backbutton', handleNativeBackButton, false);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleNativeBackButton, false);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [armHistoryGuard, triggerBackAction]);

  return {
    showExitConfirmModal,
    backToastMessage,
    isAppExited,
    triggerBackAction,
    cancelExitApp,
    confirmExitApp,
    restartApp,
  };
}
