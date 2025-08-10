// server/routes/customers.js
const express = require('express');
const router = express.Router();

const TAGS = {
  approved: ['wholesale-approved', 'approved', 'wholesale'],
  pending: ['wholesale-pending', 'pending'],
  rejected: ['wholesale-rejected', 'rejected'],
};

function mapStatusFromCustomer(c) {
  const tagList = (c.tags || '').split(',').map(t => t.trim().toLowerCase());
  if (tagList.some(t => TAGS.approved.includes(t))) return 'approved';
  if (tagList.some(t => TAGS.rejected.includes(t))) return 'rejected';
  if (tagList.some(t => TAGS.pending.includes(t))) return 'pending';
  return 'pending';
}

function toClientCustomer(c) {
  return {
    id: String(c.id),
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Customer',
    email: c.email || '',
    company: c.default_address?.company || c.note || '',
    tags: (c.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    status: mapStatusFromCustomer(c),
    createdAt: c.created_at,
  };
}

function filterCustomers(list, { search = '', statuses = [], tags = [] }) {
  const q = search.trim().toLowerCase();
  return list.filter(c => {
    const matchQ =
      !q ||
      [c.first_name, c.last_name, c.email, c.default_address?.company, c.note]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));

    const clientShape = toClientCustomer(c);
    const matchS = statuses.length === 0 || statuses.includes(clientShape.status);
    const matchT =
      tags.length === 0 ||
      tags.every(t => clientShape.tags.map(x => x.toLowerCase()).includes(t));

    return matchQ && matchS && matchT;
  });
}

// Extract shop domain from the JWT (so we can build a reauth URL)
async function getShopFromAuthHeader(shopify, req) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : '';
    if (!token) return null;
    const payload = await shopify.utils.decodeSessionToken(token);
    const dest = (payload.dest || '').toString(); // e.g. https://{shop}.myshopify.com
    return dest.replace(/^https?:\/\//, '');
  } catch {
    return null;
  }
}

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const shopify = req.shopify;

    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    let session = null;
    if (sessionId) {
      session = await shopify.config.sessionStorage.loadSession(sessionId);
    }

    if (!session) {
      // No session in memory (e.g., after a deploy). Tell client to reauth via *inline* pop-out route.
      const shop = (await getShopFromAuthHeader(shopify, req)) || '';
      res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set(
          'X-Shopify-API-Request-Failure-Reauthorize-Url',
          `/api/auth/inline?shop=${encodeURIComponent(shop)}`
        )
        .json({ error: 'Unauthorized: no active session' });
      return;
    }

    const search = String(req.query.search || '');
    const statuses = String(req.query.status || '').split(',').map(s => s.trim()).filter(Boolean);
    const tags = String(req.query.tags || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 250);

    const admin = new shopify.clients.Rest({ session });

    let collected = [];
    let pageInfo;
    let pagesFetched = 0;
    const maxPages = 2;

    do {
      const resp = await admin.get({
        path: 'customers',
        query: {
          limit,
          fields: 'id,first_name,last_name,email,created_at,note,tags,default_address',
          page_info: pageInfo?.nextPage?.query?.page_info,
        },
      });

      const items = Array.isArray(resp?.body?.customers) ? resp.body.customers : [];
      collected.push(...filterCustomers(items, { search, statuses, tags }));

      pageInfo = resp.pageInfo;
      pagesFetched += 1;
    } while (pageInfo?.nextPage && pagesFetched < maxPages);

    res.json(collected.map(toClientCustomer));
  } catch (err) {
    console.error('/api/customers error', err);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});

module.exports = router;
