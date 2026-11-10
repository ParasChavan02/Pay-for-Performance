import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  createPolicy,
  evaluatePolicyLegacy,
  evaluateSettlement,
  getDecision,
  getPoliciesForService,
  getPolicy,
  getSettlementDecisions,
  listDecisions,
  listPolicies,
  updatePolicy,
  updatePolicyStatus,
} from './policy.controller';
import {
  createPolicySchema,
  decisionIdParamSchema,
  evaluateSettlementParamSchema,
  listDecisionsQuerySchema,
  listPoliciesQuerySchema,
  policyIdParamSchema,
  policyServiceIdParamSchema,
  updatePolicySchema,
  updatePolicyStatusSchema,
} from './policy.validation';

const router = Router();

// Evaluation endpoints (specific routes first)
router.post(
  '/evaluate/:settlementId',
  validate(evaluateSettlementParamSchema, 'params'),
  evaluateSettlement
);
router.post('/evaluate', evaluatePolicyLegacy);

// Decision history endpoints
router.get(
  '/decisions/settlement/:settlementId',
  validate(evaluateSettlementParamSchema, 'params'),
  getSettlementDecisions
);
router.get('/decisions/:id', validate(decisionIdParamSchema, 'params'), getDecision);
router.get('/decisions', validate(listDecisionsQuerySchema, 'query'), listDecisions);

// Service-specific policies
router.get(
  '/service/:serviceId',
  validate(policyServiceIdParamSchema, 'params'),
  getPoliciesForService
);

// Specific policy ID routes
router.patch(
  '/:id/status',
  validate(policyIdParamSchema, 'params'),
  validate(updatePolicyStatusSchema, 'body'),
  updatePolicyStatus
);
router.patch(
  '/:id',
  validate(policyIdParamSchema, 'params'),
  validate(updatePolicySchema, 'body'),
  updatePolicy
);
router.get('/:id', validate(policyIdParamSchema, 'params'), getPolicy);

// Base collection routes
router.post('/', validate(createPolicySchema, 'body'), createPolicy);
router.get('/', validate(listPoliciesQuerySchema, 'query'), listPolicies);

export default router;
