import type { StreamItem } from '../services/streamAPI';

type BrokerProfile = {
  id?: string | null;
  name: string;
  phone: string;
};

function compactWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatCompactValue(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function normalizePhoneDigits(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) {
    return digits.slice(-10);
  }
  return digits.slice(-10);
}

function formatPhoneForDisplay(value: string) {
  const digits = normalizePhoneDigits(value);
  if (digits.length !== 10) return compactWhitespace(value) || 'Unknown';
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function formatMoney(listing: StreamItem) {
  const normalizedFromNumber = formatPriceNumber(listing.priceNumeric, listing.type);
  if (normalizedFromNumber) return normalizedFromNumber;

  const parsedFromLabel = parsePriceText(listing.price, listing.type);
  if (parsedFromLabel) return parsedFromLabel;

  return compactWhitespace(listing.price || 'Unspecified');
}

function formatLayout(listing: StreamItem) {
  const parts = [listing.areaSqft ? `${Math.round(listing.areaSqft)} sqft` : '', compactWhitespace(listing.furnishing || '')].filter(Boolean);
  return parts.join(' | ');
}

function formatTags(listing: StreamItem) {
  const tags = Array.isArray(listing.tags) ? listing.tags.filter(Boolean).slice(0, 4) : [];
  return tags.length ? `✅ ${tags.join(' · ')}` : '';
}

function listingLink(id: string) {
  return `https://www.propai.live/listings/${id}`;
}

function formatPriceNumber(value: number | null | undefined, type?: StreamItem['type']) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const suffix = type === 'Rent' ? '/month' : '';

  if (value >= 10000000) {
    return `₹${formatCompactValue(value / 10000000)} Cr${suffix}`;
  }

  if (value >= 100000) {
    return `₹${formatCompactValue(value / 100000)} Lakh${suffix}`;
  }

  if (value >= 1000) {
    return `₹${formatCompactValue(value / 1000)}K${suffix}`;
  }

  return `₹${Math.round(value)}${suffix}`;
}

function parsePriceText(value: string | undefined, type?: StreamItem['type']) {
  const raw = compactWhitespace(value || '');
  if (!raw) return null;

  const match = raw.match(/(\d+(?:\.\d+)?)\s*(cr|crore|l|lac|lakh|k|thousand)?/i);
  if (!match) return null;

  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = String(match[2] || '').toLowerCase();
  if (unit === 'cr' || unit === 'crore') amount *= 10000000;
  else if (unit === 'l' || unit === 'lac' || unit === 'lakh') amount *= 100000;
  else if (unit === 'k' || unit === 'thousand') amount *= 1000;

  if (!unit && type !== 'Rent' && amount < 1000) {
    amount *= 100000;
  }

  return formatPriceNumber(amount, type);
}

export function formatClientMessage(listings: StreamItem[], broker: BrokerProfile, note?: string) {
  const lines = [
    '*PropAI — Property Shortlist*',
    `Sent by: ${broker.name} | ${formatPhoneForDisplay(broker.phone)}`,
  ];

  const trimmedNote = compactWhitespace(note || '');
  if (trimmedNote) {
    lines.push(trimmedNote);
  }

  listings.forEach((listing, index) => {
    const title = compactWhitespace(listing.title || `${listing.bhk} for ${listing.type}`);
    const layout = formatLayout(listing);
    const tags = formatTags(listing);
    lines.push('');
    lines.push(`*${index + 1}. ${title} — ${compactWhitespace(listing.location)}*`);
    lines.push(`📍 ${compactWhitespace(listing.microMarket || listing.location)}`);
    lines.push(`💰 ${formatMoney(listing)}`);
    if (layout) lines.push(`📐 ${layout}`);
    if (tags) lines.push(tags);
    lines.push(`🔗 ${listingLink(listing.id)}`);
  });

  lines.push('', '---', `_Shared via PropAI. Contact ${broker.name} for site visits._`);
  return lines.join('\n');
}

export function formatSelfMessage(listings: StreamItem[], clientPhone: string, broker: BrokerProfile) {
  const lines = [
    '*[PropAI Reference Copy]*',
    `Sent to client: ${formatPhoneForDisplay(clientPhone)}`,
    new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
  ];

  listings.forEach((listing, index) => {
    lines.push('');
    lines.push(`*${index + 1}. ${compactWhitespace(listing.bhk || listing.title || 'Listing')} — ${compactWhitespace(listing.location)}*`);
    lines.push(`Listed by: ${compactWhitespace(listing.source || broker.name)}${listing.sourcePhone ? ` | ${formatPhoneForDisplay(listing.sourcePhone)}` : ''}`);
    lines.push(`Source group: ${compactWhitespace(listing.sourceGroupId || 'Unknown')}`);
    lines.push(`Parsed: ${new Date(listing.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`);
    lines.push(`Raw: ${compactWhitespace(listing.rawText || listing.description || '').slice(0, 100) || 'No raw message available.'}`);
    lines.push(listingLink(listing.id));
  });

  lines.push('', '---', '_Do not forward. Internal reference only._');
  return lines.join('\n');
}

export function normalizeClientPhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return null;
}
