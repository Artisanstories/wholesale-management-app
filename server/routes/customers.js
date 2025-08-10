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

function headerShop(req) {
  const h = (req.headers['x-shopify-shop-domain'] || '').toString();
  return h || '';
}

async function decodeJwt(shopify, req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.slice('Bearer '.length);
    return await shopify.utils.decodeSessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Load the **online** session by JWT (no cookies).
 * If missing, tell the client to re-authorize.
 */
async function loadOnlineSession(shopify, req, res) {
  const payload = await decodeJwt(shopify, req);
  if (!payload) return null;

  const dest = (payload.dest || '').toString().replace(/^https?:\/\//, '');
  const sessionId = shopify.session.getJwtSessionId(dest, payload.sub);
  const session = await shopify.config.sessionStorage.loadSession(sessionId);

  if (!session) {
    const shop = dest || headerShop(req);
    res
      .status(401)
      .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
      .set(
        'X-Shopify-API-Request-Failure-Reauthorize-Url',
        `/api/auth/inline?shop=${encodeURIComponent(shop)}`
      )
      .json({ error: 'Reauthorize required' });
    return null;
  }
  return session;
}

router.get('/', async (req, res) => {
  const shopify = req.shopify;

  try {
    const session = await loadOnlineSession(shopify, req, res);
    if (!session) return; // response already sent with 401 + reauth headers

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
          const shop = session.shop || headerShop(req);
          return res
            .status(401)
            .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
            .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth/inline?shop=${encodeURIComponent(shop)}`)
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
