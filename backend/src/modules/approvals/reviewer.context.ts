import { Request } from 'express';

/**
 * Reviewer Context & Security Integration Interface
 *
 * In production, an upstream API gateway or authentication middleware (e.g. Passport, JWT, OAuth2)
 * populates the request context with verified user claims (`req.user` or secure headers `x-user-id`, `x-user-name`).
 *
 * In public APIs without authenticated sessions, client-supplied `reviewerId` inside the request body
 * is NOT trusted as proof of identity.
 *
 * For local development and test environments (`NODE_ENV === 'test' || NODE_ENV === 'development'`),
 * fallback to the request header or explicit test reviewer ID is permitted for convenience.
 */
export interface ReviewerIdentity {
  reviewerId: string;
  reviewerName?: string;
  isMock: boolean;
  source: 'gateway_header' | 'session_user' | 'dev_mock';
}

export function resolveReviewerIdentity(
  req: Request,
  bodyFallback?: { reviewerId?: string; reviewerName?: string }
): ReviewerIdentity {
  // 1. Check for standard authenticated session user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user;
  if (user && (user.id || user._id || user.userId)) {
    return {
      reviewerId: String(user.id || user._id || user.userId),
      reviewerName: user.name || user.username || user.email,
      isMock: false,
      source: 'session_user',
    };
  }

  // 2. Check for trusted upstream gateway headers
  const headerId = req.headers['x-user-id'];
  const headerName = req.headers['x-user-name'];
  if (headerId && typeof headerId === 'string' && headerId.trim().length > 0) {
    return {
      reviewerId: headerId.trim(),
      reviewerName: typeof headerName === 'string' ? headerName.trim() : undefined,
      isMock: false,
      source: 'gateway_header',
    };
  }

  // 3. In dev / test only: fallback to body or mock default
  const isDevOrTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  if (isDevOrTest && bodyFallback?.reviewerId) {
    return {
      reviewerId: bodyFallback.reviewerId,
      reviewerName: bodyFallback.reviewerName ?? 'Development Reviewer',
      isMock: true,
      source: 'dev_mock',
    };
  }

  if (isDevOrTest) {
    return {
      reviewerId: 'SYSTEM_ADMIN_REVIEWER',
      reviewerName: 'Admin (Mock/Dev Reviewer)',
      isMock: true,
      source: 'dev_mock',
    };
  }

  // In production without auth headers, treat as unauthenticated
  return {
    reviewerId: 'UNAUTHENTICATED_REVIEWER',
    reviewerName: 'Unverified Reviewer',
    isMock: false,
    source: 'dev_mock',
  };
}

