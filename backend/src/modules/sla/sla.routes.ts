import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  createContract,
  evaluateContract,
  evaluateService,
  getBreach,
  getBreachesByService,
  getContract,
  getContractsByService,
  listBreaches,
  listContracts,
  updateBreachStatus,
  updateContract,
  updateContractStatus,
} from './sla.controller';
import {
  breachIdParamSchema,
  contractIdParamSchema,
  createContractSchema,
  evaluateContractParamSchema,
  evaluateContractSchema,
  listBreachesQuerySchema,
  listContractsQuerySchema,
  serviceIdParamSchema,
  updateBreachStatusSchema,
  updateContractSchema,
  updateContractStatusSchema,
} from './sla.validation';

const router = Router();

// ==================== SLA CONTRACT APIS ====================

// List contracts
router.get(
  '/contracts',
  validate(listContractsQuerySchema, 'query'),
  listContracts
);

// Create SLA contract
router.post(
  '/contracts',
  validate(createContractSchema),
  createContract
);

// Get contracts for a service
router.get(
  '/contracts/service/:serviceId',
  validate(serviceIdParamSchema, 'params'),
  getContractsByService
);

// Update contract status
router.patch(
  '/contracts/:id/status',
  validate(contractIdParamSchema, 'params'),
  validate(updateContractStatusSchema),
  updateContractStatus
);

// Get contract by ID
router.get(
  '/contracts/:id',
  validate(contractIdParamSchema, 'params'),
  getContract
);

// Update contract details
router.patch(
  '/contracts/:id',
  validate(contractIdParamSchema, 'params'),
  validate(updateContractSchema),
  updateContract
);

// ==================== SLA EVALUATION & BREACH APIS ====================

// Evaluate active contracts for a service
router.post(
  '/evaluate/service/:serviceId',
  validate(serviceIdParamSchema, 'params'),
  validate(evaluateContractSchema),
  evaluateService
);

// Evaluate single SLA contract
router.post(
  '/evaluate/:contractId',
  validate(evaluateContractParamSchema, 'params'),
  validate(evaluateContractSchema),
  evaluateContract
);

// List breaches
router.get(
  '/breaches',
  validate(listBreachesQuerySchema, 'query'),
  listBreaches
);

// Get breaches for a service
router.get(
  '/breaches/service/:serviceId',
  validate(serviceIdParamSchema, 'params'),
  getBreachesByService
);

// Update breach review status
router.patch(
  '/breaches/:id/status',
  validate(breachIdParamSchema, 'params'),
  validate(updateBreachStatusSchema),
  updateBreachStatus
);

// Get breach details by ID
router.get(
  '/breaches/:id',
  validate(breachIdParamSchema, 'params'),
  getBreach
);

// Backward-compatible convenience aliases
router.post('/', validate(createContractSchema), createContract);
router.get('/:id', validate(contractIdParamSchema, 'params'), getContract);
router.post('/:id/evaluate', validate(evaluateContractParamSchema, 'params'), evaluateContract);

export default router;
