import { describe, it, expect } from 'vitest';
import { letterGrade, classAverage, topStudents, passRate, medianPoints } from './subject';
import type { Score } from './subject';

// ── letterGrade ────────────────────────────────────────────────────────────────

describe('letterGrade', () => {
  it('[E1] returns A for exactly 90 points', () => {
    expect(letterGrade(90)).toBe('A');
  });

  it('returns A for a score above 90', () => {
    expect(letterGrade(95)).toBe('A');
  });

  it('returns B for exactly 80 points', () => {
    expect(letterGrade(80)).toBe('B');
  });

  it('returns B for 89 points', () => {
    expect(letterGrade(89)).toBe('B');
  });

  it('returns C for exactly 70 points', () => {
    expect(letterGrade(70)).toBe('C');
  });

  it('returns D for exactly 60 points', () => {
    expect(letterGrade(60)).toBe('D');
  });

  it('returns F for 59 points', () => {
    expect(letterGrade(59)).toBe('F');
  });

  it('returns F for 0 points', () => {
    expect(letterGrade(0)).toBe('F');
  });
});

// ── classAverage ───────────────────────────────────────────────────────────────

describe('classAverage', () => {
  it('[E2] returns 0 for an empty array', () => {
    expect(classAverage([])).toBe(0);
  });

  it('returns the sole score for a single-element array', () => {
    const scores: Score[] = [{ student: 'Alice', points: 75 }];
    expect(classAverage(scores)).toBe(75);
  });

  it('returns the correct average for multiple scores', () => {
    const scores: Score[] = [
      { student: 'Alice', points: 80 },
      { student: 'Bob', points: 60 },
      { student: 'Carol', points: 100 },
    ];
    expect(classAverage(scores)).toBeCloseTo(80);
  });

  it('returns a fractional average when necessary', () => {
    const scores: Score[] = [
      { student: 'Alice', points: 70 },
      { student: 'Bob', points: 71 },
    ];
    expect(classAverage(scores)).toBeCloseTo(70.5);
  });
});

// ── topStudents ────────────────────────────────────────────────────────────────

describe('topStudents', () => {
  const roster: Score[] = [
    { student: 'Alice', points: 85 },
    { student: 'Bob', points: 92 },
    { student: 'Carol', points: 78 },
    { student: 'Dave', points: 95 },
  ];

  it('[E3] does not mutate the original array', () => {
    const original = [...roster];
    topStudents(roster, 2);
    expect(roster).toEqual(original);
  });

  it('returns the top N students in descending order', () => {
    const top = topStudents(roster, 2);
    expect(top).toHaveLength(2);
    expect(top[0].student).toBe('Dave');
    expect(top[1].student).toBe('Bob');
  });

  it('returns all students when count equals array length', () => {
    const top = topStudents(roster, roster.length);
    expect(top).toHaveLength(roster.length);
    expect(top[0].points).toBe(95);
  });

  it('returns an empty array when called with count 0', () => {
    expect(topStudents(roster, 0)).toEqual([]);
  });
});

// ── passRate ───────────────────────────────────────────────────────────────────

describe('passRate', () => {
  it('[E4] counts a student with exactly 60 points as passing', () => {
    const scores: Score[] = [
      { student: 'Alice', points: 60 },
      { student: 'Bob', points: 59 },
    ];
    expect(passRate(scores)).toBe(50);
  });

  it('returns 0 for an empty array', () => {
    expect(passRate([])).toBe(0);
  });

  it('returns 100 when every student passes', () => {
    const scores: Score[] = [
      { student: 'Alice', points: 100 },
      { student: 'Bob', points: 70 },
    ];
    expect(passRate(scores)).toBe(100);
  });

  it('returns 0 when no student passes', () => {
    const scores: Score[] = [
      { student: 'Alice', points: 55 },
      { student: 'Bob', points: 40 },
    ];
    expect(passRate(scores)).toBe(0);
  });
});

// ── medianPoints ───────────────────────────────────────────────────────────────

describe('medianPoints', () => {
  it('[E5] uses numeric sort so that 9 < 10 (not lexicographic)', () => {
    // Lexicographic sort would rank "9" after "10", giving wrong median
    const scores: Score[] = [
      { student: 'A', points: 9 },
      { student: 'B', points: 10 },
      { student: 'C', points: 100 },
    ];
    // Correct numeric order: [9, 10, 100] → median = 10
    expect(medianPoints(scores)).toBe(10);
  });

  it('[E6] averages the two middle values for an even-length array', () => {
    const scores: Score[] = [
      { student: 'A', points: 60 },
      { student: 'B', points: 80 },
      { student: 'C', points: 70 },
      { student: 'D', points: 90 },
    ];
    // Sorted: [60, 70, 80, 90] → median = (70 + 80) / 2 = 75
    expect(medianPoints(scores)).toBe(75);
  });

  it('returns 0 for an empty array', () => {
    expect(medianPoints([])).toBe(0);
  });

  it('returns the sole value for a single-element array', () => {
    expect(medianPoints([{ student: 'A', points: 55 }])).toBe(55);
  });

  it('returns the middle value for an odd-length array', () => {
    const scores: Score[] = [
      { student: 'A', points: 30 },
      { student: 'B', points: 70 },
      { student: 'C', points: 50 },
    ];
    // Sorted: [30, 50, 70] → median = 50
    expect(medianPoints(scores)).toBe(50);
  });
});
