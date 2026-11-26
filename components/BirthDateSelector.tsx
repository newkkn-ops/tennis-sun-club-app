'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  parseBirthDate,
  buildBirthDate,
  getDaysInMonth,
  calculateKoreanManAge,
  getBirthYearOptions,
} from '../lib/age';

interface BirthDateSelectorProps {
  value: string;
  onChange: (birthDate: string) => void;
  label?: string;
  required?: boolean;
  compact?: boolean;
  helperText?: string;
  accent?: 'amber' | 'emerald';
}

export default function BirthDateSelector({
  value,
  onChange,
  label = '생년월일 (만 나이 자동 계산)',
  required = false,
  compact = false,
  helperText,
  accent = 'amber',
}: BirthDateSelectorProps) {
  const [year, setYear] = useState<string>(() => parseBirthDate(value).year);
  const [month, setMonth] = useState<string>(() => parseBirthDate(value).month);
  const [day, setDay] = useState<string>(() => parseBirthDate(value).day);

  // 외부 value가 변경(모달 열기 / 폼 초기화 등)되었을 때 내부 선택 상태 동기화
  useEffect(() => {
    const parsed = parseBirthDate(value);
    if (value) {
      setYear(parsed.year);
      setMonth(parsed.month);
      setDay(parsed.day);
    } else if (!value && year && month && day) {
      // 외부에서 명시적으로 '' 리셋된 경우 초기화
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value]);

  const yearOptions = useMemo(() => getBirthYearOptions(), []);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const maxDays = useMemo(() => {
    const yNum = Number(year) || 2000;
    const mNum = Number(month) || 1;
    return getDaysInMonth(yNum, mNum);
  }, [year, month]);
  const dayOptions = useMemo(
    () => Array.from({ length: maxDays }, (_, i) => i + 1),
    [maxDays]
  );

  const commitIfComplete = (nextY: string, nextM: string, nextD: string) => {
    if (nextY && nextM && nextD) {
      const clampedDay = Math.min(
        Number(nextD),
        getDaysInMonth(Number(nextY), Number(nextM))
      );
      const safeDayStr = String(clampedDay);
      if (safeDayStr !== nextD) {
        setDay(safeDayStr);
      }
      onChange(buildBirthDate(nextY, nextM, safeDayStr));
    } else {
      onChange('');
    }
  };

  const handleYearChange = (nextY: string) => {
    setYear(nextY);
    commitIfComplete(nextY, month, day);
  };

  const handleMonthChange = (nextM: string) => {
    setMonth(nextM);
    commitIfComplete(year, nextM, day);
  };

  const handleDayChange = (nextD: string) => {
    setDay(nextD);
    commitIfComplete(year, month, nextD);
  };

  const resolvedBirthDate =
    year && month && day ? buildBirthDate(year, month, day) : value;
  const manAge = calculateKoreanManAge(resolvedBirthDate);

  const focusRing =
    accent === 'emerald'
      ? 'focus:ring-emerald-400'
      : 'focus:ring-amber-400';

  const selectClass = compact
    ? `w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 ${focusRing} cursor-pointer`
    : `w-full px-2.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 ${focusRing} cursor-pointer`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label
          className={`block font-bold ${
            compact ? 'text-[11px] text-slate-300' : 'text-xs text-slate-300'
          }`}
        >
          {label} {required && <span className="text-amber-400">*</span>}
        </label>

        {manAge !== null ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black">
            <span>🎂</span>
            <span>만 {manAge}세</span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-medium">
            년·월·일 선택 시 만 나이 표시
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="출생년도"
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          className={selectClass}
          required={required}
        >
          <option value="">출생년도</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              {y}년
            </option>
          ))}
        </select>

        <select
          aria-label="출생월"
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className={selectClass}
          required={required}
        >
          <option value="">월</option>
          {monthOptions.map((m) => (
            <option key={m} value={String(m)}>
              {m}월
            </option>
          ))}
        </select>

        <select
          aria-label="출생일"
          value={day}
          onChange={(e) => handleDayChange(e.target.value)}
          className={selectClass}
          required={required}
        >
          <option value="">일</option>
          {dayOptions.map((d) => (
            <option key={d} value={String(d)}>
              {d}일
            </option>
          ))}
        </select>
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-400 leading-snug">{helperText}</p>
      )}
    </div>
  );
}
