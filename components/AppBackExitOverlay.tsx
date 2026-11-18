'use client';
import React from 'react';

interface AppBackExitOverlayProps {
  backToastMessage: string | null;
  showExitConfirmModal: boolean;
  onCancelExit: () => void;
  onConfirmExit: () => void;
}

export default function AppBackExitOverlay({
  backToastMessage,
  showExitConfirmModal,
  onCancelExit,
  onConfirmExit,
}: AppBackExitOverlayProps) {
  return (
    <>
      {/* 하단 뒤로가기 안내 토스트 */}
      {backToastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] w-[90%] max-w-sm pointer-events-none">
          <div className="bg-slate-900/95 border border-amber-400/50 text-amber-200 text-xs font-extrabold px-4 py-3 rounded-2xl shadow-2xl text-center backdrop-blur-md">
            {backToastMessage}
          </div>
        </div>
      )}

      {/* 백버튼 2회 연속 입력 시 앱 종료 확인 알람 모달 */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl">
                🚪
              </div>
              <h3 className="text-base font-black text-white">앱 종료 확인</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                썬 테니스 클럽 앱을 종료하시겠습니까?
                <br />
                <span className="text-[11px] text-slate-400">확인을 누르면 앱이 안전하게 종료됩니다.</span>
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onCancelExit}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmExit}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black rounded-xl text-xs shadow-lg transition cursor-pointer"
              >
                확인 (종료)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
