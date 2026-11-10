/**
 * Settlement Calculation Engine
 *
 * Financial arithmetic uses string-based decimal operations to avoid IEEE 754
 * floating-point rounding errors.  All monetary values stored as Decimal128.
 */
import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error';
import { SLABreachModel, SLAContractModel, SLACreditRule } from '../sla/sla.model';
import { CalculateSettlementInput, ListSettlementsQueryInput } from './settlement.validation';
import {
  CalculationBreakdownItem,
  SettlementDocument,
  SettlementModel,
} from './settlement.model';

// =========================================================== decimal helpers

/**
 * Parse a Decimal128 or number-like value into a numeric string with 10dp precision.
 * We only use parseFloat for comparison; storage always uses string-round.
 */
function toStr(v: Types.Decimal128 | string | number): string {
  if (v instanceof Types.Decimal128) return v.toString();
  return String(v);
}

function decimalAdd(a: string, b: string): string {
  const factor = 1e10;
  const result = Math.round(parseFloat(a) * factor + parseFloat(b) * factor) / factor;
  return result.toFixed(2);
}

function decimalMultiply(a: string, b: string): string {
  const result = parseFloat(a) * parseFloat(b);
  return result.toFixed(2);
}

function decimalSubtract(a: string, b: string): string {
  const factor = 1e10;
  const result = Math.round(parseFloat(a) * factor - parseFloat(b) * factor) / factor;
  return result.toFixed(2);
}

function decimalMin(a: string, b: string): string {
  return parseFloat(a) <= parseFloat(b) ? a : b;
}

function decimalMax(a: string, b: string): string {
  return parseFloat(a) >= parseFloat(b) ? a : b;
}

// ============================================================= credit engine

/**
 * Evaluate whether a credit rule's condition is satisfied by an observed breach.
 * Returns true when:
 *   - rule.applicableMetric matches breach.metric  AND
 *   - breach.observedValue <op> rule.threshold  is TRUE
 */
function evaluateCreditRuleCondition(
  rule: SLACreditRule,
  breach: { metric: string; observedValue: number }
): boolean {
  if (rule.applicableMetric !== breach.metric) return false;

  const obs = breach.observedValue;
  const thr = rule.threshold;

  switch (rule.operator) {
    case '<':
      return obs < thr;
    case '<=':
      return obs <= thr;
    case '>':
      return obs > thr;
    case '>=':
      return obs >= thr;
    case '==':
      return obs === thr;
    default:
      return false;
  }
}

/**
 * Calculate credit amount for a single rule application.
 *
 * FIXED  → creditValue (regardless of authorizedAmount)
 * PERCENTAGE → (creditValue / 100) × authorizedAmount
 *
 * Result is then capped at maxCreditLimit when defined.
 */
function calculateCreditAmount(rule: SLACreditRule, authorizedAmountStr: string): string {
  const creditValueStr = toStr(rule.creditValue);

  let raw: string;
  if (rule.creditType === 'FIXED') {
    raw = parseFloat(creditValueStr).toFixed(2);
  } else {
    // PERCENTAGE
    const pct = decimalMultiply(creditValueStr, '0.01');
    raw = decimalMultiply(pct, authorizedAmountStr);
  }

  if (rule.maxCreditLimit) {
    const limit = toStr(rule.maxCreditLimit);
    raw = decimalMin(raw, limit);
  }

  return raw;
}

// ============================================================= main service

interface CalculateInput extends CalculateSettlementInput {
  authorizedAmount: string | number;
}

