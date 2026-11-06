import { RequestHandler } from 'express';
import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { slaContractService } from './sla-contract.service';
import { slaEvaluationService } from './sla-evaluation.service';
import {
  CreateContractInput,
  EvaluateContractInput,
  ListBreachesQueryInput,
  ListContractsQueryInput,
  UpdateBreachStatusInput,
  UpdateContractInput,
  UpdateContractStatusInput,
} from './sla.validation';

// ----------------- SLA CONTRACT CONTROLLERS -----------------

export const createContract: RequestHandler = asyncHandler(async (req, res) => {
  const contract = await slaContractService.create(req.body as CreateContractInput);
  return success(res, 'SLA Contract created successfully', contract, 201);
});

export const listContracts: RequestHandler = asyncHandler(async (req, res) => {
  const result = await slaContractService.list(
    req.query as unknown as ListContractsQueryInput
  );
  return success(res, 'SLA Contracts retrieved successfully', result);
});

export const getContract: RequestHandler = asyncHandler(async (req, res) => {
  const contract = await slaContractService.getById(req.params.id as string);
  return success(res, 'SLA Contract retrieved successfully', contract);
});

export const updateContract: RequestHandler = asyncHandler(async (req, res) => {
  const contract = await slaContractService.update(
    req.params.id as string,
    req.body as UpdateContractInput
  );
  return success(res, 'SLA Contract updated successfully', contract);
});

export const updateContractStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { status } = req.body as UpdateContractStatusInput;
  const contract = await slaContractService.updateStatus(req.params.id as string, status);
  return success(res, 'SLA Contract status updated successfully', contract);
});

export const getContractsByService: RequestHandler = asyncHandler(async (req, res) => {
  const result = await slaContractService.getByServiceId(req.params.serviceId as string);
  return success(res, 'Service SLA Contracts retrieved successfully', result);
});

// ----------------- EVALUATION & BREACH CONTROLLERS -----------------

export const evaluateContract: RequestHandler = asyncHandler(async (req, res) => {
  const contractId = (req.params.contractId || req.params.id) as string;
  const result = await slaEvaluationService.evaluateContract(
    contractId,
    (req.body || {}) as EvaluateContractInput
  );
  return success(res, 'SLA Contract evaluated successfully', result);
});

export const evaluateService: RequestHandler = asyncHandler(async (req, res) => {
  const serviceId = req.params.serviceId as string;
  const result = await slaEvaluationService.evaluateService(
    serviceId,
    (req.body || {}) as EvaluateContractInput
  );
  return success(res, 'Service active SLA contracts evaluated successfully', result);
});

export const listBreaches: RequestHandler = asyncHandler(async (req, res) => {
  const result = await slaEvaluationService.listBreaches(
    req.query as unknown as ListBreachesQueryInput
  );
  return success(res, 'SLA Breaches retrieved successfully', result);
});

export const getBreach: RequestHandler = asyncHandler(async (req, res) => {
  const breach = await slaEvaluationService.getBreachById(req.params.id as string);
  return success(res, 'SLA Breach retrieved successfully', breach);
});

export const getBreachesByService: RequestHandler = asyncHandler(async (req, res) => {
  const result = await slaEvaluationService.getBreachesByServiceId(
    req.params.serviceId as string
  );
  return success(res, 'Service SLA Breaches retrieved successfully', result);
});

export const updateBreachStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { status } = req.body as UpdateBreachStatusInput;
  const breach = await slaEvaluationService.updateBreachStatus(
    req.params.id as string,
    status
  );
  return success(res, 'SLA Breach status updated successfully', breach);
});
