/** Решение плотной системы A·x = b методом Гаусса с выбором ведущего элемента. A — n×n построчно. */
export function solveLinear(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const a = A.slice();
  const x = b.slice();
  for (let c = 0; c < n; c++) {
    let piv = c;
    let best = Math.abs(a[c * n + c]);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(a[r * n + c]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-18) continue;
    if (piv !== c) {
      for (let k = 0; k < n; k++) {
        const t = a[c * n + k]; a[c * n + k] = a[piv * n + k]; a[piv * n + k] = t;
      }
      const t = x[c]; x[c] = x[piv]; x[piv] = t;
    }
    const d = a[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r * n + c] / d;
      if (f === 0) continue;
      for (let k = c; k < n; k++) a[r * n + k] -= f * a[c * n + k];
      x[r] -= f * x[c];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r];
    for (let k = r + 1; k < n; k++) s -= a[r * n + k] * x[k];
    const d = a[r * n + r];
    x[r] = Math.abs(d) < 1e-18 ? 0 : s / d;
  }
  return x;
}
