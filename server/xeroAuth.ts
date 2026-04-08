import { Router, Request, Response } from "express";
import { db } from "./db";
import { systemSettings } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "./routes";
import { logAudit } from "./auditLog";
import { getClientId } from "./clientContext";

// Xero OAuth 2.0 configuration
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com";
const XERO_SCOPES = "openid profile email offline_access accounting.invoices.read accounting.settings.read";

function getXeroRedirectUri() {
  return process.env.NODE_ENV === "production"
    ? `${process.env.PRODUCTION_URL}/auth/xero/callback`
    : "http://localhost:5000/auth/xero/callback";
}

// Store/retrieve tokens from system_settings (scoped by clientId)
async function getXeroTokens(clientId: number): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tenantId: string;
} | null> {
  const result = await db
    .select()
    .from(systemSettings)
    .where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_tokens")));
  if (result.length === 0 || !result[0].value) return null;
  try {
    return JSON.parse(result[0].value);
  } catch {
    return null;
  }
}

async function saveXeroTokens(clientId: number, tokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tenantId: string;
}) {
  const existing = await db
    .select()
    .from(systemSettings)
    .where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_tokens")));

  const value = JSON.stringify(tokens);
  if (existing.length > 0) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: new Date() })
      .where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_tokens")));
  } else {
    await db.insert(systemSettings).values({ clientId, key: "xero_tokens", value });
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    console.error("Xero token refresh failed:", await res.text());
    return null;
  }
  return res.json();
}

// Get a valid access token, refreshing if needed
async function getValidAccessToken(clientId: number): Promise<{ accessToken: string; tenantId: string } | null> {
  const tokens = await getXeroTokens(clientId);
  if (!tokens) return null;

  // If token expires in less than 5 minutes, refresh
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (!refreshed) return null;

    const newTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      tenantId: tokens.tenantId,
    };
    await saveXeroTokens(clientId, newTokens);
    return { accessToken: newTokens.accessToken, tenantId: newTokens.tenantId };
  }

  return { accessToken: tokens.accessToken, tenantId: tokens.tenantId };
}

