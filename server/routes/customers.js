// server/routes/customers.js
const express = require('express');
const router = express.Router();

/* ------------ Helpers ------------- */

const TAGS = {
  approved: ['wholesale-approved', 'approved', 'wholesale'],
  pending: ['wholesale-pending', 'pending'],
  rejected: ['wholesale-rejected', 'rejected'],
};

function mapStatusFromCustomer(cust) {
  const tagList = (cust.tags || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tagList.some((t) => TAGS.approved.includes(t))) return 'approved';
  if (tagList.some((t) => TAGS.rejected.includes(t))) return 'rejected';
  if (tagList.some((t) => TAGS.pending.includes(t))) return 'pending';
  return 'pending';
}

function toClientCustomer(c) {
  return {
    id: String(c.id),
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Customer',
    email: c.email || '',
    company: c.default_address?.company || c.note || '',
    tags: (c.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    status: mapStatusFromCustomer(c),
    createdAt: c.created_at,
  };
}

function filterCustomers(list, { search = '', statuses = [], tags = [] }) {
  const q = search.trim().toLowerCase();
  return list.filter((c) => {
    const haystack = [
      c.first_name,
      c.last_name,
      c.email,
      c.default_address?.company,
      c.note,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    const matchQ = !q || haystack.some((v) => v.includes(q));

    const shaped = toClientCustomer(c);
    const matchS = statuses.length === 0 || statuses.includes(shaped.status);

    const shapedTagsLc = shaped.tags.map((t) => t.toLowerCase());
    const matchT = tags.length === 0 || tags.every((t) => shapedTagsLc.includes(t));

    return matchQ && matchS && matchT;
  });
}

// Try to read shop domain from the JWT (dest/iss)
async function shopFromAuthHeader(shopify, req) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : '';
    if (!token) return '';
    const payload = await shopify.utils.decodeSessionToken(token);
    const url = (payload.dest || payload.iss || '').toString();
    return url.replace(/^https?:\/\//, '');
  } catch {
    return '';
  }
}

/* --------- Auth gate (middleware) ---------- */
/* Requires a Bearer token and loads the session.
   On failure, returns 401 + reauthorize headers Shopify expects. */
router.use(async (req, res, next) => {
  const shopify = req.shopify;

  // Must be called from the embedded app using App Bridge (Bearer token)
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    const shop = (await shopFromAuthHeader(shopify, req)) || String(req.query.shop || '');
    return res
      .status(401)
      .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
      .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`)
      .json({ error: 'Unauthorized: missing token' });
  }

  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      const shop = (await shopFromAuthHeader(shopify, req)) || String(req.query.shop || '');
      return res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`)
        .json({ error: 'Unauthorized: no session id' });
    }

    const session = await req.shopify.config.sessionStorage.loadSession(sessionId);
    if (!session) {
      const shop = (await shopFromAuthHeader(shopify, req)) || '';
      return res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`)
        .json({ error: 'Unauthorized: session not found' });
    }

    req.shopifySession = session;
    return next();
  } catch (e) {
    return next(e);
  }
});

/* --------------- Routes ---------------- */

router.get('/', async (req, res) => {
  const shopify = req.shopify;
  const session = req.shopifySession;

  const search = String(req.query.search || '');
  const statuses = String(req.query.status || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const tags = String(req.query.tags || '')
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  // clamp 1..250
  const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10) || 100, 1), 250);

  const admin = new shopify.clients.Rest({ session });

  try {
    let results = [];
    let pageInfo;
    let pagesFetched = 0;
    const maxPages = 2; // keep it light

    do {
      const query = {
        fields: 'id,first_name,last_name,email,created_at,note,tags,default_address',
      };
      if (!pageInfo?.nextPage) {
        query.limit = limit;
      }
      if (pageInfo?.nextPage?.query?.page_info) {
        query.page_info = pageInfo.nextPage.query.page_info;
      }

      const resp = await admin.get({ path: 'customers', query });
      const items = Array.isArray(resp?.body?.customers) ? resp.body.customers : [];

      results.push(...filterCustomers(items, { search, statuses, tags }));

      pageInfo = resp.pageInfo;
      pagesFetched += 1;
    } while (pageInfo?.nextPage && pagesFetched < maxPages);

    return res.json(results.map(toClientCustomer));
  } catch (apiErr) {
    const status = apiErr?.response?.code || apiErr?.status || 500;
    const details = apiErr?.response?.body || apiErr?.message || 'Shopify API error';

    // On 401 tell the client to reauthorize at top-level
    if (status === 401) {
      const shop = (await shopFromAuthHeader(shopify, req)) || session.shop;
      return res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`)
        .json({ error: 'Reauthorize required' });
    }

    console.error('Shopify REST customers error:', status, details);
    return res.status(500).json({ error: 'Shopify API error', details });
  }
});

module.exports = router;
