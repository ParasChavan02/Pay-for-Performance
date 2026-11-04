-- ==============================================================================
-- Pay-for-Performance Database Schema (PostgreSQL DDL)
-- Module: PayPal Payment Integration & SLA Settlement Execution
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) UNIQUE,
    authorization_id VARCHAR(64) UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    authorized_amount NUMERIC(10, 2) NOT NULL,
    captured_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT,
    approval_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_authorization_id ON payments(authorization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 2. Settlements Table (Person 3 SLA Settlement Contract)
CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(64) PRIMARY KEY,
    payment_id VARCHAR(64) NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    authorized_amount NUMERIC(10, 2) NOT NULL,
    credit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    capture_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    decision VARCHAR(32) NOT NULL, -- APPROVED, REJECTED, PENDING_REVIEW
    approved_by VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'STAGED', -- STAGED, EXECUTED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_settlements_payment_id ON settlements(payment_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- 3. Captures Table
CREATE TABLE IF NOT EXISTS captures (
    id VARCHAR(64) PRIMARY KEY,
    payment_id VARCHAR(64) NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    settlement_id VARCHAR(64) REFERENCES settlements(id) ON DELETE RESTRICT,
    paypal_capture_id VARCHAR(64) UNIQUE NOT NULL,
    paypal_authorization_id VARCHAR(64) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL, -- COMPLETED, PENDING, DECLINED, PARTIALLY_REFUNDED, REFUNDED
    final_capture BOOLEAN NOT NULL DEFAULT true,
    idempotency_key VARCHAR(128) UNIQUE,
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_captures_payment_id ON captures(payment_id);
CREATE INDEX IF NOT EXISTS idx_captures_paypal_capture_id ON captures(paypal_capture_id);
CREATE INDEX IF NOT EXISTS idx_captures_idempotency_key ON captures(idempotency_key);

-- 4. Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
    id VARCHAR(64) PRIMARY KEY,
    payment_id VARCHAR(64) NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    paypal_capture_id VARCHAR(64) NOT NULL,
    paypal_refund_id VARCHAR(64) UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL, -- COMPLETED, PENDING, CANCELLED, FAILED
    reason TEXT,
    idempotency_key VARCHAR(128) UNIQUE,
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_paypal_capture_id ON refunds(paypal_capture_id);
CREATE INDEX IF NOT EXISTS idx_refunds_paypal_refund_id ON refunds(paypal_refund_id);

-- 5. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    target_type VARCHAR(32) NOT NULL, -- CAPTURE, REFUND, CREATE_ORDER, AUTHORIZE
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING', -- PROCESSING, COMPLETED, FAILED
    response_status_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status ON idempotency_keys(status);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    payment_id VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    details JSONB NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_payment_id ON audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