export function registerXeroAuthRoutes(router: Router) {
  // ─── Initiate Xero OAuth ────────────────────────
  router.get("/auth/xero", isAuthenticated, (_req: Request, res: Response) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.XERO_CLIENT_ID!,
      redirect_uri: getXeroRedirectUri(),
      scope: XERO_SCOPES,
      state: "xero-connect",
    });
    res.redirect(`${XERO_AUTH_URL}?${params}`);
  });

  // ─── Xero OAuth Callback ───────────────────────
  router.get("/auth/xero/callback", async (req: Request, res: Response) => {
    const { code, error } = req.query;
    const clientUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:5173";

    if (error || !code) {
      return res.redirect(`${clientUrl}/settings?xero=error&message=${error ?? "no_code"}`);
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(XERO_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: getXeroRedirectUri(),
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("Xero token exchange failed:", errText);
        return res.redirect(`${clientUrl}/settings?xero=error&message=token_exchange_failed`);
      }

      const tokenData = await tokenRes.json();

      // Get the tenant (organisation) ID
      const connectionsRes = await fetch(`${XERO_API_BASE}/connections`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const connections = await connectionsRes.json();

      if (!connections.length) {
        return res.redirect(`${clientUrl}/settings?xero=error&message=no_organisation`);
      }

      const tenantId = connections[0].tenantId;
      const tenantName = connections[0].tenantName;

      const clientId = getClientId(req);
      await saveXeroTokens(clientId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        tenantId,
      });

      // Save org name
      const existing = await db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_org_name")));
      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({ value: tenantName, updatedAt: new Date() })
          .where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_org_name")));
      } else {
        await db.insert(systemSettings).values({ clientId, key: "xero_org_name", value: tenantName });
      }

      res.redirect(`${clientUrl}/settings?xero=connected&org=${encodeURIComponent(tenantName)}`);
    } catch (err: any) {
      console.error("Xero OAuth error:", err);
      res.redirect(`${clientUrl}/settings?xero=error&message=${err.message}`);
    }
  });

  // ─── Xero Connection Status ─────────────────────
  router.get("/api/xero/status", isAuthenticated, async (req, res) => {
    const clientId = getClientId(req);
    const tokens = await getXeroTokens(clientId);
    const orgName = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_org_name")));

    res.json({
      connected: !!tokens,
      organisationName: orgName[0]?.value ?? null,
      tokenExpiry: tokens?.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
    });
  });

  // ─── Disconnect Xero ────────────────────────────
  router.post("/api/xero/disconnect", isAuthenticated, async (req, res) => {
    const clientId = getClientId(req);
    await db.delete(systemSettings).where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_tokens")));
    await db.delete(systemSettings).where(and(eq(systemSettings.clientId, clientId), eq(systemSettings.key, "xero_org_name")));
    logAudit(req, "XERO_DISCONNECTED");
    res.json({ ok: true });
  });

  // ─── Pull Sales by Item Report from Xero API ───
  router.get("/api/xero/sales-report", isAuthenticated, async (req, res) => {
    try {
      const { fromDate, toDate } = req.query;
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "fromDate and toDate are required" });
      }

      const auth = await getValidAccessToken(getClientId(req));
      if (!auth) {
        return res.status(401).json({
          message: "Xero not connected. Please connect via Settings.",
          notConnected: true,
        });
      }

      // Fetch all ACCREC invoices for the period (paginated)
      let allInvoices: any[] = [];
      let page = 1;
      while (true) {
        const invoicesUrl = `${XERO_API_BASE}/api.xro/2.0/Invoices?where=Type%3D%22ACCREC%22%20AND%20Date%3E%3DDateTime(${String(fromDate).replace(/-/g, "%2C")})%20AND%20Date%3C%3DDateTime(${String(toDate).replace(/-/g, "%2C")})&page=${page}`;

        const invoiceRes = await fetch(invoicesUrl, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Xero-Tenant-Id": auth.tenantId,
            Accept: "application/json",
          },
        });

        if (!invoiceRes.ok) {
          const errBody = await invoiceRes.text();
          console.error("Xero API error:", invoiceRes.status, errBody);
          if (invoiceRes.status === 401) {
            return res.status(401).json({
              message: "Xero token expired. Please reconnect via Settings.",
              notConnected: true,
            });
          }
          return res.status(502).json({ message: "Xero API error", detail: errBody });
        }

        const data = await invoiceRes.json();
        const invoices = data.Invoices ?? [];
        allInvoices = allInvoices.concat(invoices);
        if (invoices.length < 100) break; // Xero returns up to 100 per page
        page++;
      }

      // Fetch full details for each invoice and collect individual line items
      const lineItems: {
        invoiceNumber: string;
        invoiceDate: string;
        contactName: string;
        itemCode: string;
        description: string;
        quantity: number;
        unitPrice: number;
        lineAmount: number;
      }[] = [];

      for (const inv of allInvoices) {
        const fullInvRes = await fetch(
          `${XERO_API_BASE}/api.xro/2.0/Invoices/${inv.InvoiceID}`,
          {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              "Xero-Tenant-Id": auth.tenantId,
              Accept: "application/json",
            },
          }
        );

        if (!fullInvRes.ok) continue;
        const fullInvData = await fullInvRes.json();
        const fullInv = fullInvData.Invoices?.[0];
        if (!fullInv) continue;

        for (const line of fullInv.LineItems ?? []) {
          if (!line.ItemCode || !line.Quantity) continue;
          lineItems.push({
            invoiceNumber: fullInv.InvoiceNumber ?? fullInv.InvoiceID,
            invoiceDate: fullInv.DateString ?? fullInv.Date,
            contactName: fullInv.Contact?.Name ?? "",
            itemCode: line.ItemCode,
            description: line.Description ?? "",
            quantity: line.Quantity ?? 0,
            unitPrice: line.UnitAmount ?? 0,
            lineAmount: line.LineAmount ?? 0,
          });
        }
      }

      // Also build aggregated summary for preview display
      const aggregated: Record<string, { itemCode: string; description: string; quantity: number; invoiceCount: number }> = {};
      for (const li of lineItems) {
        if (!aggregated[li.itemCode]) {
          aggregated[li.itemCode] = {
            itemCode: li.itemCode,
            description: li.description,
            quantity: 0,
            invoiceCount: 0,
          };
        }
        aggregated[li.itemCode].quantity += li.quantity;
        aggregated[li.itemCode].invoiceCount++;
      }

      const summary = Object.values(aggregated).sort((a, b) =>
        a.itemCode.localeCompare(b.itemCode)
      );

      logAudit(req as any, "XERO_REPORT_PULLED", {
        detail: `Pulled sales data from ${fromDate} to ${toDate}: ${lineItems.length} line items from ${allInvoices.length} invoices`,
      });

      res.json({
        fromDate,
        toDate,
        invoiceCount: allInvoices.length,
        lineItemCount: lineItems.length,
        // Individual line items (for commit — each becomes a stock transaction)
        lineItems,
        // Aggregated summary (for preview display)
        summary,
      });
    } catch (err: any) {
      console.error("Xero sales report error:", err);
      res.status(500).json({ message: "Failed to fetch Xero sales data", error: err.message });
    }
  });

  return router;
}
