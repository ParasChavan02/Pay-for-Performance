import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error';
import { auditService } from '../audit/audit.service';
import { ServiceModel } from '../services/service.model';
import { PaymentAuthorizationAdapter } from '../settlement/payment-authorization.adapter';
import { SettlementModel } from '../settlement/settlement.model';
import { SLABreachModel, SLAContractModel } from '../sla/sla.model';
import { ApprovalModel } from '../approvals/approval.model';
import {
  ConditionGroup,
  ConditionOperator,
  PolicyAction,
  PolicyDecisionDocument,
  PolicyDecisionModel,
  PolicyDocument,
  PolicyEvaluationResult,
  PolicyModel,
} from './policy.model';
import {
  CreatePolicyInput,
  ListDecisionsQueryInput,
  ListPoliciesQueryInput,
  UpdatePolicyInput,
} from './policy.validation';

// ----------------------------------------------------------------- Condition Evaluator

export function compareValues(
  actual: unknown,
  operator: ConditionOperator,
  expected: unknown
): boolean {
  switch (operator) {
    case 'EQUALS':
      return String(actual).toLowerCase() === String(expected).toLowerCase();
    case 'NOT_EQUALS':
      return String(actual).toLowerCase() !== String(expected).toLowerCase();
    case 'GREATER_THAN':
      return Number(actual) > Number(expected);
    case 'GREATER_THAN_OR_EQUAL':
      return Number(actual) >= Number(expected);
    case 'LESS_THAN':
      return Number(actual) < Number(expected);
    case 'LESS_THAN_OR_EQUAL':
      return Number(actual) <= Number(expected);
    case 'IN': {
      if (Array.isArray(expected)) {
        if (Array.isArray(actual)) {
          return actual.some((a) =>
            expected.map((e) => String(e).toLowerCase()).includes(String(a).toLowerCase())
          );
        }
        return expected.map((e) => String(e).toLowerCase()).includes(String(actual).toLowerCase());
      }
      if (typeof expected === 'string') {
        const list = expected.split(',').map((s) => s.trim().toLowerCase());
        return list.includes(String(actual).toLowerCase());
      }
      return false;
    }
    case 'NOT_IN': {
      if (Array.isArray(expected)) {
        if (Array.isArray(actual)) {
          return !actual.some((a) =>
            expected.map((e) => String(e).toLowerCase()).includes(String(a).toLowerCase())
          );
        }
        return !expected.map((e) => String(e).toLowerCase()).includes(String(actual).toLowerCase());
      }
      if (typeof expected === 'string') {
        const list = expected.split(',').map((s) => s.trim().toLowerCase());
        return !list.includes(String(actual).toLowerCase());
      }
      return true;
    }
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  context: Record<string, unknown>
): { matched: boolean; actualValues: Record<string, unknown> } {
  const actualValues: Record<string, unknown> = {};
  const isAnd = group.logicalOperator !== 'OR';
  let matched = isAnd;

  if (!group.rules || group.rules.length === 0) {
    return { matched: true, actualValues };
  }

  for (const rule of group.rules) {
    const actual = context[rule.field];
    actualValues[rule.field] = actual;
    const ruleMatched = compareValues(actual, rule.operator, rule.value);

    if (isAnd) {
      if (!ruleMatched) {
        matched = false;
        break;
      }
    } else {
      if (ruleMatched) {
        matched = true;
        break;
      }
    }
  }

  return { matched, actualValues };
}

// ----------------------------------------------------------------- Policy Service

export const policyService = {
  // 1. Create Policy
  async createPolicy(input: CreatePolicyInput): Promise<PolicyDocument> {
    const existing = await PolicyModel.findOne({ policyCode: input.policyCode }).lean();
    if (existing) {
      throw new AppError(
        409,
        'POLICY_CODE_EXISTS',
        `A policy with code '${input.policyCode}' already exists`
      );
    }

    if (input.scope === 'Service' && input.serviceId) {
      const service = await ServiceModel.findById(input.serviceId).lean();
      if (!service) {
        throw new AppError(
          404,
          'SERVICE_NOT_FOUND',
          `Service '${input.serviceId}' referenced in policy was not found`
        );
      }
    }

    const policy = await PolicyModel.create({
      ...input,
      serviceId: input.serviceId ? new Types.ObjectId(input.serviceId) : undefined,
      version: 1,
      versionHistory: [],
    });

    await auditService.append({
      action: 'POLICY_CREATED',
      entityType: 'Policy',
      entityId: String(policy._id),
      description: `Policy '${policy.name}' (${policy.policyCode}) created with action ${policy.action}`,
      metadata: { policyCode: policy.policyCode, action: policy.action, priority: policy.priority },
    });

    return policy;
  },

  // 2. List Policies
  async listPolicies(query: ListPoliciesQueryInput): Promise<{
    data: PolicyDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, category, enabled, scope, serviceId, action } = query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (category) filter['category'] = category;
    if (enabled !== undefined) filter['enabled'] = enabled;
    if (scope) filter['scope'] = scope;
    if (serviceId) filter['serviceId'] = new Types.ObjectId(serviceId);
    if (action) filter['action'] = action;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      PolicyModel.find(filter).sort({ priority: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      PolicyModel.countDocuments(filter),
    ]);

    return {
      data: docs as unknown as PolicyDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  // 3. Get Policy by ID
  async getPolicyById(id: string): Promise<PolicyDocument> {
    const policy = await PolicyModel.findById(id).lean();
    if (!policy) {
      throw new AppError(404, 'POLICY_NOT_FOUND', `Policy '${id}' not found`);
    }
    return policy as unknown as PolicyDocument;
  },

  // 4. Update Policy (Preserving Version History)
  async updatePolicy(id: string, input: UpdatePolicyInput): Promise<PolicyDocument> {
    const policy = await PolicyModel.findById(id);
    if (!policy) {
      throw new AppError(404, 'POLICY_NOT_FOUND', `Policy '${id}' not found`);
    }

    if (input.scope === 'Service' && input.serviceId) {
      const service = await ServiceModel.findById(input.serviceId).lean();
      if (!service) {
        throw new AppError(
          404,
          'SERVICE_NOT_FOUND',
          `Service '${input.serviceId}' referenced in policy was not found`
        );
      }
    }

    // Archive previous version to versionHistory
    policy.versionHistory.push({
      version: policy.version,
      name: policy.name,
      description: policy.description,
      policyCode: policy.policyCode,
      category: policy.category,
      priority: policy.priority,
      enabled: policy.enabled,
      scope: policy.scope,
      serviceId: policy.serviceId,
      conditions: policy.conditions,
      action: policy.action,
      reason: policy.reason,
      effectiveFrom: policy.effectiveFrom,
      effectiveUntil: policy.effectiveUntil,
      archivedAt: new Date(),
    });

    // Apply updates and increment version
    if (input.name !== undefined) policy.name = input.name;
    if (input.description !== undefined) policy.description = input.description;
    if (input.category !== undefined) policy.category = input.category;
    if (input.priority !== undefined) policy.priority = input.priority;
    if (input.enabled !== undefined) policy.enabled = input.enabled;
    if (input.scope !== undefined) policy.scope = input.scope;
    if (input.serviceId !== undefined) {
      policy.serviceId = new Types.ObjectId(input.serviceId);
    }
    if (input.conditions !== undefined) policy.conditions = input.conditions as unknown as ConditionGroup;
    if (input.action !== undefined) policy.action = input.action;
    if (input.reason !== undefined) policy.reason = input.reason;
    if (input.effectiveFrom !== undefined) policy.effectiveFrom = input.effectiveFrom;
    if (input.effectiveUntil !== undefined) policy.effectiveUntil = input.effectiveUntil;

    policy.version += 1;
    await policy.save();

    await auditService.append({
      action: 'POLICY_UPDATED',
      entityType: 'Policy',
      entityId: String(policy._id),
      description: `Policy '${policy.name}' updated to version ${policy.version}`,
      metadata: { newVersion: policy.version, changes: Object.keys(input) },
    });

    return policy;
  },

  // 5. Update Policy Status (Enable / Disable)
  async updatePolicyStatus(id: string, enabled: boolean): Promise<PolicyDocument> {
    const policy = await PolicyModel.findById(id);
    if (!policy) {
      throw new AppError(404, 'POLICY_NOT_FOUND', `Policy '${id}' not found`);
    }

    const previousStatus = policy.enabled;
    policy.enabled = enabled;
    await policy.save();

    await auditService.append({
      action: 'POLICY_STATUS_CHANGED',
      entityType: 'Policy',
      entityId: String(policy._id),
      description: `Policy '${policy.name}' (${policy.policyCode}) ${enabled ? 'enabled' : 'disabled'}`,
      before: { enabled: previousStatus },
      after: { enabled },
    });

    return policy;
  },

  // 6. Get Policies for a Service (Service-specific + Global)
  async getPoliciesForService(serviceId: string): Promise<PolicyDocument[]> {
    const serviceObjectId = new Types.ObjectId(serviceId);
    const policies = await PolicyModel.find({
      $or: [{ scope: 'Global' }, { scope: 'Service', serviceId: serviceObjectId }],
    })
      .sort({ priority: 1, createdAt: -1 })
      .lean();

    return policies as unknown as PolicyDocument[];
  },

  // 7. Evaluate Settlement against Policies
  async evaluateSettlement(settlementId: string): Promise<{
    decision: PolicyDecisionDocument;
    approval?: unknown;
  }> {
    // A. Retrieve settlement from MongoDB
    const settlement = await SettlementModel.findById(settlementId).lean();
    if (!settlement) {
      throw new AppError(404, 'SETTLEMENT_NOT_FOUND', `Settlement '${settlementId}' not found`);
    }

    // B. Verify calculation is complete
    if (settlement.status === 'Draft') {
      throw new AppError(
        400,
        'SETTLEMENT_NOT_CALCULATED',
        'Settlement calculation is incomplete (status is Draft). Only calculated settlements can be evaluated.'
      );
    }

    // C. Retrieve payment authorization information
    const paymentAuth = await PaymentAuthorizationAdapter.lookup(settlement.paymentId);

    // D. Retrieve service and contract
    const [service, contract] = await Promise.all([
      ServiceModel.findById(settlement.serviceId).lean(),
      SLAContractModel.findById(settlement.contractId).lean(),
    ]);

    // E. Retrieve breaches
    const breachObjectIds = (settlement.breachIds ?? []).map((id) => new Types.ObjectId(id));
    const breaches =
      breachObjectIds.length > 0
        ? await SLABreachModel.find({ _id: { $in: breachObjectIds } }).lean()
        : [];

    // F. Construct authoritative context values
    const authorizedAmountNum = parseFloat(settlement.authorizedAmount.toString());
    const finalPayableNum = parseFloat(settlement.finalPayableAmount.toString());
    const totalCreditNum = parseFloat(settlement.totalCredit.toString());
    const creditPercentage =
      authorizedAmountNum > 0 ? (totalCreditNum / authorizedAmountNum) * 100 : 0;

    const breachSeverities = breaches.map((b) => b.severity);
    const context: Record<string, unknown> = {
      authorizedAmount: authorizedAmountNum,
      finalPayableAmount: finalPayableNum,
      totalCredit: totalCreditNum,
      creditPercentage,
      settlementStatus: settlement.status,
      breachCount: breaches.length,
      breachSeverity: breachSeverities,
      paymentStatus: paymentAuth?.paymentStatus ?? 'UNKNOWN',
      contractStatus: contract?.status ?? 'UNKNOWN',
      serviceEnvironment: service?.environment ?? 'Production',
      currency: settlement.currency,
    };

    // G. Load enabled and currently effective policies (Global + Service-specific)
    const now = new Date();
    const serviceObjectId = new Types.ObjectId(settlement.serviceId);

    const candidatePolicies = await PolicyModel.find({
      enabled: true,
      $or: [{ scope: 'Global' }, { scope: 'Service', serviceId: serviceObjectId }],
      $and: [
        { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: null }, { effectiveFrom: { $lte: now } }] },
        { $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: null }, { effectiveUntil: { $gte: now } }] },
      ],
    })
      .sort({ priority: 1, createdAt: 1 })
      .lean();

    // H. Evaluate policies deterministically
    const policyResults: PolicyEvaluationResult[] = [];
    const policySnapshots: unknown[] = [];
    const matchedPolicies: Array<{
      policy: (typeof candidatePolicies)[number];
      result: PolicyEvaluationResult;
    }> = [];

    for (const policy of candidatePolicies) {
      policySnapshots.push({
        policyId: policy._id,
        policyCode: policy.policyCode,
        name: policy.name,
        version: policy.version,
        action: policy.action,
        priority: policy.priority,
        conditions: policy.conditions,
      });

      const { matched, actualValues } = evaluateConditionGroup(policy.conditions, context);

      const result: PolicyEvaluationResult = {
        policyId: policy._id as Types.ObjectId,
        policyCode: policy.policyCode,
        policyName: policy.name,
        policyVersion: policy.version,
        action: policy.action,
        priority: policy.priority,
        conditions: policy.conditions,
        actualValues,
        matched,
        reason: matched
          ? `Policy '${policy.name}' (${policy.policyCode}) matched conditions: ${policy.reason}`
          : `Policy '${policy.name}' (${policy.policyCode}) conditions did not match`,
      };

      policyResults.push(result);
      if (matched) {
        matchedPolicies.push({ policy, result });
      }
    }

    // I. Apply Decision Precedence
    // 1. BLOCK takes precedence over every other action.
    // 2. REQUIRE_REVIEW takes precedence over APPROVE.
    // 3. APPROVE is allowed only when all applicable conditions pass and no policy requires review or blocks.
    // 4. Default: If no applicable policy matched, default to REQUIRE_REVIEW.
    let finalDecision: PolicyAction;
    let decisionReason: string;

    const blockingMatches = matchedPolicies.filter((m) => m.policy.action === 'BLOCK');
    const reviewMatches = matchedPolicies.filter((m) => m.policy.action === 'REQUIRE_REVIEW');
    const approveMatches = matchedPolicies.filter((m) => m.policy.action === 'APPROVE');

    if (blockingMatches.length > 0) {
      finalDecision = 'BLOCK';
      decisionReason = `Settlement blocked by policy: ${blockingMatches.map((m) => m.policy.name).join(', ')}. Reason: ${blockingMatches[0]?.policy.reason}`;
    } else if (reviewMatches.length > 0) {
      finalDecision = 'REQUIRE_REVIEW';
      decisionReason = `Human review required by policy: ${reviewMatches.map((m) => m.policy.name).join(', ')}. Reason: ${reviewMatches[0]?.policy.reason}`;
    } else if (approveMatches.length > 0) {
      finalDecision = 'APPROVE';
      decisionReason = `Settlement approved automatically by policy: ${approveMatches.map((m) => m.policy.name).join(', ')}`;
    } else {
      // Default documented policy: No matching policy exists/matches
      finalDecision = 'REQUIRE_REVIEW';
      decisionReason =
        'No automated approval policy matched; default system policy requires human review before payment processing';
    }

    // J. Evaluation Versioning
    const previousDecisionsCount = await PolicyDecisionModel.countDocuments({
      settlementId: new Types.ObjectId(settlementId),
    });
    const evaluationVersion = previousDecisionsCount + 1;

    // K. Create Approval Request if REQUIRE_REVIEW (and check for existing pending approval)
    let createdApprovalDoc: unknown = undefined;
    let approvalIdToLink: Types.ObjectId | undefined = undefined;

    if (finalDecision === 'REQUIRE_REVIEW') {
      const existingPending = await ApprovalModel.findOne({
        settlementId: new Types.ObjectId(settlementId),
        approvalStatus: 'Pending',
      });

      if (!existingPending) {
        const dummyDecisionId = new Types.ObjectId();
        const approval = await ApprovalModel.create({
          settlementId: new Types.ObjectId(settlementId),
          policyDecisionId: dummyDecisionId,
          approvalStatus: 'Pending',
          requestedAt: new Date(),
          comments: decisionReason,
          approvalHistory: [
            {
              status: 'Pending',
              transitionAt: new Date(),
              reason: decisionReason,
            },
          ],
        });
        createdApprovalDoc = approval;
        approvalIdToLink = approval._id;

        await auditService.append({
          action: 'APPROVAL_REQUESTED',
          entityType: 'Approval',
          entityId: String(approval._id),
          settlementId: new Types.ObjectId(settlementId),
          description: `Approval request created for settlement ${settlement.paymentId}`,
          reason: decisionReason,
        });
      } else {
        approvalIdToLink = existingPending._id;
        createdApprovalDoc = existingPending;
      }
    }

    // L. Persist PolicyDecision
    const decision = await PolicyDecisionModel.create({
      settlementId: new Types.ObjectId(settlementId),
      serviceId: new Types.ObjectId(settlement.serviceId),
      policyResults,
      finalDecision,
      decisionReason,
      approvalId: approvalIdToLink,
      evaluatedAt: new Date(),
      policySnapshot: policySnapshots,
      evaluationVersion,
    });

    // Update approval's policyDecisionId if we created one
    if (createdApprovalDoc && approvalIdToLink) {
      await ApprovalModel.updateOne(
        { _id: approvalIdToLink },
        { $set: { policyDecisionId: decision._id } }
      );
    }

    // M. Update Settlement status lifecycle
    const previousSettlementStatus = settlement.status;
    let nextSettlementStatus = settlement.status;

    if (finalDecision === 'BLOCK') {
      nextSettlementStatus = 'Blocked';
      await SettlementModel.updateOne(
        { _id: settlement._id },
        { $set: { status: 'Blocked', requiresReviewReason: decisionReason } }
      );
    } else if (finalDecision === 'REQUIRE_REVIEW') {
      nextSettlementStatus = 'RequiresReview';
      await SettlementModel.updateOne(
        { _id: settlement._id },
        { $set: { status: 'RequiresReview', requiresReviewReason: decisionReason } }
      );
    } else if (finalDecision === 'APPROVE') {
      nextSettlementStatus = 'Approved';
      await SettlementModel.updateOne(
        { _id: settlement._id },
        { $set: { status: 'Approved' } }
      );
    }

    // N. Audit log entries
    await auditService.append({
      action: 'POLICY_EVALUATED',
      entityType: 'PolicyDecision',
      entityId: String(decision._id),
      settlementId: new Types.ObjectId(settlementId),
      description: `Policy evaluation v${evaluationVersion} completed with decision: ${finalDecision}`,
      metadata: { finalDecision, decisionReason, evaluationVersion },
    });

    if (previousSettlementStatus !== nextSettlementStatus) {
      await auditService.append({
        action: 'SETTLEMENT_STATUS_UPDATED',
        entityType: 'Settlement',
        entityId: String(settlement._id),
        settlementId: new Types.ObjectId(settlementId),
        description: `Settlement status transitioned from '${previousSettlementStatus}' to '${nextSettlementStatus}' by Policy Engine`,
        before: { status: previousSettlementStatus },
        after: { status: nextSettlementStatus },
      });
    }

    return {
      decision,
      approval: createdApprovalDoc,
    };
  },

  // 8. List Decisions
  async listDecisions(query: ListDecisionsQueryInput): Promise<{
    data: PolicyDecisionDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, settlementId, finalDecision } = query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (settlementId) filter['settlementId'] = new Types.ObjectId(settlementId);
    if (finalDecision) filter['finalDecision'] = finalDecision;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      PolicyDecisionModel.find(filter)
        .sort({ evaluatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PolicyDecisionModel.countDocuments(filter),
    ]);

    return {
      data: docs as unknown as PolicyDecisionDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  // 9. Get Decision by ID
  async getDecisionById(id: string): Promise<PolicyDecisionDocument> {
    const decision = await PolicyDecisionModel.findById(id).lean();
    if (!decision) {
      throw new AppError(404, 'DECISION_NOT_FOUND', `Policy decision '${id}' not found`);
    }
    return decision as unknown as PolicyDecisionDocument;
  },

  // 10. Get Decisions for a Settlement
  async getDecisionsForSettlement(settlementId: string): Promise<PolicyDecisionDocument[]> {
    const decisions = await PolicyDecisionModel.find({
      settlementId: new Types.ObjectId(settlementId),
    })
      .sort({ evaluationVersion: -1 })
      .lean();

    return decisions as unknown as PolicyDecisionDocument[];
  },
};
