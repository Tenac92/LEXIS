export type RecipientPayload = {
  id?: unknown;
  firstname?: string;
  lastname?: string;
  afm?: string;
  [key: string]: unknown;
};

type PlannedUpdate = RecipientPayload & { id: number };

export type BeneficiaryRecipientSyncPlan =
  | {
      ok: true;
      toUpdate: PlannedUpdate[];
      toCreate: RecipientPayload[];
      toDeleteIds: number[];
    }
  | {
      ok: false;
      status: 400;
      message: string;
      details?: Record<string, unknown>;
    };

const parsePaymentId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  const parsed = parseInt(String(value ?? ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
};

const hasRequiredCreateFields = (recipient: RecipientPayload): boolean => {
  return Boolean(recipient.firstname && recipient.lastname && recipient.afm);
};

export function buildBeneficiaryRecipientSyncPlan(
  recipients: RecipientPayload[],
  existingPaymentIds: number[],
): BeneficiaryRecipientSyncPlan {
  const existingPaymentIdSet = new Set(existingPaymentIds);
  const submittedUpdateIds = new Set<number>();
  const toUpdate: PlannedUpdate[] = [];
  const toCreate: RecipientPayload[] = [];

  for (let index = 0; index < recipients.length; index++) {
    const recipient = recipients[index];
    const parsedPaymentId = parsePaymentId(recipient?.id);

    if (parsedPaymentId !== null) {
      if (!existingPaymentIdSet.has(parsedPaymentId)) {
        return {
          ok: false,
          status: 400,
          message: 'Invalid recipient payment ID for this document',
          details: { index, paymentId: parsedPaymentId },
        };
      }

      submittedUpdateIds.add(parsedPaymentId);
      toUpdate.push({ ...recipient, id: parsedPaymentId });
      continue;
    }

    if (hasRequiredCreateFields(recipient)) {
      toCreate.push(recipient);
      continue;
    }

    return {
      ok: false,
      status: 400,
      message: 'Recipient is missing required fields',
      details: { index, required: ['firstname', 'lastname', 'afm'] },
    };
  }

  const toDeleteIds = existingPaymentIds.filter((id) => !submittedUpdateIds.has(id));

  return {
    ok: true,
    toUpdate,
    toCreate,
    toDeleteIds,
  };
}

