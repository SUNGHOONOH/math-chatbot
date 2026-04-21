export const GRADE_LEVEL_OPTIONS = [
  { value: 'elementary_1', label: '초등학교 1학년' },
  { value: 'elementary_2', label: '초등학교 2학년' },
  { value: 'elementary_3', label: '초등학교 3학년' },
  { value: 'elementary_4', label: '초등학교 4학년' },
  { value: 'elementary_5', label: '초등학교 5학년' },
  { value: 'elementary_6', label: '초등학교 6학년' },
  { value: 'middle_1', label: '중학교 1학년' },
  { value: 'middle_2', label: '중학교 2학년' },
  { value: 'middle_3', label: '중학교 3학년' },
  { value: 'high_1', label: '고등학교 1학년' },
  { value: 'high_2', label: '고등학교 2학년' },
  { value: 'high_3', label: '고등학교 3학년' },
  { value: 'college', label: '대학생' },
  { value: 'other', label: '그 외' },
] as const;

export type GradeLevel = (typeof GRADE_LEVEL_OPTIONS)[number]['value'];

export const GRADE_LEVEL_VALUES = GRADE_LEVEL_OPTIONS.map((option) => option.value) as GradeLevel[];

export function getGradeLabel(gradeLevel: string | null | undefined) {
  return GRADE_LEVEL_OPTIONS.find((option) => option.value === gradeLevel)?.label ?? '미설정';
}
