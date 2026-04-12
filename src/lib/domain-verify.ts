import dns from "node:dns/promises";

// Domain verification for email deliverability. Before a user can send
// from their own domain (e.g. sarah@hershop.com instead of noreply@smbaiops.com),
// they need SPF and DKIM records. This module checks those DNS records
// and reports what's missing.

export interface DnsCheckResult {
  domain: string;
  spf: { ok: boolean; records: string[]; hint?: string };
  dkim: { ok: boolean; records: string[]; hint?: string };
  dmarc: { ok: boolean; records: string[]; hint?: string };
  allPassing: boolean;
}

/**
 * Check a domain for SPF, DKIM, and DMARC records. The DKIM selector
 * defaults to the Postmark selector (20xxxxpm) but can be overridden.
 */
export async function checkDomainRecords(
  domain: string,
  opts: { dkimSelector?: string } = {}
): Promise<DnsCheckResult> {
  const selector = opts.dkimSelector || "pm";
  const result: DnsCheckResult = {
    domain,
    spf: { ok: false, records: [] },
    dkim: { ok: false, records: [] },
    dmarc: { ok: false, records: [] },
    allPassing: false,
  };

  try {
    const txtRecords = await dns.resolveTxt(domain);
    const flat = txtRecords.map((r) => r.join(""));
    const spfRecords = flat.filter((r) => r.startsWith("v=spf1"));
    result.spf.records = spfRecords;
    if (spfRecords.length > 0) {
      const hasInclude =
        spfRecords.some((r) => r.includes("include:sendgrid.net")) ||
        spfRecords.some((r) => r.includes("include:_spf.google.com")) ||
        spfRecords.some((r) => r.includes("include:"));
      result.spf.ok = hasInclude;
      if (!hasInclude) {
        result.spf.hint =
          "SPF record exists but may not include your email provider. Add include:sendgrid.net for SendGrid.";
      }
    } else {
      result.spf.hint =
        'Add a TXT record: v=spf1 include:sendgrid.net ~all';
    }
  } catch {
    result.spf.hint =
      'No TXT records found. Add: v=spf1 include:sendgrid.net ~all';
  }

  try {
    const dkimHost = `${selector}._domainkey.${domain}`;
    const dkimRecords = await dns.resolveTxt(dkimHost);
    const flat = dkimRecords.map((r) => r.join(""));
    result.dkim.records = flat;
    result.dkim.ok = flat.some((r) => r.includes("v=DKIM1") || r.includes("k=rsa"));
    if (!result.dkim.ok) {
      result.dkim.hint = `DKIM record at ${dkimHost} doesn't contain a valid key. Check your email provider's setup instructions.`;
    }
  } catch {
    result.dkim.hint = `No DKIM record found at ${selector}._domainkey.${domain}. Add the DKIM TXT record from your email provider's dashboard.`;
  }

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = dmarcRecords.map((r) => r.join(""));
    result.dmarc.records = flat;
    result.dmarc.ok = flat.some((r) => r.startsWith("v=DMARC1"));
    if (!result.dmarc.ok) {
      result.dmarc.hint =
        'DMARC record exists but is invalid. Expected format: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com';
    }
  } catch {
    result.dmarc.hint =
      'Add a TXT record at _dmarc.yourdomain.com: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com';
  }

  result.allPassing = result.spf.ok && result.dkim.ok && result.dmarc.ok;
  return result;
}
