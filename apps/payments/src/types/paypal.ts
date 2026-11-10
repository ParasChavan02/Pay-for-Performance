export interface PayPalOAuthTokenResponse {
  scope: string;
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  nonce: string;
}

export interface PayPalMoney {
  currency_code: string;
  value: string;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

export interface PayPalCreateOrderRequest {
  intent: 'AUTHORIZE' | 'CAPTURE';
  purchase_units: Array<{
    reference_id?: string;
    description?: string;
    custom_id?: string;
    amount: {
      currency_code: string;
      value: string;
      breakdown?: Record<string, PayPalMoney>;
    };
  }>;
  application_context?: {
    brand_name?: string;
    locale?: string;
    landing_page?: 'LOGIN' | 'BILLING' | 'NO_PREFERENCE';
    shipping_preference?: 'GET_FROM_FILE' | 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS';
    user_action?: 'CONTINUE' | 'PAY_NOW';
    return_url?: string;
    cancel_url?: string;
  };
}

export interface PayPalCreateOrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  intent: 'AUTHORIZE' | 'CAPTURE';
  links: PayPalLink[];
  create_time?: string;
}

export interface PayPalAuthorization {
  id: string;
  status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'PARTIALLY_CAPTURED' | 'VOIDED' | 'PENDING';
  amount: PayPalMoney;
  seller_protection?: {
    status: string;
    dispute_categories?: string[];
  };
  expiration_time?: string;
  links?: PayPalLink[];
  create_time?: string;
  update_time?: string;
}

export interface PayPalAuthorizeOrderResponse {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_COMPLETED' | 'PENDING';
  payment_source?: any;
  purchase_units: Array<{
    reference_id?: string;
    payments?: {
      authorizations?: PayPalAuthorization[];
    };
  }>;
  links?: PayPalLink[];
}

export interface PayPalCaptureAuthorizationRequest {
  amount: PayPalMoney;
  final_capture: boolean;
  invoice_id?: string;
  note_to_payer?: string;
}

export interface PayPalCaptureResponse {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED' | 'FAILED';
  status_details?: {
    reason?: string;
  };
  amount: PayPalMoney;
  final_capture: boolean;
  seller_protection?: {
    status: string;
  };
  seller_receivable_breakdown?: {
    gross_amount: PayPalMoney;
    paypal_fee?: PayPalMoney;
    net_amount?: PayPalMoney;
  };
  links?: PayPalLink[];
  create_time?: string;
  update_time?: string;
}

export interface PayPalRefundRequest {
  amount?: PayPalMoney;
  invoice_id?: string;
  note_to_payer?: string;
}

export interface PayPalRefundResponse {
  id: string;
  status: 'CANCELLED' | 'PENDING' | 'COMPLETED' | 'FAILED';
  status_details?: {
    reason?: string;
  };
  amount: PayPalMoney;
  note_to_payer?: string;
  seller_payable_breakdown?: {
    gross_amount: PayPalMoney;
    paypal_fee?: PayPalMoney;
    net_amount?: PayPalMoney;
    total_refunded_amount?: PayPalMoney;
  };
  links?: PayPalLink[];
  create_time?: string;
  update_time?: string;
}

export interface PayPalApiErrorDetails {
  field?: string;
  value?: string;
  location?: string;
  issue: string;
  description: string;
}

export interface PayPalApiErrorResponse {
  name: string;
  message: string;
  debug_id?: string;
  details?: PayPalApiErrorDetails[];
  links?: PayPalLink[];
}
