import { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { success } from '../../shared/utils/api-response';
import { settlementCalculationService } from './calculation.service';
import { CalculateSettlementInput, ListSettlementsQueryInput } from './settlement.validation';
import { SettlementModel } from './settlement.model';
import { ApprovalModel } from '../approvals/approval.model';
import { approvalService } from '../approvals/approval.service';
import { PaymentAuthorizationAdapter } from './payment-authorization.adapter';
import { auditService } from '../audit/audit.service';
import { AppError } from '../../shared/errors/app-error';
import { resolveReviewerIdentity } from '../approvals/reviewer.context';

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

// POST /api/settlements/:id/approve
export const approveSettlementDirect: RequestHandler = asyncHandler(async (req, res) => {
  const settlementId = req.params['id'] as string;
  const settlement = await SettlementModel.findById(settlementId);
  if (!settlement) {
    throw new AppError(404, 'SETTLEMENT_NOT_FOUND', `Settlement '${settlementId}' not found`);
  }

  const reviewer = resolveReviewerIdentity(req, req.body);
  const pendingApproval = await ApprovalModel.findOne({
    settlementId: settlement._id,
    approvalStatus: 'Pending',
  });

  if (pendingApproval) {
    const result = await approvalService.approve(
      String(pendingApproval._id),
      { comments: req.body.comments || 'Approved via dashboard' },
      reviewer
    );
    const updated = await SettlementModel.findById(settlementId);
    success(res, 'Settlement approved and payment captured successfully', {
      settlement: updated,
      approval: result,
    });
    return;
  }

  // Direct approval if no pending approval document exists
  settlement.status = 'Approved';
  await settlement.save();

  let captureResult = null;
  if (settlement.authorizedAmount) {
    try {
      await PaymentAuthorizationAdapter.stageSettlement({
        settlementId: String(settlement._id),
        paymentId: settlement.paymentId,
        authorizedAmount: settlement.authorizedAmount?.toString() || '0.00',
        creditAmount: settlement.totalCredit?.toString() || '0.00',
        captureAmount: settlement.finalPayableAmount?.toString() || '0.00',
        currency: settlement.currency || 'USD',
        decision: 'APPROVED',
        approvedBy: reviewer.reviewerName ?? reviewer.reviewerId,
      });

      captureResult = await PaymentAuthorizationAdapter.executeCapture(
        settlement.paymentId,
        String(settlement._id)
      );

      if (captureResult.success) {
        settlement.status = 'Paid';
        await settlement.save();

        await auditService.append({
          action: 'PAYMENT_CAPTURED',
          entityType: 'Settlement',
          entityId: String(settlement._id),
          settlementId: settlement._id,
          actorId: reviewer.reviewerId,
          description: `PayPal captured $${captureResult.capturedAmount} (Capture ID: ${captureResult.captureId})`,
          metadata: {
            paypalCaptureId: captureResult.captureId,
            capturedAmount: captureResult.capturedAmount,
            status: captureResult.status,
          },
        });
      }
    } catch (err: any) {
      console.warn('[Direct Settlement Capture Warning]', err.message);
    }
  }

  success(res, 'Settlement approved successfully', {
    settlement,
    capture: captureResult,
  });
});
