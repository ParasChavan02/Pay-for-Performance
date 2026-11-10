import { HydratedDocument, Schema, Types, model } from 'mongoose';

// ----------------------------------------------------------------- Constants

export const policyCategories = [
  'Financial',
  'Settlement',
  'SLA',
  'Risk',
  'Compliance',
] as const;
export type PolicyCategory = (typeof policyCategories)[number];

export const policyScopes = ['Global', 'Service'] as const;
export type PolicyScope = (typeof policyScopes)[number];

export const policyActions = ['APPROVE', 'REQUIRE_REVIEW', 'BLOCK'] as const;
export type PolicyAction = (typeof policyActions)[number];

export const conditionOperators = [
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'IN',
  'NOT_IN',
] as const;
export type ConditionOperator = (typeof conditionOperators)[number];

export const logicalOperators = ['AND', 'OR'] as const;
export type LogicalOperator = (typeof logicalOperators)[number];

// ---------------------------------------------------------------- Interfaces

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface ConditionGroup {
  logicalOperator: LogicalOperator;
  rules: ConditionRule[];
}

export interface PolicyVersionHistory {
  version: number;
  name: string;
  description: string;
  policyCode: string;
  category: PolicyCategory;
  priority: number;
  enabled: boolean;
  scope: PolicyScope;
  serviceId?: Types.ObjectId;
  conditions: ConditionGroup;
  action: PolicyAction;
  reason: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  archivedAt: Date;
  changedBy?: string;
}

export interface Policy {
  name: string;
  description: string;
  policyCode: string;
  category: PolicyCategory;
  priority: number;
  enabled: boolean;
  scope: PolicyScope;
  serviceId?: Types.ObjectId;
  conditions: ConditionGroup;
  action: PolicyAction;
  reason: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  version: number;
  versionHistory: PolicyVersionHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyEvaluationResult {
  policyId: Types.ObjectId;
  policyCode: string;
  policyName: string;
  policyVersion: number;
  action: PolicyAction;
  priority: number;
  conditions: ConditionGroup;
  actualValues: Record<string, unknown>;
  matched: boolean;
  reason: string;
}

export interface PolicyDecision {
  settlementId: Types.ObjectId;
  serviceId: Types.ObjectId;
  policyResults: PolicyEvaluationResult[];
  finalDecision: PolicyAction;
  decisionReason: string;
  approvalId?: Types.ObjectId;
  evaluatedAt: Date;
  policySnapshot: unknown[];
  evaluationVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

// ------------------------------------------------------------------ Schemas

const conditionRuleSchema = new Schema<ConditionRule>(
  {
    field: { type: String, required: true, trim: true },
    operator: {
      type: String,
      enum: {
        values: conditionOperators,
        message: `Operator must be one of: ${conditionOperators.join(', ')}`,
      },
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const conditionGroupSchema = new Schema<ConditionGroup>(
  {
    logicalOperator: {
      type: String,
      enum: logicalOperators,
      default: 'AND',
    },
    rules: {
      type: [conditionRuleSchema],
      default: [],
    },
  },
  { _id: false }
);

const versionHistorySchema = new Schema<PolicyVersionHistory>(
  {
    version: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    policyCode: { type: String, required: true },
    category: { type: String, enum: policyCategories, required: true },
    priority: { type: Number, required: true },
    enabled: { type: Boolean, required: true },
    scope: { type: String, enum: policyScopes, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    conditions: { type: conditionGroupSchema, required: true },
    action: { type: String, enum: policyActions, required: true },
    reason: { type: String, required: true },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
    archivedAt: { type: Date, default: Date.now },
    changedBy: { type: String },
  },
  { _id: false }
);

const policySchema = new Schema<Policy>(
  {
    name: {
      type: String,
      required: [true, 'Policy name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Policy description is required'],
      trim: true,
    },
    policyCode: {
      type: String,
      required: [true, 'Policy code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: policyCategories,
        message: `Category must be one of: ${policyCategories.join(', ')}`,
      },
      required: [true, 'Policy category is required'],
      index: true,
    },
    priority: {
      type: Number,
      default: 1,
      min: [1, 'Priority must be at least 1'],
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    scope: {
      type: String,
      enum: {
        values: policyScopes,
        message: 'Scope must be Global or Service',
      },
      default: 'Global',
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      index: true,
    },
    conditions: {
      type: conditionGroupSchema,
      required: [true, 'Policy conditions are required'],
    },
    action: {
      type: String,
      enum: {
        values: policyActions,
        message: `Action must be one of: ${policyActions.join(', ')}`,
      },
      required: [true, 'Policy action is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Policy decision reason is required'],
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      index: true,
    },
    effectiveUntil: {
      type: Date,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    versionHistory: {
      type: [versionHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

policySchema.index({ scope: 1, serviceId: 1, enabled: 1, priority: 1 });
policySchema.index({ effectiveFrom: 1, effectiveUntil: 1 });

const policyEvaluationResultSchema = new Schema<PolicyEvaluationResult>(
  {
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true },
    policyCode: { type: String, required: true },
    policyName: { type: String, required: true },
    policyVersion: { type: Number, required: true },
    action: { type: String, enum: policyActions, required: true },
    priority: { type: Number, required: true },
    conditions: { type: Schema.Types.Mixed, required: true },
    actualValues: { type: Schema.Types.Mixed, required: true },
    matched: { type: Boolean, required: true },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const policyDecisionSchema = new Schema<PolicyDecision>(
  {
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: 'Settlement',
      required: [true, 'Settlement ID is required'],
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },
    policyResults: {
      type: [policyEvaluationResultSchema],
      default: [],
    },
    finalDecision: {
      type: String,
      enum: {
        values: policyActions,
        message: `Decision must be one of: ${policyActions.join(', ')}`,
      },
      required: true,
      index: true,
    },
    decisionReason: {
      type: String,
      required: true,
    },
    approvalId: {
      type: Schema.Types.ObjectId,
      ref: 'Approval',
      index: true,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    policySnapshot: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    evaluationVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

policyDecisionSchema.index({ settlementId: 1, evaluationVersion: -1 });

export type PolicyDocument = HydratedDocument<Policy>;
export type PolicyDecisionDocument = HydratedDocument<PolicyDecision>;

export const PolicyModel = model<Policy>('Policy', policySchema);
export const PolicyDecisionModel = model<PolicyDecision>('PolicyDecision', policyDecisionSchema);
