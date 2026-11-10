import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ServiceModel } from '../src/modules/services/service.model';
import { SLAContractModel, SLABreachModel } from '../src/modules/sla/sla.model';
import { SettlementModel } from '../src/modules/settlement/settlement.model';
import { ApprovalModel } from '../src/modules/approvals/approval.model';
import { PaymentModel } from '../src/modules/payment/payment.model';
import { AuditLogModel } from '../src/modules/audit/audit.model';
import { PerformanceMetricModel } from '../src/modules/monitoring/monitoring.model';

const serviceId = new Types.ObjectId('507f1f77bcf86cd799439011');
const contractId = new Types.ObjectId('60d5ec49f1b2c82b88123456');
const breachId = new Types.ObjectId('60d5ec49f1b2c82b88654321');
const settlementId = new Types.ObjectId('60d5ec49f1b2c82b88abcdef');
const approvalId = new Types.ObjectId('60d5ec49f1b2c82b88222222');
const paymentId = 'PAY-DEMO-001';

async function seed() {
  await connectDatabase();
  console.info('🌱 Seeding MongoDB database with demonstration records...');

  // 1. Service
  await ServiceModel.findOneAndUpdate(
    { _id: serviceId },
    {
      _id: serviceId,
      name: 'Acme Cloud Gateway API',
      description: 'Production API Gateway with guaranteed 99.9% uptime',
      baseUrl: 'http://localhost:5000/api/health',
      serviceType: 'API',
      status: 'Active',
      expectedUptime: 99.9,
      expectedResponseTime: 300,
      tags: ['production', 'fintech', 'sla-backed'],
    },
    { upsert: true, new: true }
  );

  // 2. SLA Contract
  await SLAContractModel.findOneAndUpdate(
    { _id: contractId },
    {
      _id: contractId,
      serviceId,
      contractName: 'Enterprise SLA - 99.9% Uptime Commitment',
      contractReference: 'SLA-2026-CLOUD-001',
      providerName: 'Acme Cloud Services',
      customerName: 'FinTech Enterprises Inc',
      effectiveFrom: new Date('2026-01-01'),
      effectiveUntil: new Date('2026-12-31'),
      status: 'Active',
      measurementWindow: { type: 'MONTHLY', durationMinutes: 43200 },
      targets: [
        { metric: 'uptime', operator: '>=', threshold: 99.9, unit: '%' },
        { metric: 'responseTime', operator: '<=', threshold: 300, unit: 'ms' },
      ],
      creditRules: [
        {
          ruleId: 'uptime-credit',
          description: 'Uptime below 99.9% earns a 25% contractual credit',
          applicableMetric: 'uptime',
          operator: '<',
          threshold: 99.9,
          creditType: 'PERCENTAGE',
          creditValue: Types.Decimal128.fromString('25'),
          maxCreditLimit: Types.Decimal128.fromString('50'),
          priority: 1,
        },
      ],
      version: 1,
    },
    { upsert: true, new: true }
  );

  // 3. Performance Metrics
  await PerformanceMetricModel.deleteMany({ serviceId });
  const metrics = [
    { serviceId, checkedAt: new Date(Date.now() - 3600000 * 4), responseTime: 120, status: 'UP', httpStatusCode: 200 },
    { serviceId, checkedAt: new Date(Date.now() - 3600000 * 3), responseTime: 145, status: 'UP', httpStatusCode: 200 },
    { serviceId, checkedAt: new Date(Date.now() - 3600000 * 2), responseTime: 850, status: 'DOWN', httpStatusCode: 503, errorMessage: 'Outage detected' },
    { serviceId, checkedAt: new Date(Date.now() - 3600000 * 1), responseTime: 130, status: 'UP', httpStatusCode: 200 },
  ];
  await PerformanceMetricModel.insertMany(metrics);

  // 4. SLA Breach
  await SLABreachModel.findOneAndUpdate(
    { _id: breachId },
    {
      _id: breachId,
      serviceId,
      contractId,
      metric: 'uptime',
      contractualThreshold: 99.9,
      observedValue: 97.0,
      comparisonOperator: '>=',
      severity: 'High',
      breachType: 'UPTIME_BREACH',
      measurementPeriodStart: new Date(Date.now() - 86400000 * 30),
      measurementPeriodEnd: new Date(),
      evidence: {
        totalChecks: 1000,
        successfulChecks: 970,
        failedChecks: 30,
        calculatedUptime: 97.0,
        avgResponseTime: 310,
      },
      status: 'Confirmed',
      detectedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // 5. Settlement (Authorized: $100, Credit: $25, Capture: $75)
  await SettlementModel.findOneAndUpdate(
    { _id: settlementId },
    {
      _id: settlementId,
      paymentId,
      serviceId,
      contractId,
      breachIds: [breachId],
      authorizedAmount: Types.Decimal128.fromString('100.00'),
      totalCredit: Types.Decimal128.fromString('25.00'),
      finalPayableAmount: Types.Decimal128.fromString('75.00'),
      currency: 'USD',
      calculationBreakdown: [
        {
          ruleId: 'uptime-credit',
          ruleDescription: 'Uptime below 99.9% earns a 25% credit',
          breachId: String(breachId),
          metric: 'uptime',
          contractualThreshold: 99.9,
          observedValue: 97.0,
          creditType: 'PERCENTAGE',
          creditValue: Types.Decimal128.fromString('25'),
          creditAmountCalculated: Types.Decimal128.fromString('25.00'),
          applied: true,
          reason: 'Observed uptime 97.0% is below the 99.9% SLA',
        },
      ],
      calculationVersion: '1.0.0',
      contractVersion: 1,
      status: 'RequiresReview',
      requiresReviewReason: 'Credit $25.00 requires human review threshold',
      calculatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // 6. Approval Request
  await ApprovalModel.findOneAndUpdate(
    { _id: approvalId },
    {
      _id: approvalId,
      settlementId,
      approvalStatus: 'Pending',
      requestedAt: new Date(),
      comments: 'Requires human confirmation: $25 SLA breach credit calculated on $100 plan',
      approvalHistory: [
        {
          status: 'Pending',
          transitionAt: new Date(),
          reason: 'Policy engine review threshold triggered',
        },
      ],
    },
    { upsert: true, new: true }
  );

  // 7. Payment Record
  await PaymentModel.findOneAndUpdate(
    { paymentId },
    {
      paymentId,
      orderId: '5O190127TN364715T',
      authorizationId: '2C279288R6874943E',
      authorizedAmount: Types.Decimal128.fromString('100.00'),
      capturedAmount: Types.Decimal128.fromString('0.00'),
      refundedAmount: Types.Decimal128.fromString('0.00'),
      currency: 'USD',
      paymentStatus: 'AUTHORIZED',
      description: 'Acme Cloud API - Enterprise Plan #SC-2024-001',
      settlementId,
      serviceId,
      contractId,
    },
    { upsert: true, new: true }
  );

  // 8. Audit Logs
  await AuditLogModel.deleteMany({ settlementId });
  await AuditLogModel.insertMany([
    {
      action: 'CONTRACT_UPLOADED',
      entityType: 'SLAContract',
      entityId: String(contractId),
      settlementId,
      description: 'Enterprise SLA contract uploaded and terms extracted: 99.9% uptime target',
      timestamp: new Date(Date.now() - 3600000 * 5),
    },
    {
      action: 'PAYMENT_AUTHORIZED',
      entityType: 'Payment',
      entityId: paymentId,
      settlementId,
      description: 'Buyer authorized $100.00 hold via PayPal Orders API v2 (Order: 5O190127TN364715T)',
      timestamp: new Date(Date.now() - 3600000 * 4),
    },
    {
      action: 'BREACH_DETECTED',
      entityType: 'SLABreach',
      entityId: String(breachId),
      settlementId,
      description: 'SLA Breach detected: Uptime dropped to 97.0% (contractual target: 99.9%)',
      timestamp: new Date(Date.now() - 3600000 * 2),
    },
    {
      action: 'SETTLEMENT_CALCULATED',
      entityType: 'Settlement',
      entityId: String(settlementId),
      settlementId,
      description: 'Deterministic engine calculated $25.00 credit. Approved capture: $75.00',
      timestamp: new Date(Date.now() - 3600000 * 1),
    },
  ]);

  console.info('✅ Demonstration records seeded successfully in MongoDB!');
  await disconnectDatabase();
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exitCode = 1;
});
