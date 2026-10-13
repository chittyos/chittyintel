import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyAtomicFactWritesEnabled } from '../src/api/routes/analyze.js';

test('legacy atomic fact writes fail closed by default', () => {
  assert.equal(legacyAtomicFactWritesEnabled(undefined), false);
  assert.equal(legacyAtomicFactWritesEnabled({}), false);
  assert.equal(legacyAtomicFactWritesEnabled({ LEGACY_ATOMIC_FACT_WRITES_ENABLED: 'false' }), false);
});

test('legacy atomic fact writes require explicit true string', () => {
  assert.equal(legacyAtomicFactWritesEnabled({ LEGACY_ATOMIC_FACT_WRITES_ENABLED: 'true' }), true);
  assert.equal(legacyAtomicFactWritesEnabled({ LEGACY_ATOMIC_FACT_WRITES_ENABLED: true }), false);
  assert.equal(legacyAtomicFactWritesEnabled({ LEGACY_ATOMIC_FACT_WRITES_ENABLED: 'TRUE' }), false);
});
