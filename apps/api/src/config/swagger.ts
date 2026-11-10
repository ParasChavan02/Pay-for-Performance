import swaggerJSDoc from 'swagger-jsdoc';

const placeholderResponse = {
  description: 'Standard API response',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Response' },
      example: {
        success: true,
        message: 'Module is initialized; business logic is not implemented yet.',
      },
    },
  },
};

const placeholder = (summary: string) => ({
  summary,
  responses: { 501: placeholderResponse },
});

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Pay-for-Performance API',
      version: '1.0.0',
      description: 'Performance verification, monitoring engine, and SLA evaluation architecture.',
    },
    servers: [{ url: '/api' }],
    components: {
      parameters: {
        ServiceId: {
          name: 'id',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the service',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '507f1f77bcf86cd799439011',
        },
        MonitoringServiceIdParam: {
          name: 'serviceId',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the target service',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '507f1f77bcf86cd799439011',
        },
        ContractIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the SLA contract',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '60d5ec49f1b2c82b88123456',
        },
        BreachIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the SLA breach',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '60d5ec49f1b2c82b88654321',
        },
        SettlementIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the settlement',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '60d5ec49f1b2c82b88abcdef',
        },
        PolicyIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the policy',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '60d5ec49f1b2c82b88111111',
        },
        ApprovalIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: '24-character hexadecimal MongoDB ObjectId of the approval',
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          example: '60d5ec49f1b2c82b88222222',
        },
        PageQuery: {
          name: 'page',
          in: 'query',
          required: false,
          description: 'Page number for pagination (starts at 1)',
          schema: { type: 'integer', minimum: 1, default: 1 },
          example: 1,
        },
        LimitQuery: {
          name: 'limit',
          in: 'query',
          required: false,
          description: 'Number of records to return per page (max 100)',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          example: 10,
        },
      },
      schemas: {
        Response: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        Service: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'Payment API' },
            description: { type: 'string', example: 'Main payment processing service' },
            baseUrl: { type: 'string', format: 'uri', example: 'https://example.com' },
            environment: {
              type: 'string',
              enum: ['Development', 'Staging', 'Production'],
              example: 'Production',
            },
            monitoringInterval: { type: 'integer', example: 60 },
            expectedUptime: { type: 'number', example: 99.9 },
            maxResponseTime: { type: 'number', example: 500 },
            status: { type: 'string', enum: ['Active', 'Inactive'], example: 'Active' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PerformanceMetric: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88123456' },
            serviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            checkedAt: { type: 'string', format: 'date-time' },
            responseTime: { type: 'number', description: 'Response time in milliseconds', example: 145 },
            status: { type: 'string', enum: ['UP', 'DOWN'], example: 'UP' },
            httpStatusCode: { type: 'integer', nullable: true, example: 200 },
            errorMessage: { type: 'string', nullable: true, example: null },
            checkType: { type: 'string', enum: ['Scheduled', 'Manual'], example: 'Manual' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SLATarget: {
          type: 'object',
          required: ['metric', 'operator', 'threshold', 'unit'],
          properties: {
            metric: { type: 'string', example: 'uptime' },
            operator: { type: 'string', enum: ['<', '<=', '>', '>=', '=='], example: '>=' },
            threshold: { type: 'number', example: 99.9 },
            unit: { type: 'string', example: '%' },
            description: { type: 'string', example: 'Minimum monthly uptime target' },
          },
        },
        SLACreditRule: {
          type: 'object',
          required: ['ruleId', 'description', 'applicableMetric', 'operator', 'threshold', 'creditType', 'creditValue'],
          properties: {
            ruleId: { type: 'string', example: 'RULE_UPTIME_TIER_1' },
            description: { type: 'string', example: '10% service credit if uptime drops below 99.9%' },
            applicableMetric: { type: 'string', example: 'uptime' },
            operator: { type: 'string', enum: ['<', '<=', '>', '>=', '=='], example: '<' },
            threshold: { type: 'number', example: 99.9 },
            creditType: { type: 'string', enum: ['FIXED', 'PERCENTAGE'], example: 'PERCENTAGE' },
            creditValue: { type: 'number', example: 10 },
            maxCreditLimit: { type: 'number', example: 50 },
            priority: { type: 'integer', example: 1 },
          },
        },
        SLAContract: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88123456' },
            serviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            contractName: { type: 'string', example: 'Enterprise Payment SLA' },
            contractReference: { type: 'string', example: 'SLA-2026-PAY-001' },
            providerName: { type: 'string', example: 'FinTech Cloud Ltd' },
            customerName: { type: 'string', example: 'Global Retail Corp' },
            effectiveFrom: { type: 'string', format: 'date-time' },
            effectiveUntil: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['Draft', 'Active', 'Expired', 'Terminated'], example: 'Active' },
            measurementWindow: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'], example: 'MONTHLY' },
                durationMinutes: { type: 'integer', example: 43200 },
              },
            },
            targets: { type: 'array', items: { $ref: '#/components/schemas/SLATarget' } },
            creditRules: { type: 'array', items: { $ref: '#/components/schemas/SLACreditRule' } },
            version: { type: 'integer', example: 1 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SLABreach: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88654321' },
            serviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            contractId: { type: 'string', example: '60d5ec49f1b2c82b88123456' },
            metric: { type: 'string', example: 'uptime' },
            contractualThreshold: { type: 'number', example: 99.9 },
            observedValue: { type: 'number', example: 95.5 },
            comparisonOperator: { type: 'string', example: '>=' },
            severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'], example: 'High' },
            breachType: { type: 'string', example: 'UPTIME_BREACH' },
            measurementPeriodStart: { type: 'string', format: 'date-time' },
            measurementPeriodEnd: { type: 'string', format: 'date-time' },
            evidence: {
              type: 'object',
              properties: {
                totalChecks: { type: 'integer', example: 1000 },
                successfulChecks: { type: 'integer', example: 955 },
                failedChecks: { type: 'integer', example: 45 },
                calculatedUptime: { type: 'number', example: 95.5 },
                avgResponseTime: { type: 'number', nullable: true, example: 410.5 },
              },
            },
            status: { type: 'string', enum: ['Detected', 'UnderReview', 'Confirmed', 'Disputed', 'Resolved'], example: 'Detected' },
            detectedAt: { type: 'string', format: 'date-time' },
          },
        },
        CalculateSettlementRequest: {
          type: 'object',
          required: ['paymentId', 'serviceId', 'contractId', 'authorizedAmount'],
          properties: {
            paymentId: { type: 'string', example: 'PAY-20260101-001' },
            serviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            contractId: { type: 'string', example: '60d5ec49f1b2c82b88123456' },
            breachIds: {
              type: 'array',
              items: { type: 'string' },
              example: ['60d5ec49f1b2c82b88654321'],
            },
            authorizedAmount: { type: 'number', example: 1500.0 },
            currency: { type: 'string', example: 'USD' },
          },
        },
        CalculationBreakdownItem: {
          type: 'object',
          properties: {
            ruleId: { type: 'string', example: 'CR-UPTIME-01' },
            ruleDescription: { type: 'string', example: '10% credit if uptime drops below 99.9%' },
            breachId: { type: 'string', example: '60d5ec49f1b2c82b88654321' },
            metric: { type: 'string', example: 'uptime' },
            contractualThreshold: { type: 'number', example: 99.9 },
            observedValue: { type: 'number', example: 95.5 },
            creditType: { type: 'string', enum: ['FIXED', 'PERCENTAGE'], example: 'PERCENTAGE' },
            creditValue: { type: 'string', example: '10.00' },
            creditAmountCalculated: { type: 'string', example: '150.00' },
            applied: { type: 'boolean', example: true },
            reason: { type: 'string', example: 'Rule CR-UPTIME-01 matched' },
          },
        },
        Settlement: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88abcdef' },
            paymentId: { type: 'string', example: 'PAY-20260101-001' },
            serviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            contractId: { type: 'string', example: '60d5ec49f1b2c82b88123456' },
            breachIds: { type: 'array', items: { type: 'string' } },
            authorizedAmount: { type: 'string', example: '1500.00' },
            totalCredit: { type: 'string', example: '150.00' },
            finalPayableAmount: { type: 'string', example: '1350.00' },
            currency: { type: 'string', example: 'USD' },
            calculationBreakdown: {
              type: 'array',
              items: { $ref: '#/components/schemas/CalculationBreakdownItem' },
            },
            calculationVersion: { type: 'string', example: '1.0.0' },
            contractVersion: { type: 'integer', example: 1 },
            status: {
              type: 'string',
              enum: [
                'Draft',
                'Calculated',
                'RequiresReview',
                'Approved',
                'Rejected',
                'ReadyForPayment',
                'PaymentPending',
                'Paid',
                'Failed',
              ],
              example: 'Calculated',
            },
            requiresReviewReason: { type: 'string', nullable: true },
            calculatedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PolicyConditionRule: {
          type: 'object',
          required: ['field', 'operator', 'value'],
          properties: {
            field: { type: 'string', example: 'authorizedAmount' },
            operator: {
              type: 'string',
              enum: [
                'EQUALS',
                'NOT_EQUALS',
                'GREATER_THAN',
                'GREATER_THAN_OR_EQUAL',
                'LESS_THAN',
                'LESS_THAN_OR_EQUAL',
                'IN',
                'NOT_IN',
              ],
              example: 'GREATER_THAN',
            },
            value: { type: 'number', example: 500 },
          },
        },
        PolicyConditionGroup: {
          type: 'object',
          required: ['rules'],
          properties: {
            logicalOperator: { type: 'string', enum: ['AND', 'OR'], default: 'AND' },
            rules: {
              type: 'array',
              items: { $ref: '#/components/schemas/PolicyConditionRule' },
            },
          },
        },
        Policy: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88111111' },
            name: { type: 'string', example: 'High Value Settlement Review' },
            description: {
              type: 'string',
              example: 'Require human review for any settlement above $500',
            },
            policyCode: { type: 'string', example: 'POL-HIGH-VALUE' },
            category: {
              type: 'string',
              enum: ['Financial', 'Settlement', 'SLA', 'Risk', 'Compliance'],
              example: 'Financial',
            },
            priority: { type: 'integer', example: 1 },
            enabled: { type: 'boolean', example: true },
            scope: { type: 'string', enum: ['Global', 'Service'], example: 'Global' },
            serviceId: { type: 'string', nullable: true, example: null },
            conditions: { $ref: '#/components/schemas/PolicyConditionGroup' },
            action: { type: 'string', enum: ['APPROVE', 'REQUIRE_REVIEW', 'BLOCK'], example: 'REQUIRE_REVIEW' },
            reason: { type: 'string', example: 'High value transaction requires manual review' },
            version: { type: 'integer', example: 1 },
            effectiveFrom: { type: 'string', format: 'date-time' },
            effectiveUntil: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PolicyDecision: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88333333' },
            settlementId: { type: 'string', example: '60d5ec49f1b2c82b88abcdef' },
            serviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            finalDecision: {
              type: 'string',
              enum: ['APPROVE', 'REQUIRE_REVIEW', 'BLOCK'],
              example: 'REQUIRE_REVIEW',
            },
            decisionReason: { type: 'string', example: 'Human review required by policy POL-HIGH-VALUE' },
            approvalId: { type: 'string', nullable: true, example: '60d5ec49f1b2c82b88222222' },
            evaluationVersion: { type: 'integer', example: 1 },
            evaluatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Approval: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88222222' },
            settlementId: { type: 'string', example: '60d5ec49f1b2c82b88abcdef' },
            policyDecisionId: { type: 'string', example: '60d5ec49f1b2c82b88333333' },
            approvalStatus: {
              type: 'string',
              enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
              example: 'Pending',
            },
            requestedAt: { type: 'string', format: 'date-time' },
            reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewerId: { type: 'string', nullable: true },
            reviewerName: { type: 'string', nullable: true },
            comments: { type: 'string', nullable: true },
            rejectionReason: { type: 'string', nullable: true },
            approvalHistory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  transitionAt: { type: 'string', format: 'date-time' },
                  actorId: { type: 'string' },
                  comments: { type: 'string' },
                },
              },
            },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60d5ec49f1b2c82b88444444' },
            action: { type: 'string', example: 'POLICY_EVALUATED' },
            entityType: { type: 'string', example: 'PolicyDecision' },
            entityId: { type: 'string', example: '60d5ec49f1b2c82b88333333' },
            settlementId: { type: 'string', nullable: true },
            description: { type: 'string', example: 'Policy evaluation completed' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ValidationErrorResponse: {          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Request validation failed' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                details: { type: 'object' },
              },
            },
          },
        },
        NotFoundResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Resource not found' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Get server and live database status',
          tags: ['Health'],
          responses: { 200: placeholderResponse },
        },
      },
      '/services': {
        get: { summary: 'List services', tags: ['Services'], responses: { 200: placeholderResponse } },
        post: { summary: 'Register service', tags: ['Services'], responses: { 201: placeholderResponse } },
      },
      '/services/{id}': {
        get: { summary: 'Get service', tags: ['Services'], responses: { 200: placeholderResponse } },
        patch: { summary: 'Update service', tags: ['Services'], responses: { 200: placeholderResponse } },
        delete: { summary: 'Delete service', tags: ['Services'], responses: { 200: placeholderResponse } },
      },
      '/monitoring/{serviceId}/check': {
        post: { summary: 'Trigger manual check', tags: ['Monitoring'], responses: { 201: placeholderResponse } },
      },
      '/monitoring': {
        get: { summary: 'Get monitoring records', tags: ['Monitoring'], responses: { 200: placeholderResponse } },
      },
      '/monitoring/{serviceId}/latest': {
        get: { summary: 'Get latest record', tags: ['Monitoring'], responses: { 200: placeholderResponse } },
      },
      '/monitoring/{serviceId}/summary': {
        get: { summary: 'Get performance summary', tags: ['Monitoring'], responses: { 200: placeholderResponse } },
      },
      '/monitoring/{serviceId}': {
        get: { summary: 'Get service history', tags: ['Monitoring'], responses: { 200: placeholderResponse } },
      },
      '/sla/contracts': {
        post: {
          summary: 'Create a new SLA contract (structured JSON input)',
          tags: ['SLA Contracts'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SLAContract' } } },
          },
          responses: {
            201: { description: 'SLA Contract created successfully' },
            400: { description: 'Validation error' },
            404: { description: 'Referenced service not found' },
            409: { description: 'Duplicate reference or active period overlap' },
          },
        },
        get: {
          summary: 'List SLA contracts with pagination and filters',
          tags: ['SLA Contracts'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
          ],
          responses: { 200: { description: 'Contracts retrieved successfully' } },
        },
      },
      '/sla/contracts/{id}': {
        get: {
          summary: 'Get SLA contract by ID',
          tags: ['SLA Contracts'],
          parameters: [{ $ref: '#/components/parameters/ContractIdParam' }],
          responses: { 200: { description: 'Contract found' }, 404: { description: 'Contract not found' } },
        },
        patch: {
          summary: 'Update draft SLA contract terms',
          tags: ['SLA Contracts'],
          parameters: [{ $ref: '#/components/parameters/ContractIdParam' }],
          responses: { 200: { description: 'Contract updated' }, 400: { description: 'Immutable term modification rejected' } },
        },
      },
      '/sla/contracts/{id}/status': {
        patch: {
          summary: 'Transition SLA contract status (Draft, Active, Expired, Terminated)',
          tags: ['SLA Contracts'],
          parameters: [{ $ref: '#/components/parameters/ContractIdParam' }],
          responses: { 200: { description: 'Status updated' }, 409: { description: 'Overlapping active contract exists' } },
        },
      },
      '/sla/contracts/service/{serviceId}': {
        get: {
          summary: 'Get all SLA contracts for a service',
          tags: ['SLA Contracts'],
          parameters: [{ $ref: '#/components/parameters/MonitoringServiceIdParam' }],
          responses: { 200: { description: 'Contracts retrieved' } },
        },
      },
      '/sla/evaluate/{contractId}': {
        post: {
          summary: 'Evaluate an active SLA contract against monitoring data',
          tags: ['SLA Evaluation'],
          parameters: [{ $ref: '#/components/parameters/ContractIdParam' }],
          responses: {
            200: { description: 'Contract evaluated; observed values and detected breaches returned' },
            400: { description: 'Only active contracts can be evaluated' },
            404: { description: 'Contract not found' },
          },
        },
      },
      '/sla/evaluate/service/{serviceId}': {
        post: {
          summary: 'Evaluate all active SLA contracts for a service',
          tags: ['SLA Evaluation'],
          parameters: [{ $ref: '#/components/parameters/MonitoringServiceIdParam' }],
          responses: { 200: { description: 'Service contracts evaluated' }, 404: { description: 'Service not found' } },
        },
      },
      '/sla/breaches': {
        get: {
          summary: 'List detected SLA breaches with pagination and filters',
          tags: ['SLA Evaluation'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
          ],
          responses: { 200: { description: 'Breaches retrieved successfully' } },
        },
      },
      '/sla/breaches/{id}': {
        get: {
          summary: 'Get breach details by ID',
          tags: ['SLA Evaluation'],
          parameters: [{ $ref: '#/components/parameters/BreachIdParam' }],
          responses: { 200: { description: 'Breach found' }, 404: { description: 'Breach not found' } },
        },
      },
      '/sla/breaches/{id}/status': {
        patch: {
          summary: 'Update breach review status (Detected, UnderReview, Confirmed, Disputed, Resolved)',
          tags: ['SLA Evaluation'],
          parameters: [{ $ref: '#/components/parameters/BreachIdParam' }],
          responses: { 200: { description: 'Breach status updated' } },
        },
      },
      '/sla/breaches/service/{serviceId}': {
        get: {
          summary: 'Get all breaches for a service',
          tags: ['SLA Evaluation'],
          parameters: [{ $ref: '#/components/parameters/MonitoringServiceIdParam' }],
          responses: { 200: { description: 'Breaches retrieved' } },
        },
      },
      '/settlements/calculate': {
        post: {
          summary: 'Calculate a new settlement from a payment authorization and breach records',
          tags: ['Settlements'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CalculateSettlementRequest' },
              },
            },
          },
          responses: {
            201: { description: 'Settlement calculated successfully' },
            400: { description: 'Validation error' },
            404: { description: 'Contract or breach not found' },
            409: { description: 'Settlement for this paymentId already exists' },
          },
        },
      },
      '/settlements/payment/{paymentId}': {
        get: {
          summary: 'Get settlement by payment ID',
          tags: ['Settlements'],
          parameters: [
            {
              name: 'paymentId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'PAY-20260101-001',
            },
          ],
          responses: {
            200: { description: 'Settlement found' },
            404: { description: 'Settlement not found' },
          },
        },
      },
      '/settlements/service/{serviceId}': {
        get: {
          summary: 'Get all settlements for a service',
          tags: ['Settlements'],
          parameters: [{ $ref: '#/components/parameters/MonitoringServiceIdParam' }],
          responses: { 200: { description: 'Settlements retrieved' } },
        },
      },
      '/settlements/{id}/breakdown': {
        get: {
          summary: 'Get the detailed per-rule calculation breakdown for a settlement',
          tags: ['Settlements'],
          parameters: [{ $ref: '#/components/parameters/SettlementIdParam' }],
          responses: {
            200: { description: 'Breakdown retrieved' },
            404: { description: 'Settlement not found' },
          },
        },
      },
      '/settlements/{id}/recalculate': {
        post: {
          summary: 'Recalculate an existing settlement (re-runs engine, creates new record)',
          tags: ['Settlements'],
          parameters: [{ $ref: '#/components/parameters/SettlementIdParam' }],
          responses: {
            200: { description: 'Settlement recalculated' },
            404: { description: 'Settlement not found' },
          },
        },
      },
      '/settlements/{id}': {
        get: {
          summary: 'Get settlement by ID',
          tags: ['Settlements'],
          parameters: [{ $ref: '#/components/parameters/SettlementIdParam' }],
          responses: {
            200: { description: 'Settlement found' },
            404: { description: 'Settlement not found' },
          },
        },
      },
      '/settlements': {
        get: {
          summary: 'List settlements with pagination and filters',
          tags: ['Settlements'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'Draft',
                  'Calculated',
                  'RequiresReview',
                  'Approved',
                  'Rejected',
                  'ReadyForPayment',
                  'PaymentPending',
                  'Paid',
                  'Failed',
                ],
              },
            },
            {
              name: 'serviceId',
              in: 'query',
              schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
            },
            {
              name: 'contractId',
              in: 'query',
              schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
            },
            { name: 'currency', in: 'query', schema: { type: 'string', example: 'USD' } },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['calculatedAt', 'finalPayableAmount', 'totalCredit', 'createdAt'],
                default: 'calculatedAt',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            },
          ],
          responses: { 200: { description: 'Settlements retrieved' } },
        },
      },
      '/policies': {
        post: {
          summary: 'Create a new business policy',
          tags: ['Policies'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Policy' } } },
          },
          responses: {
            201: { description: 'Policy created successfully' },
            400: { description: 'Validation error' },
            409: { description: 'Policy code already exists' },
          },
        },
        get: {
          summary: 'List policies with pagination and filters',
          tags: ['Policies'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
          ],
          responses: { 200: { description: 'Policies retrieved successfully' } },
        },
      },
      '/policies/{id}': {
        get: {
          summary: 'Get policy by ID',
          tags: ['Policies'],
          parameters: [{ $ref: '#/components/parameters/PolicyIdParam' }],
          responses: { 200: { description: 'Policy found' }, 404: { description: 'Policy not found' } },
        },
        patch: {
          summary: 'Update policy (archives old version in version history)',
          tags: ['Policies'],
          parameters: [{ $ref: '#/components/parameters/PolicyIdParam' }],
          responses: { 200: { description: 'Policy updated' }, 404: { description: 'Policy not found' } },
        },
      },
      '/policies/{id}/status': {
        patch: {
          summary: 'Enable or disable a policy',
          tags: ['Policies'],
          parameters: [{ $ref: '#/components/parameters/PolicyIdParam' }],
          responses: { 200: { description: 'Policy status updated' }, 404: { description: 'Policy not found' } },
        },
      },
      '/policies/service/{serviceId}': {
        get: {
          summary: 'Get applicable policies for a service (service-specific + global)',
          tags: ['Policies'],
          parameters: [{ $ref: '#/components/parameters/MonitoringServiceIdParam' }],
          responses: { 200: { description: 'Policies retrieved' } },
        },
      },
      '/policies/evaluate/{settlementId}': {
        post: {
          summary: 'Evaluate a calculated settlement against configured policies',
          tags: ['Policy Evaluation'],
          parameters: [{ $ref: '#/components/parameters/SettlementIdParam' }],
          responses: {
            200: { description: 'Settlement evaluated successfully' },
            400: { description: 'Settlement not in calculated status' },
            404: { description: 'Settlement not found' },
          },
        },
      },
      '/policies/decisions': {
        get: {
          summary: 'List historical policy decisions',
          tags: ['Policy Evaluation'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
          ],
          responses: { 200: { description: 'Decisions retrieved' } },
        },
      },
      '/policies/decisions/{id}': {
        get: {
          summary: 'Get policy decision by ID',
          tags: ['Policy Evaluation'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Decision found' }, 404: { description: 'Decision not found' } },
        },
      },
      '/policies/decisions/settlement/{settlementId}': {
        get: {
          summary: 'Get policy decision history for a settlement',
          tags: ['Policy Evaluation'],
          parameters: [{ $ref: '#/components/parameters/SettlementIdParam' }],
          responses: { 200: { description: 'Settlement decision history retrieved' } },
        },
      },
      '/approvals': {
        get: {
          summary: 'List approval requests with pagination and filters',
          tags: ['Approvals'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
          ],
          responses: { 200: { description: 'Approvals retrieved' } },
        },
      },
      '/approvals/pending': {
        get: {
          summary: 'List all pending approval requests awaiting human review',
          tags: ['Approvals'],
          parameters: [
            { $ref: '#/components/parameters/PageQuery' },
            { $ref: '#/components/parameters/LimitQuery' },
          ],
          responses: { 200: { description: 'Pending approvals retrieved' } },
        },
      },
      '/approvals/{id}': {
        get: {
          summary: 'Get approval request details by ID',
          tags: ['Approvals'],
          parameters: [{ $ref: '#/components/parameters/ApprovalIdParam' }],
          responses: { 200: { description: 'Approval found' }, 404: { description: 'Approval not found' } },
        },
      },
      '/approvals/{id}/approve': {
        post: {
          summary: 'Approve a pending settlement approval request',
          tags: ['Approvals'],
          parameters: [{ $ref: '#/components/parameters/ApprovalIdParam' }],
          responses: {
            200: { description: 'Settlement approved' },
            400: { description: 'Already approved/rejected or settlement blocked' },
            404: { description: 'Approval request not found' },
          },
        },
      },
      '/approvals/{id}/reject': {
        post: {
          summary: 'Reject a pending settlement approval request',
          tags: ['Approvals'],
          parameters: [{ $ref: '#/components/parameters/ApprovalIdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['rejectionReason'],
                  properties: {
                    rejectionReason: { type: 'string', example: 'Evidence insufficient' },
                    comments: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Settlement rejected' },
            400: { description: 'Missing rejection reason or invalid status' },
            404: { description: 'Approval request not found' },
          },
        },
      },
      '/approvals/{id}/cancel': {
        post: {
          summary: 'Cancel a pending approval request',
          tags: ['Approvals'],
          parameters: [{ $ref: '#/components/parameters/ApprovalIdParam' }],
          responses: { 200: { description: 'Approval cancelled' } },
        },
      },
      '/settlements/{id}/audit': {
        get: {
          summary: 'Get complete audit trail for a settlement',
          tags: ['Settlements'],
          parameters: [{ $ref: '#/components/parameters/SettlementIdParam' }],
          responses: { 200: { description: 'Audit trail retrieved' }, 400: { description: 'Invalid settlement ID' } },
        },
      },
    },
  },
  apis: [],
});
