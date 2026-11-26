/**
 * 출생년월일(YYYY-MM-DD) 파싱 및 대한민국 표준 만 나이 계산 유틸리티
 * - 실력 균등 자동 배정(종합 실력 지수) 및 동점 시 만 나이 합산 순위에 공통 적용
 */

export interface BirthDateParts {
  year: string;
  month: string;
  day: string;
}

export function getDaysInMonth(year: number, month: number): number {
  if (!year || !month || month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

export function parseBirthDate(birthDate?: string | null): BirthDateParts {
  if (!birthDate || typeof birthDate !== 'string') {
    return { year: '', month: '', day: '' };
  }
  const match = birthDate.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return { year: '', month: '', day: '' };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > getDaysInMonth(y, m)) {
    return { year: '', month: '', day: '' };
  }
  return {
    year: String(y),
    month: String(m),
    day: String(d),
  };
}

export function buildBirthDate(
  year: string | number,
  month: string | number,
  day: string | number
): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return '';
  if (y < 1900 || y > new Date().getFullYear()) return '';
  if (m < 1 || m > 12) return '';
  const maxDay = getDaysInMonth(y, m);
  const safeDay = Math.min(Math.max(1, d), maxDay);
  const mm = String(m).padStart(2, '0');
  const dd = String(safeDay).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * 출생년월일(YYYY-MM-DD) 기준 만 나이 계산
 * - 생일이 지났으면 (기준년도 - 출생년도), 지나지 않았으면 -1
 */
export function calculateKoreanManAge(
  birthDate?: string | null,
  referenceDate?: Date
): number | null {
  const parts = parseBirthDate(birthDate);
  if (!parts.year || !parts.month || !parts.day) return null;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  const today = referenceDate ?? new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age -= 1;
  }

  if (age < 0 || age > 120) return null;
  return age;
}

export function formatBirthDateDisplay(birthDate?: string | null): string {
  const parts = parseBirthDate(birthDate);
  if (!parts.year || !parts.month || !parts.day) return '';
  return `${parts.year}.${parts.month.padStart(2, '0')}.${parts.day.padStart(2, '0')}`;
}

export function formatManAgeLabel(
  birthDate?: string | null,
  fallbackAge?: number
): string {
  const manAge = calculateKoreanManAge(birthDate);
  if (manAge !== null) return `만 ${manAge}세`;
  if (typeof fallbackAge === 'number' && !isNaN(fallbackAge) && fallbackAge > 0) {
    return `만 ${Math.round(fallbackAge)}세`;
  }
  return '';
}

export function getBirthYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 7; // 최소 만 7세 이상 선택
  const minYear = 1930;
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }
  return years;
}
