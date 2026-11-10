import { RequestHandler } from 'express';
import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { policyService } from './policy.service';
import {
  CreatePolicyInput,
  ListDecisionsQueryInput,
  ListPoliciesQueryInput,
  UpdatePolicyInput,
  UpdatePolicyStatusInput,
} from './policy.validation';

// POST /api/policies
export const createPolicy: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.body as CreatePolicyInput;
  const policy = await policyService.createPolicy(input);
  success(res, 'Policy created successfully', policy, 201);
});

// GET /api/policies
export const listPolicies: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListPoliciesQueryInput;
  const result = await policyService.listPolicies(query);
  success(res, 'Policies retrieved successfully', result);
});

// GET /api/policies/:id
export const getPolicy: RequestHandler = asyncHandler(async (req, res) => {
  const policy = await policyService.getPolicyById(req.params['id'] as string);
  success(res, 'Policy retrieved successfully', policy);
});

// PATCH /api/policies/:id
export const updatePolicy: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.body as UpdatePolicyInput;
  const policy = await policyService.updatePolicy(req.params['id'] as string, input);
  success(res, 'Policy updated successfully', policy);
});

// PATCH /api/policies/:id/status
export const updatePolicyStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { enabled } = req.body as UpdatePolicyStatusInput;
  const policy = await policyService.updatePolicyStatus(req.params['id'] as string, enabled);
  success(res, `Policy ${enabled ? 'enabled' : 'disabled'} successfully`, policy);
});

// GET /api/policies/service/:serviceId
export const getPoliciesForService: RequestHandler = asyncHandler(async (req, res) => {
  const policies = await policyService.getPoliciesForService(req.params['serviceId'] as string);
  success(res, 'Service policies retrieved successfully', policies);
});

// POST /api/policies/evaluate/:settlementId
export const evaluateSettlement: RequestHandler = asyncHandler(async (req, res) => {
  const settlementId = req.params['settlementId'] as string;
  const result = await policyService.evaluateSettlement(settlementId);
  success(res, 'Settlement evaluated against policies successfully', result);
});

// GET /api/policies/decisions
export const listDecisions: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListDecisionsQueryInput;
  const result = await policyService.listDecisions(query);
  success(res, 'Policy decisions retrieved successfully', result);
});

// GET /api/policies/decisions/:id
export const getDecision: RequestHandler = asyncHandler(async (req, res) => {
  const decision = await policyService.getDecisionById(req.params['id'] as string);
  success(res, 'Policy decision retrieved successfully', decision);
});

// GET /api/policies/decisions/settlement/:settlementId
export const getSettlementDecisions: RequestHandler = asyncHandler(async (req, res) => {
  const decisions = await policyService.getDecisionsForSettlement(
    req.params['settlementId'] as string
  );
  success(res, 'Settlement decision history retrieved successfully', decisions);
});

// Backward-compatible POST /evaluate (if request body supplies settlementId)
export const evaluatePolicyLegacy: RequestHandler = asyncHandler(async (req, res) => {
  const settlementId = (req.body?.settlementId || req.params['settlementId']) as string;
  const result = await policyService.evaluateSettlement(settlementId);
  success(res, 'Settlement evaluated against policies successfully', result);
});
