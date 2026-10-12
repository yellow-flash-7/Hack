import dns from 'dns';
import { URL } from 'url';
import http from 'http';
import https from 'https';

// Check if an IP address belongs to private/internal ranges
export function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip === '0.0.0.0' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') // Link-local / AWS metadata
  ) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  // IPv6 loopback / unique local
  if (ip === '::1' || ip.startsWith('fc00:') || ip.startsWith('fe80:')) {
    return true;
  }

  return false;
}

export interface SafeFetchResult {
  content: string;
  contentType: string;
  status: number;
}

export async function safeFetchUrl(rawUrl: string, maxBytes = 5 * 1024 * 1024, timeoutMs = 7000): Promise<SafeFetchResult> {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http and https are allowed.`);
  }

  // Resolve DNS to verify IP is not internal
  const hostname = parsed.hostname;
  const lookup = await dns.promises.lookup(hostname);
  if (isPrivateIp(lookup.address)) {
    throw new Error(`SSRF Blocked: Destination IP ${lookup.address} resolves to a private or internal network.`);
  }

  return new Promise((resolve, reject) => {
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(
      rawUrl,
      {
        headers: { 'User-Agent': 'ELOV-Verification-Bot/1.0' },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`HTTP error ${res.statusCode} when fetching ${rawUrl}`));
        }

        const contentType = res.headers['content-type'] || 'text/plain';
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy();
            return reject(new Error(`Response exceeded maximum allowed size of ${maxBytes} bytes.`));
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({
            content: body,
            contentType,
            status: res.statusCode || 200,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms while fetching ${rawUrl}`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}
