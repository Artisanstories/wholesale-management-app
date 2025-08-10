// server/routes/customers.js
const express = require('express');
const router = express.Router();

const TAGS = {
  approved: ['wholesale-approved', 'approved', 'wholesale'],
  pending: ['wholesale-pending', 'pending'],
  rejected: ['wholesale-rejected', 'rejected'],
};

function mapStatusFromCustomer(c) {
  const tagList = (c.tags || '').split(',').map((t) => t.trim().toLowerCase());
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
    const matchQ =
      !q ||
      [c.first_name, c.last_name, c.email, c.default_address?.company, c.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));

    const clientShape = toClientCustomer(c);
    const matchS = statuses.length === 0 || statuses.includes(clientShape.status);
    const matchT =
      tags.length === 0 ||
      tags.every((t) => clientShape.tags.map((x) => x.toLowerCase()).includes(t));

    return matchQ && matchS && matchT;
  });
}

router.get('/', async (req, res) => {
  const shopify = req.shopify;

  try {
    // Load online session via SDK helper (works with JWT)
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      const shop = String(req.query.shop || req.headers['x-shopify-shop-domain'] || '');
      return res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth?shop=${encodeURIComponent(shop)}`)
        .json({ error: 'Unauthorized' });
    }

    const session = await shopify.config.sessionStorage.loadSession(sessionId);
    if (!session) {
      const shop = String(req.query.shop || req.headers['x-shopify-shop-domain'] || '');
      return res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth?shop=${encodeURIComponent(shop)}`)
        .json({ error: 'Unauthorized' });
    }

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
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 250);

    const admin = new shopify.clients.Rest({ session });

    let collected = [];
    let pageInfo;
    let pagesFetched = 0;
    const maxPages = 2;

    do {
      let resp;
      try {
        resp = await admin.get({
          path: 'customers',
          query: {
            limit,
            fields: 'id,first_name,last_name,email,created_at,note,tags,default_address',
            page_info: pageInfo?.nextPage?.query?.page_info,
          },
        });
      } catch (apiErr) {
        const status = apiErr?.response?.code || apiErr?.status || 500;
        const body = apiErr?.response?.body || apiErr?.message;
        console.error('Shopify REST customers error:', status, body);

        if (status === 401) {
          return res
            .status(401)
            .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
            .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth?shop=${encodeURIComponent(session.shop)}`)
            .json({ error: 'Reauthorize required' });
        }
        return res.status(500).json({ error: 'Shopify API error', details: body });
      }

      const items = Array.isArray(resp?.body?.customers) ? resp.body.customers : [];
      collected.push(...filterCustomers(items, { search, statuses, tags }));

      pageInfo = resp.pageInfo;
      pagesFetched += 1;
    } while (pageInfo?.nextPage && pagesFetched < maxPages);

    return res.json(collected.map(toClientCustomer));
  } catch (err) {
    console.error('/api/customers fatal error:', err);
    return res.status(500).json({ error: 'Failed to load customers' });
  }
});

module.exports = router;