export const settlementCalculationService = {
  // ------------------------------------------------------------ calculate

  async calculate(input: CalculateInput): Promise<SettlementDocument> {
    const {
      paymentId,
      serviceId,
      contractId,
      breachIds,
      currency,
    } = input;

    const authorizedAmountStr = parseFloat(String(input.authorizedAmount)).toFixed(2);

    // --- idempotency: reject duplicate paymentId
    const existing = await SettlementModel.findOne({ paymentId }).lean();
    if (existing) {
      throw new AppError(
        409,
        'SETTLEMENT_ALREADY_EXISTS',
        `A settlement for payment '${paymentId}' already exists`,
        { settlementId: String(existing._id), status: existing.status }
      );
    }

    // --- fetch contract
    const contract = await SLAContractModel.findById(contractId).lean();
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `SLA contract '${contractId}' not found`);
    }

    // --- fetch breaches (deduplicate IDs)
    const uniqueBreachIds = [...new Set((breachIds ?? []).map(String))];
    const breachObjectIds = uniqueBreachIds.map((id) => new Types.ObjectId(id));

    const breaches =
      breachObjectIds.length > 0
        ? await SLABreachModel.find({ _id: { $in: breachObjectIds } }).lean()
        : [];

    const creditRules: SLACreditRule[] = contract.creditRules ?? [];

    // --- determine if RequiresReview
    let requiresReviewReason: string | undefined;
    if (breaches.length > 0 && creditRules.length === 0) {
      requiresReviewReason =
        'Breaches detected but the contract has no credit rules defined — manual review required';
    }

    // --- build breakdown: match each rule against each breach (sorted by priority)
    const sortedRules = [...creditRules].sort((a, b) => a.priority - b.priority);

    const breakdown: CalculationBreakdownItem[] = [];
    // Track (ruleId, breachId) pairs to prevent double-counting
    const applied = new Set<string>();

    for (const rule of sortedRules) {
      for (const breach of breaches) {
        const breachIdStr = String(breach._id);
        const pairKey = `${rule.ruleId}::${breachIdStr}`;

        if (applied.has(pairKey)) continue;

        const conditionMet = evaluateCreditRuleCondition(rule, {
          metric: breach.metric,
          observedValue: breach.observedValue,
        });

        const creditAmountStr = conditionMet
          ? calculateCreditAmount(rule, authorizedAmountStr)
          : '0.00';

        breakdown.push({
          ruleId: rule.ruleId,
          ruleDescription: rule.description,
          breachId: breachIdStr,
          metric: breach.metric,
          contractualThreshold: rule.threshold,
          observedValue: breach.observedValue,
          creditType: rule.creditType,
          creditValue: Types.Decimal128.fromString(toStr(rule.creditValue)),
          creditAmountCalculated: Types.Decimal128.fromString(creditAmountStr),
          applied: conditionMet,
          reason: conditionMet
            ? `Rule ${rule.ruleId} matched: ${breach.metric} ${breach.observedValue} satisfies ${rule.operator} ${rule.threshold}`
            : `Rule ${rule.ruleId} not matched: ${breach.metric} ${breach.observedValue} does not satisfy ${rule.operator} ${rule.threshold}`,
        });

        if (conditionMet) applied.add(pairKey);
      }
    }

    // --- sum total credit (applied items only)
    let totalCreditStr = '0.00';
    for (const item of breakdown) {
      if (item.applied) {
        totalCreditStr = decimalAdd(totalCreditStr, item.creditAmountCalculated.toString());
      }
    }

    // cap total credit at authorized amount
    totalCreditStr = decimalMin(totalCreditStr, authorizedAmountStr);

    const finalPayableStr = decimalMax(
      '0.00',
      decimalSubtract(authorizedAmountStr, totalCreditStr)
    );

    const status = requiresReviewReason ? 'RequiresReview' : 'Calculated';

    const doc = await SettlementModel.create({
      paymentId,
      serviceId: new Types.ObjectId(serviceId),
      contractId: new Types.ObjectId(contractId),
      breachIds: breachObjectIds,
      authorizedAmount: Types.Decimal128.fromString(authorizedAmountStr),
      totalCredit: Types.Decimal128.fromString(totalCreditStr),
      finalPayableAmount: Types.Decimal128.fromString(finalPayableStr),
      currency: currency?.toUpperCase() ?? 'USD',
      calculationBreakdown: breakdown,
      calculationVersion: '1.0.0',
      contractVersion: contract.version,
      status,
      requiresReviewReason,
      calculatedAt: new Date(),
    });

    return doc;
  },

  // --------------------------------------------------------- recalculate

  async recalculate(settlementId: string): Promise<SettlementDocument> {
    const existing = await SettlementModel.findById(settlementId).lean();
    if (!existing) {
      throw new AppError(404, 'SETTLEMENT_NOT_FOUND', `Settlement '${settlementId}' not found`);
    }

    // delete the old one so calculate() can run again (bypasses idempotency guard)
    await SettlementModel.deleteOne({ _id: existing._id });

    const result = await this.calculate({
      paymentId: existing.paymentId,
      serviceId: String(existing.serviceId),
      contractId: String(existing.contractId),
      breachIds: existing.breachIds.map(String),
      authorizedAmount: existing.authorizedAmount.toString(),
      currency: existing.currency,
    });

    return result;
  },

  // --------------------------------------------------------------- reads

  async getById(id: string): Promise<SettlementDocument> {
    const doc = await SettlementModel.findById(id).lean();
    if (!doc) {
      throw new AppError(404, 'SETTLEMENT_NOT_FOUND', `Settlement '${id}' not found`);
    }
    return doc as unknown as SettlementDocument;
  },

  async getByPaymentId(paymentId: string): Promise<SettlementDocument> {
    const doc = await SettlementModel.findOne({ paymentId }).lean();
    if (!doc) {
      throw new AppError(
        404,
        'SETTLEMENT_NOT_FOUND',
        `Settlement for payment '${paymentId}' not found`
      );
    }
    return doc as unknown as SettlementDocument;
  },

  async getByServiceId(serviceId: string): Promise<SettlementDocument[]> {
    const docs = await SettlementModel.find({
      serviceId: new Types.ObjectId(serviceId),
    })
      .sort({ calculatedAt: -1 })
      .lean();
    return docs as unknown as SettlementDocument[];
  },

  async list(query: ListSettlementsQueryInput): Promise<{
    data: SettlementDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, status, serviceId, contractId, currency, from, to, sortBy, sortOrder } =
      query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (status) filter['status'] = status;
    if (serviceId) filter['serviceId'] = new Types.ObjectId(serviceId);
    if (contractId) filter['contractId'] = new Types.ObjectId(contractId);
    if (currency) filter['currency'] = currency.toUpperCase();
    if (from || to) {
      filter['calculatedAt'] = {};
      if (from) filter['calculatedAt']['$gte'] = from;
      if (to) filter['calculatedAt']['$lte'] = to;
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      SettlementModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      SettlementModel.countDocuments(filter),
    ]);

    return {
      data: docs as unknown as SettlementDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getBreakdown(
    id: string
  ): Promise<{ settlement: SettlementDocument; breakdown: CalculationBreakdownItem[] }> {
    const doc = await SettlementModel.findById(id).lean();
    if (!doc) {
      throw new AppError(404, 'SETTLEMENT_NOT_FOUND', `Settlement '${id}' not found`);
    }
    return {
      settlement: doc as unknown as SettlementDocument,
      breakdown: (doc.calculationBreakdown ?? []) as CalculationBreakdownItem[],
    };
  },
};
