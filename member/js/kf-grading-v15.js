/* KlinikFisikapku V15 — pure, dependency-free score calculations.
 * No database writes; never mutate historical scores.
 * Each assessment supplies maxPoints and earnedPoints, computed server-side.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KFGradingV15 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = Object.freeze(['pg4','pg5','mcma','kategori','isian','esai']);
  function finiteNumber(n, label) {
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError(label + ' harus angka terbatas');
    return n;
  }
  function scoreQuestion({ earnedPoints, maxPoints, type }) {
    if (!TYPES.includes(type)) throw new Error('Jenis soal tidak dikenal');
    finiteNumber(earnedPoints, 'earnedPoints');
    finiteNumber(maxPoints, 'maxPoints');
    if (maxPoints <= 0 || earnedPoints < 0 || earnedPoints > maxPoints) throw new RangeError('Skor soal tidak valid');
    return { type, earnedPoints, maxPoints };
  }
  function validateWeights(weights, activeTypes) {
    if (!weights || typeof weights !== 'object') throw new TypeError('Bobot diperlukan');
    const types = [...new Set(activeTypes)];
    if (!types.length || types.some(t => !TYPES.includes(t))) throw new Error('Jenis aktif tidak valid');
    for (const key of Object.keys(weights)) {
      if (!TYPES.includes(key)) throw new Error('Bobot untuk jenis tidak dikenal');
      finiteNumber(weights[key], 'Bobot ' + key);
      if (weights[key] < 0 || weights[key] > 100) throw new RangeError('Bobot harus 0–100');
    }
    const sum = types.reduce((s,t) => s + (weights[t] || 0), 0);
    if (Math.abs(sum - 100) > 1e-7) throw new Error('Jumlah bobot jenis aktif harus 100%');
    return true;
  }
  function calculateFinal({ questions, weights, publish = false }) {
    if (!Array.isArray(questions) || !questions.length) throw new Error('Belum ada soal');
    const graded = questions.filter(q => q && q.earnedPoints !== null && q.earnedPoints !== undefined)
      .map(scoreQuestion);
    const activeTypes = [...new Set(questions.map(q => q.type))];
    if (activeTypes.some(t => !TYPES.includes(t))) throw new Error('Jenis soal tidak dikenal');
    validateWeights(weights, activeTypes);
    const pending = questions.length - graded.length;
    const components = activeTypes.map(type => {
      const subset = graded.filter(q => q.type === type);
      const expected = questions.filter(q => q.type === type).length;
      const earned = subset.reduce((s,q) => s + q.earnedPoints, 0);
      const maximum = subset.reduce((s,q) => s + q.maxPoints, 0);
      const percentage = maximum > 0 ? 100 * earned / maximum : null;
      return { type, graded: subset.length, expected, percentage, weight: weights[type] || 0,
        contribution: percentage === null ? null : percentage * (weights[type] || 0) / 100 };
    });
    const ready = pending === 0 && components.every(c => c.percentage !== null);
    if (publish && !ready) throw new Error('Nilai belum lengkap, tidak boleh diterbitkan');
    const finalScore = ready ? Math.round((components.reduce((s,c) => s + c.contribution, 0) + Number.EPSILON) * 100) / 100 : null;
    return { ready, pending, finalScore, components };
  }
  function certificateEligible({ published, completed, finalScore, passingScore = 75 }) {
    finiteNumber(passingScore, 'passingScore');
    if (passingScore < 0 || passingScore > 100) throw new RangeError('Ambang kelulusan tidak valid');
    return published === true && completed === true && typeof finalScore === 'number' &&
      Number.isFinite(finalScore) && finalScore >= passingScore && finalScore <= 100;
  }
  return Object.freeze({ TYPES, scoreQuestion, validateWeights, calculateFinal, certificateEligible });
});
