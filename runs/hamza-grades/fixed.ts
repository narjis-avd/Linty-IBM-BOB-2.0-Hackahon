// Linty demo sample: student grade helpers with seeded bugs. Added by Hamza.
// Ground truth lives in hamza-grades.expected.json. Do not fix by hand.

export interface Score {
  student: string;
  points: number; // 0 to 100
}

// 90 and above is an A, 80 and above a B, and so on. Below 60 fails.
export function letterGrade(points: number): string {
  if (points >= 90) return 'A';
  if (points >= 80) return 'B';
  if (points >= 70) return 'C';
  if (points >= 60) return 'D';
  return 'F';
}

export function classAverage(scores: Score[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + s.points, 0);
  return total / scores.length;
}

// The `count` highest-scoring students, best first.
export function topStudents(scores: Score[], count: number): Score[] {
  const ranked = [...scores].sort((a, b) => b.points - a.points);
  return ranked.slice(0, count);
}

// Percentage of students who passed (60 or more).
export function passRate(scores: Score[]): number {
  if (scores.length === 0) return 0;
  const passed = scores.filter((s) => s.points >= 60).length;
  return (passed / scores.length) * 100;
}

export function medianPoints(scores: Score[]): number {
  if (scores.length === 0) return 0;
  const sorted = scores.map((s) => s.points).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
