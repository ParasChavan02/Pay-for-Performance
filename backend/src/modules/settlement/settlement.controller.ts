import { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { success } from '../../shared/utils/api-response';
import { settlementCalculationService } from './calculation.service';
import { CalculateSettlementInput, ListSettlementsQueryInput } from './settlement.validation';

// POST /api/settlements/calculate
export const calculateSettlement: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.body as CalculateSettlementInput;
  const settlement = await settlementCalculationService.calculate(input);
  success(res, 'Settlement calculated successfully', settlement, 201);
});

// GET /api/settlements/
export const listSettlements: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListSettlementsQueryInput;
  const result = await settlementCalculationService.list(query);
  success(res, 'Settlements retrieved successfully', result);
});

// GET /api/settlements/:id
export const getSettlement: RequestHandler = asyncHandler(async (req, res) => {
  const settlement = await settlementCalculationService.getById(req.params['id'] as string);
  success(res, 'Settlement retrieved successfully', settlement);
});

// GET /api/settlements/payment/:paymentId
export const getSettlementByPayment: RequestHandler = asyncHandler(async (req, res) => {
  const settlement = await settlementCalculationService.getByPaymentId(
    req.params['paymentId'] as string
  );
  success(res, 'Settlement retrieved successfully', settlement);
});

// GET /api/settlements/service/:serviceId
export const getSettlementsByService: RequestHandler = asyncHandler(async (req, res) => {
  const settlements = await settlementCalculationService.getByServiceId(
    req.params['serviceId'] as string
  );
  success(res, 'Settlements retrieved successfully', settlements);
});

// GET /api/settlements/:id/breakdown
export const getSettlementBreakdown: RequestHandler = asyncHandler(async (req, res) => {
  const result = await settlementCalculationService.getBreakdown(req.params['id'] as string);
  success(res, 'Calculation breakdown retrieved successfully', result);
});

// POST /api/settlements/:id/recalculate
export const recalculateSettlement: RequestHandler = asyncHandler(async (req, res) => {
  const settlement = await settlementCalculationService.recalculate(req.params['id'] as string);
  success(res, 'Settlement recalculated successfully', settlement);
});
