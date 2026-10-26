export type Paise = number;

export function inrToPaise(inr: number): Paise {
  return Math.round(inr * 100);
}

export function paiseToInr(paise: Paise): number {
  return paise / 100;
}

export function formatINR(paise: Paise): string {
  const inr = paiseToInr(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(inr);
}

export interface SplitInput {
  participantIds: string[];
  totalAmountPaise: Paise;
  method: 'equal' | 'custom' | 'percentage';
  customAmounts?: Record<string, Paise>;
  percentages?: Record<string, number>;
}

export function calculateSplit(input: SplitInput) {
  const { participantIds, totalAmountPaise, method, customAmounts, percentages } = input;
  if (!participantIds.length || totalAmountPaise <= 0) {
    return { allocations: {}, isValid: false, error: 'Invalid input' };
  }

  const allocations: Record<string, Paise> = {};

  if (method === 'equal') {
    const base = Math.floor(totalAmountPaise / participantIds.length);
    const remainder = totalAmountPaise - base * participantIds.length;
    participantIds.forEach((id, i) => {
      allocations[id] = base + (i < remainder ? 1 : 0);
    });
  } else if (method === 'custom' && customAmounts) {
    participantIds.forEach(id => { allocations[id] = customAmounts[id] || 0; });
  } else if (method === 'percentage' && percentages) {
    let allocated = 0;
    for (let i = 0; i < participantIds.length - 1; i++) {
      const id = participantIds[i];
      const amt = Math.round((totalAmountPaise * (percentages[id] || 0)) / 100);
      allocations[id] = amt;
      allocated += amt;
    }
    allocations[participantIds[participantIds.length - 1]] = totalAmountPaise - allocated;
  }

  return { allocations, isValid: true };
}

export function computeSettlement(sharedFundBalance: Paise, members: any[]) {
  let totalOwedTo = 0;
  let totalOwedBy = 0;
  members.forEach(m => {
    if (m.netPositionPaise > 0) totalOwedTo += m.netPositionPaise;
    else totalOwedBy += Math.abs(m.netPositionPaise);
  });
  return {
    sharedFundBalancePaise: sharedFundBalance,
    members,
    totalOwedToMembersPaise: totalOwedTo,
    totalOwedByMembersPaise: totalOwedBy,
    isReconciled: Math.abs(totalOwedTo - totalOwedBy) < 100,
  };
}