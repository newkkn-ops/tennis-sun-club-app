'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 모바일(PWA / WebView / Android / 브라우저) 백버튼 단계별 뒤로가기 & 2회 연속 입력 시 앱 종료 확인 훅
 */
export function useAppBackHandler({
  onGoPreviousStep,
  doublePressWindowMs = 2500,
}) {
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [backToastMessage, setBackToastMessage] = useState(null);
  const [isAppExited, setIsAppExited] = useState(false);

  const onGoPreviousStepRef = useRef(onGoPreviousStep);
  const showExitModalRef = useRef(showExitConfirmModal);
  const lastRootBackPressRef = useRef(0);
  const isExitingRef = useRef(false);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    onGoPreviousStepRef.current = onGoPreviousStep;
  }, [onGoPreviousStep]);

  useEffect(() => {
    showExitModalRef.current = showExitConfirmModal;
  }, [showExitConfirmModal]);

  const showToast = useCallback((msg, duration = 2200) => {
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
    } catch {}
  }, []);

  const triggerBackAction = useCallback(() => {
    if (isExitingRef.current) return;

    if (showExitModalRef.current) {
      setShowExitConfirmModal(false);
      lastRootBackPressRef.current = 0;
      return;
    }

    const movedToPrevious = onGoPreviousStepRef.current();
    if (movedToPrevious) {
      lastRootBackPressRef.current = 0;
      showToast('⬅️ 이전 단계로 이동했습니다.', 1300);
      return;
    }

    const now = Date.now();
    if (now - lastRootBackPressRef.current <= doublePressWindowMs) {
      lastRootBackPressRef.current = 0;
      setBackToastMessage(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setShowExitConfirmModal(true);
    } else {
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
      try {
        if (window.Capacitor?.Plugins?.App?.exitApp) {
          window.Capacitor.Plugins.App.exitApp();
          return;
        }
        if (navigator.app?.exitApp) {
          navigator.app.exitApp();
          return;
        }
        if (window.Android?.finish) {
          window.Android.finish();
          return;
        }
        if (window.AndroidBridge?.exitApp) {
          window.AndroidBridge.exitApp();
          return;
        }
      } catch {}

      try {
        window.close();
      } catch {}
    }

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

    if (!window.history.state?.sunTennisBackGuard) {
      armHistoryGuard();
    }

    const handlePopState = () => {
      if (isExitingRef.current) return;
      armHistoryGuard();
      triggerBackAction();
    };

    const handleNativeBackButton = (ev) => {
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
