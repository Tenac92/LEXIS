import assert from 'assert';
import { buildBeneficiaryRecipientSyncPlan } from '../utils/beneficiary-recipient-sync';

const existingIds = [101, 102, 103];

const removeOnePlan = buildBeneficiaryRecipientSyncPlan(
  [
    { id: 101, firstname: 'A', lastname: 'A', afm: '111111111' },
    { id: '103', firstname: 'C', lastname: 'C', afm: '333333333' },
  ],
  existingIds,
);

assert.strictEqual(removeOnePlan.ok, true, 'Valid recipient updates should produce a sync plan');
if (removeOnePlan.ok) {
  assert.deepStrictEqual(
    removeOnePlan.toUpdate.map((entry) => entry.id),
    [101, 103],
    'Plan should keep submitted existing payment ids',
  );
  assert.deepStrictEqual(removeOnePlan.toDeleteIds, [102], 'Plan should delete omitted existing payments');
}

const addOnePlan = buildBeneficiaryRecipientSyncPlan(
  [
    { id: 101, firstname: 'A', lastname: 'A', afm: '111111111' },
    { firstname: 'N', lastname: 'N', afm: '999999999', amount: 50 },
  ],
  [101],
);

assert.strictEqual(addOnePlan.ok, true, 'Mixed update/create payload should be valid');
if (addOnePlan.ok) {
  assert.strictEqual(addOnePlan.toCreate.length, 1, 'New recipient should be routed to create list');
  assert.deepStrictEqual(addOnePlan.toDeleteIds, [], 'Nothing should be deleted when all existing ids are present');
}

const invalidIdPlan = buildBeneficiaryRecipientSyncPlan(
  [{ id: 999, firstname: 'X', lastname: 'Y', afm: '111111111' }],
  existingIds,
);

assert.strictEqual(invalidIdPlan.ok, false, 'Unknown existing payment id should be rejected');
if (!invalidIdPlan.ok) {
  assert.strictEqual(invalidIdPlan.status, 400);
  assert.strictEqual(invalidIdPlan.message, 'Invalid recipient payment ID for this document');
}

const invalidCreatePlan = buildBeneficiaryRecipientSyncPlan(
  [{ firstname: 'Missing', lastname: 'Afm' }],
  existingIds,
);

assert.strictEqual(invalidCreatePlan.ok, false, 'New recipients without AFM should be rejected');
if (!invalidCreatePlan.ok) {
  assert.strictEqual(invalidCreatePlan.status, 400);
  assert.strictEqual(invalidCreatePlan.message, 'Recipient is missing required fields');
}

console.log('beneficiary-recipient-sync.test.ts passed');

