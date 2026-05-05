import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { intelligenceAPI } from '../services/IntelligenceAPI';
import { supabase } from '../config/supabase';

const router = Router();

type CanonicalStreamItem = {
  source_message_id: string;
  source_group_name?: string | null;
  listing_type?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  area?: string | null;
  sub_area?: string | null;
  price?: number | null;
  price_type?: string | null;
  size_sqft?: number | null;
  bhk?: number | null;
  property_type?: string | null;
  primary_contact_name?: string | null;
  primary_contact_number?: string | null;
  primary_contact_wa?: string | null;
  message_timestamp?: string | null;
  created_at?: string | null;
  stream_source?: 'parsed_listing' | 'message_feed';
};

function jidLabel(remoteJid: string) {
  return String(remoteJid || '').replace(/@g\.us$|@s\.whatsapp\.net$/g, '');
}

function deriveListingType(text: string) {
  if (/(requirement|wanted|looking for|need\b)/i.test(text)) return 'requirement';
  if (/(rent|lease|leave.?and.?license|l&l)/i.test(text)) return 'rental';
  if (/(sale|sell|ownership|available)/i.test(text)) return 'listing';
  return 'message';
}

function deriveTitle(text: string, remoteJid: string) {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || jidLabel(remoteJid);
}

function mapMessageToStreamItem(row: any): CanonicalStreamItem {
  const text = String(row?.text || '').trim();

  return {
    source_message_id: String(row.id),
    source_group_name: jidLabel(String(row.remote_jid || '')),
    listing_type: deriveListingType(text),
    title: deriveTitle(text, String(row.remote_jid || '')),
    description: text || 'No message body available.',
    message_timestamp: row.timestamp || null,
    created_at: row.timestamp || null,
    stream_source: 'message_feed',
  };
}

async function loadCanonicalStream(req: any, res: any) {
  const user = req.user;
  if (!user?.id) {
    return res.status(400).json({ error: 'User not authenticated' });
  }

  const hours = Math.min(Math.max(Number(req.query.hours || 24), 1), 168);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const city = String(req.query.city || '').trim();
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  try {
    let listingsQuery = supabase
      .from('public_listings')
      .select('source_message_id, source_group_name, listing_type, title, description, location, area, sub_area, price, price_type, size_sqft, bhk, property_type, primary_contact_name, primary_contact_number, primary_contact_wa, message_timestamp, created_at')
      .gte('message_timestamp', since)
      .order('message_timestamp', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (city) {
      listingsQuery = listingsQuery.or(`location.ilike.%${city}%,area.ilike.%${city}%,sub_area.ilike.%${city}%`);
    }

    const { data: listingRows, error: listingsError } = await listingsQuery;
    if (listingsError) {
      return res.status(500).json({ error: listingsError.message || 'Failed to load stream' });
    }

    let messageQuery = supabase
      .from('messages')
      .select('id, remote_jid, text, timestamp')
      .eq('tenant_id', user.id)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(limit * 3);

    if (city) {
      messageQuery = messageQuery.ilike('text', `%${city}%`);
    }

    const { data: messageRows, error: messagesError } = await messageQuery;
    if (messagesError) {
      return res.status(500).json({ error: messagesError.message || 'Failed to load stream' });
    }

    const listingItems: CanonicalStreamItem[] = Array.isArray(listingRows)
      ? listingRows.map((row: any) => ({ ...row, stream_source: 'parsed_listing' as const }))
      : [];

    const usedMessageIds = new Set(listingItems.map((item) => String(item.source_message_id)));
    const messageItems = (Array.isArray(messageRows) ? messageRows : [])
      .filter((row: any) => !usedMessageIds.has(String(row.id)))
      .map(mapMessageToStreamItem);

    const merged = [...listingItems, ...messageItems]
      .sort((a, b) => new Date(b.message_timestamp || b.created_at || 0).getTime() - new Date(a.message_timestamp || a.created_at || 0).getTime())
      .slice(0, limit);

    const mode = listingItems.length > 0
      ? (messageItems.length > 0 ? 'canonical_mixed' : 'parsed_only')
      : 'message_feed';

    return res.json({ success: true, items: merged, mode });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load stream' });
  }
}

router.get('/stream', authMiddleware, async (req, res) => {
  return loadCanonicalStream(req, res);
});

router.get('/mirror', authMiddleware, async (req, res) => {
  return loadCanonicalStream(req, res);
});

router.get('/stream-legacy', authMiddleware, async (req, res) => {
  const hours = Math.min(Math.max(Number(req.query.hours || 24), 1), 168);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const city = String(req.query.city || '').trim();
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  try {
    let query = supabase
      .from('public_listings')
      .select('source_message_id, source_group_name, listing_type, title, description, location, area, sub_area, price, price_type, size_sqft, bhk, property_type, primary_contact_name, primary_contact_number, primary_contact_wa, message_timestamp, created_at')
      .gte('message_timestamp', since)
      .order('message_timestamp', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (city) {
      query = query.or(`location.ilike.%${city}%,area.ilike.%${city}%,sub_area.ilike.%${city}%`);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to load stream' });
    }

    return res.json({ success: true, items: data || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load stream' });
  }
});

router.get('/igr/building', authMiddleware, async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const data = await intelligenceAPI.getLastTransactionForBuilding(name);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to query IGR building transaction' });
  }
});

router.get('/igr/locality', authMiddleware, async (req, res) => {
  const name = String(req.query.name || '').trim();
  const months = Number(req.query.months || 6);

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const data = await intelligenceAPI.getLocalityStats(name, Number.isFinite(months) ? months : 6);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to query IGR locality stats' });
  }
});

export default router;
