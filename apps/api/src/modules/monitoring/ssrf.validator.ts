import dns from 'dns/promises';
import net from 'net';

interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * Checks if an IPv4 address is in private, loopback, or reserved ranges.
 */
function isRestrictedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future use)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in private, loopback, or reserved ranges.
 */
function isRestrictedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback and unspecified
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.1)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.replace('::ffff:', '');
    if (net.isIPv4(ipv4Part)) {
      return isRestrictedIPv4(ipv4Part);
    }
  }

  // Link-local unicast (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Unique local addresses (fc00::/7, fc.. or fd..)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Checks protocol, resolves DNS, and denies access to private or reserved IP spaces.
 */
export async function validateSSRF(targetUrl: string): Promise<SSRFValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'Unsupported protocol. Only HTTP and HTTPS are permitted.' };
  }

  // Check for embedded credentials
  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'Embedded credentials in target URL are prohibited.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  const isTest = process.env.NODE_ENV === 'test';
  const allowLocalhost =
    process.env.ALLOW_LOCALHOST_MONITORING === 'true' || isTest;

  if (allowLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) {
    return { safe: true };
  }

  // In test environments, permit reserved RFC 2606 test and example domains without live internet DNS
  if (
    isTest &&
    (hostname === 'example.com' ||
      hostname.endsWith('.example.com') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.example'))
  ) {
    return { safe: true };
  }

  // Disallow obvious local hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { safe: false, reason: 'Destination hostname is a restricted local or internal domain.' };
  }

  // Check if hostname is directly an IP address
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    if (isRestrictedIPv4(hostname)) {
      return { safe: false, reason: 'Destination resolves to a restricted or private IPv4 address.' };
    }
    return { safe: true };
  } else if (ipVersion === 6) {
    if (isRestrictedIPv6(hostname)) {
      return { safe: false, reason: 'Destination resolves to a restricted or private IPv6 address.' };
    }
    return { safe: true };
  }

  // Resolve DNS to verify all A and AAAA addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return { safe: false, reason: 'Unable to resolve destination domain name.' };
    }

    for (const record of addresses) {
      if (record.family === 4 && isRestrictedIPv4(record.address)) {
        return {
          safe: false,
          reason: 'Destination domain resolves to a restricted or private IPv4 address.',
        };
      }
      if (record.family === 6 && isRestrictedIPv6(record.address)) {
        return {
          safe: false,
          reason: 'Destination domain resolves to a restricted or private IPv6 address.',
        };
      }
    }

    return { safe: true };
  } catch (error) {
    return {
      safe: false,
      reason: `DNS lookup failed for destination domain: ${(error as Error).message}`,
    };
  }
}
