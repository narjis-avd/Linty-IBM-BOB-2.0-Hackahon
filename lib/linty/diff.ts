export type DiffRow =
  | { kind: 'same'; left: string; right: string; leftNo: number; rightNo: number }
  | { kind: 'changed'; left: string | null; right: string | null; leftNo: number | null; rightNo: number | null };

// Line-level LCS diff, paired into side-by-side rows. Inputs are small source files.
export function sideBySideDiff(before: string, after: string): DiffRow[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let removed: number[] = [];
  let added: number[] = [];
  const flush = () => {
    for (let k = 0; k < Math.max(removed.length, added.length); k++) {
      const l = removed[k];
      const r = added[k];
      rows.push({
        kind: 'changed',
        left: l === undefined ? null : a[l],
        right: r === undefined ? null : b[r],
        leftNo: l === undefined ? null : l + 1,
        rightNo: r === undefined ? null : r + 1,
      });
    }
    removed = [];
    added = [];
  };

  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      rows.push({ kind: 'same', left: a[i], right: b[j], leftNo: i + 1, rightNo: j + 1 });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      added.push(j++);
    } else {
      removed.push(i++);
    }
  }
  flush();
  return rows;
}
