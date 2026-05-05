import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatCurrencyShort, slugifyLocality, topLocalities } from "@/lib/site";

export type ListingType = "rent" | "sale" | "requirement";

export type PublicListing = {
  id: string;
  title: string;
  locality: string;
  localitySlug: string;
  area: string | null;
  locationDisplay: string;
  city: string;
  type: ListingType;
  bhk: string;
  areaSqft: number | null;
  furnishing: string | null;
  priceAmount: number | null;
  priceLabel: string;
  tags: string[];
  brokerName: string | null;
  brokerPhone: string | null;
  isPro: boolean;
  brokerInitials: string;
  description: string;
  rawText: string;
  building: string | null;
  floor: string | null;
  parking: string | null;
  deposit: string | null;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
  matchScore: number;
  imageInitial: string;
};

type LegacyListingRow = {
  id: string;
  tenant_id: string;
  structured_data: Record<string, unknown>;
  raw_text: string | null;
  status: string;
  created_at: string;
};

type ProBroker = {
  phone: string;
  fullName: string | null;
};

type Filters = {
  q?: string;
  locality?: string;
  type?: string;
  bhk?: string;
  sort?: string;
  page?: number;
  perPage?: number;
};

export const getAllListings = cache(async (): Promise<PublicListing[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return [];
  }
  const [{ data: listings, error: listingError }, { data: profiles }, { data: subscriptions }] = await Promise.all([
    supabase.from("listings").select("id, tenant_id, structured_data, raw_text, status, created_at").eq("status", "Active").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, phone, full_name"),
    supabase.from("subscriptions").select("tenant_id, plan, status")
  ]);

  if (listingError) {
    throw new Error(listingError.message);
  }

  const paidTenantIds = new Set(
    (subscriptions || [])
      .filter((row: any) => (row.status === "active" || row.status === "trial") && (row.plan === "Pro" || row.plan === "Team"))
      .map((row: any) => row.tenant_id)
  );

  const paidBrokerMap = new Map<string, ProBroker>();
  for (const row of profiles || []) {
    const digits = digitsOnly((row as any).phone);
    if (!digits) continue;
    if (!paidTenantIds.has((row as any).id)) continue;
    paidBrokerMap.set(digits, {
      phone: digits,
      fullName: (row as any).full_name || null
    });
  }

  return ((listings || []) as LegacyListingRow[])
    .map((row) => normalizeListing(row, paidBrokerMap))
    .filter((listing): listing is PublicListing => Boolean(listing));
});

function normalizeListing(row: LegacyListingRow, paidBrokerMap: Map<string, ProBroker>): PublicListing | null {
  const data = (row.structured_data || {}) as Record<string, unknown>;
  const rawText = String(row.raw_text || "");
  const normalized = normalizeListingDisplay(data, rawText);
  const title = pickString(data.title, data.name, data.displayTitle, normalized.title) || "Property Listing";
  const locality = normalized.locality;
  const area = normalized.area;
  const city = normalized.city;
  const bhk = normalized.bhkDisplay || inferBhk(rawText) || "Flexible";
  const areaSqft = normalized.sqft;
  const furnishing = normalized.furnished;
  const type = normalizeType(pickString(data.type, data.deal_type, data.intent, data.category), rawText);
  const priceAmount = parsePriceAmount(data.price_numeric, data.price_value, data.price_display, data.price, rawText, type, areaSqft);
  const priceLabel = normalized.priceDisplay || formatCurrencyShort(priceAmount, type === "rent");
  const building = pickString(data.building, data.building_name, data.project, normalized.buildingName) || inferBuilding(rawText);
  const floor = pickString(data.floor, data.floor_number) || null;
  const parking = pickString(data.parking, data.car_parking, data.car_parkings) || inferParking(rawText);
  const deposit = pickString(data.deposit) || inferDeposit(rawText);
  const brokerDigits = digitsOnly(pickString(data.contact_phone, data.contact_number, data.phone, data.contactPhone, data.sourcePhone) || extractPhone(rawText));
  const proBroker = brokerDigits ? paidBrokerMap.get(brokerDigits) || null : null;
  const brokerName = proBroker?.fullName || null;
  const brokerPhone = proBroker?.phone || null;
  const amenities = normalized.amenities.length ? normalized.amenities : inferAmenities(data, rawText);
  const tags = amenities.slice(0, 3);

  return {
    id: row.id,
    title,
    locality,
    localitySlug: slugifyLocality(locality),
    area,
    locationDisplay: normalized.locationDisplay,
    city,
    type,
    bhk,
    areaSqft,
    furnishing,
    priceAmount,
    priceLabel,
    tags,
    brokerName,
    brokerPhone,
    isPro: Boolean(proBroker),
    brokerInitials: initials(brokerName || "Broker"),
    description: normalized.description,
    rawText,
    building,
    floor,
    parking,
    deposit,
    amenities,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    matchScore: inferMatchScore(data, rawText),
    imageInitial: normalized.initial
  };
}

function normalizeListingDisplay(structuredData: Record<string, unknown>, rawText: string) {
  const d = structuredData || {};
  const rawBuilding = pickString(d.building_name, d.building, d.project) || "";
  const buildingParts = extractBuildingDeveloper(rawBuilding || pickString(d.area) || "");
  const buildingName = buildingParts.buildingName || null;
  const cleanedLocality = sanitizeLocality(pickString(d.locality, d.locality_canonical, d.location, d.address) || "");
  const locality = cleanedLocality || inferReasonableLocality(rawText) || "Mumbai";
  const rawArea = sanitizeArea(pickString(d.area, d.micro_market, d.microLocation) || "", locality);
  const area = rawArea || null;
  const locationDisplay = [locality, area].filter(Boolean).join(", ") || "Mumbai";
  const city = sanitizeCity(pickString(d.city, d.city_canonical) || "");
  const priceDisplay = sanitizePriceDisplay(
    pickString(d.price_display, d.price) || "",
    d.price_value,
    d.price_unit,
  );
  const bhkDisplay = sanitizeBhkDisplay(d.bhk);
  const description = sanitizeDescription(pickString(d.description) || "", rawText);
  const initial = (locality || String(d.deal_type || "P"))[0]?.toUpperCase() || "P";
  const amenities = Array.isArray(d.amenities) ? d.amenities.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 4) : [];
  const sqft = parseAreaSqft(d.sqft, d.area_sqft, d.carpet_area, d.area);
  const furnished = sanitizeFurnishing(pickString(d.furnished, d.furnishing) || "");
  const title = buildCleanTitle(bhkDisplay, String(d.deal_type || d.type || ""), locality);

  return { locality, area, locationDisplay, city, priceDisplay, bhkDisplay, description, initial, amenities, sqft, furnished, title, buildingName };
}

export async function getHomepageData() {
  const all = await getAllListings();
  const latest = all.slice(0, 8);
  const featured = all.filter((item) => item.isPro).sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  const localityCounts = topLocalities.map((locality) => {
    const count = all.filter((item) => item.locality.toLowerCase() === locality.toLowerCase()).length;
    return { locality, slug: slugifyLocality(locality), count };
  });
  return {
    latest,
    featured,
    localityCounts,
    stats: {
      listings: all.length,
      brokers: new Set(all.filter((item) => item.brokerPhone).map((item) => item.brokerPhone)).size,
      localities: new Set(all.map((item) => item.localitySlug)).size
    }
  };
}

export async function getListingsPageData(filters: Filters) {
  const all = await getAllListings();
  let filtered = all;
  const q = String(filters.q || "").trim().toLowerCase();
  const locality = String(filters.locality || "").trim().toLowerCase();
  const type = String(filters.type || "").trim().toLowerCase();
  const bhk = String(filters.bhk || "").trim().toLowerCase();
  const sort = String(filters.sort || "newest");
  const page = Math.max(1, Number(filters.page || 1));
  const perPage = Math.max(1, Number(filters.perPage || 24));

  if (q) {
    filtered = filtered.filter((listing) =>
      [listing.title, listing.locality, listing.area, listing.description, listing.bhk, listing.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  if (locality) {
    filtered = filtered.filter((listing) => listing.localitySlug === slugifyLocality(locality) || listing.locality.toLowerCase().includes(locality));
  }

  if (type) {
    filtered = filtered.filter((listing) => listing.type === type);
  }

  if (bhk) {
    filtered = filtered.filter((listing) => listing.bhk.toLowerCase().includes(bhk));
  }

  filtered = sortListings(filtered, sort);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;

  return {
    totalAll: all.length,
    total,
    page: currentPage,
    totalPages,
    results: filtered.slice(start, start + perPage),
    localities: Array.from(new Set(all.map((listing) => listing.locality))).sort()
  };
}

export async function getListingById(id: string) {
  const listings = await getAllListings();
  return listings.find((listing) => listing.id === id) || null;
}

export async function getRelatedListings(listing: PublicListing) {
  const all = await getAllListings();
  return all.filter((item) => item.id !== listing.id && item.localitySlug === listing.localitySlug && item.type === listing.type).slice(0, 4);
}

export async function getLocalityPageData(slug: string, page = 1, perPage = 24) {
  const all = await getAllListings();
  const filtered = all.filter((listing) => listing.localitySlug === slug);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (currentPage - 1) * perPage;
  const rent = filtered.filter((item) => item.type === "rent");
  const sale = filtered.filter((item) => item.type === "sale");
  return {
    listings: filtered.slice(sliceStart, sliceStart + perPage),
    total: filtered.length,
    page: currentPage,
    totalPages,
    locality: filtered[0]?.locality || slug.replace(/-/g, " "),
    stats: {
      rent: rent.length,
      sale: sale.length,
      avgRent: avg(rent.map((item) => item.priceAmount || 0)),
      avgSale: avg(sale.map((item) => item.priceAmount || 0))
    }
  };
}

export async function getAllListingIds() {
  const listings = await getAllListings();
  return listings.map((listing) => listing.id);
}

export async function getAllLocalitySlugs() {
  const listings = await getAllListings();
  return Array.from(new Set(listings.map((listing) => listing.localitySlug)));
}

function avg(values: number[]) {
  const clean = values.filter((value) => value > 0);
  if (clean.length === 0) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sortListings(listings: PublicListing[], sort: string) {
  const next = [...listings];
  if (sort === "price_asc") return next.sort((a, b) => (a.priceAmount || Number.MAX_SAFE_INTEGER) - (b.priceAmount || Number.MAX_SAFE_INTEGER));
  if (sort === "price_desc") return next.sort((a, b) => (b.priceAmount || 0) - (a.priceAmount || 0));
  if (sort === "match") return next.sort((a, b) => b.matchScore - a.matchScore);
  return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function inferTitle(rawText: string) {
  return rawText.split("\n").map((line) => line.trim()).find((line) => line.length > 8 && !line.includes("http")) || null;
}

function inferLocation(rawText: string) {
  const line = rawText.split("\n").map((entry) => entry.trim()).find((entry) => /bandra|powai|andheri|worli|thane|juhu|goregaon|malad|chembur|dadar/i.test(entry));
  return line || null;
}

function normalizeLocality(value: string) {
  const trimmed = value.split(",")[0]?.trim() || value.trim();
  if (!trimmed) return "Unknown Locality";
  return trimmed.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferBhk(rawText: string) {
  const match = rawText.match(/\b(\d(?:\.\d+)?)\s*bhk\b/i);
  return match ? `${match[1]}BHK` : null;
}

function parseAreaSqft(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value || "");
    const match = text.match(/(\d{2,5}(?:\.\d+)?)\s*(sq\s*ft|sqft|carpet)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function normalizeType(value: string | null, rawText: string): ListingType {
  const lower = `${value || ""} ${rawText}`.toLowerCase();
  if (lower.includes("requirement")) return "requirement";
  if (lower.includes("rent") || lower.includes("lease") || lower.includes("l/l")) return "rent";
  return "sale";
}

function parsePriceAmount(value: unknown, altNumeric: unknown, displayLabel: unknown, priceLabel: unknown, rawText: string, type: ListingType, areaSqft: number | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof altNumeric === "number" && Number.isFinite(altNumeric)) {
    const unitMatch = String(displayLabel || "").toLowerCase();
    if (unitMatch.includes("cr")) return Math.round(Number(altNumeric) * 10000000);
    if (unitMatch.includes("lakh") || unitMatch.includes("lac")) return Math.round(Number(altNumeric) * 100000);
    if (unitMatch.includes("/month")) return Math.round(Number(altNumeric));
  }
  const merged = `${String(displayLabel || "")} ${String(priceLabel || "")} ${rawText}`;
  const rateMatch = areaSqft ? merged.match(/(\d+(?:\.\d+)?)\s*(k|l|lac|lakh)?\s*(?:psf|per\s*sq\.?\s*ft|\/\s*sqft)/i) : null;
  if (rateMatch && areaSqft) {
    let rate = Number(rateMatch[1]);
    const unit = String(rateMatch[2] || "").toLowerCase();
    if (unit === "k") rate *= 1000;
    if (unit === "l" || unit === "lac" || unit === "lakh") rate *= 100000;
    return Math.round(rate * areaSqft);
  }

  const moneyMatch = merged.match(/₹?\s*(\d+(?:\.\d+)?)\s*(cr|crore|l|lac|lakh|k|thousand)?/i);
  if (!moneyMatch) return null;
  let amount = Number(moneyMatch[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = String(moneyMatch[2] || "").toLowerCase();
  if (unit === "cr" || unit === "crore") amount *= 10000000;
  else if (unit === "l" || unit === "lac" || unit === "lakh") amount *= 100000;
  else if (unit === "k" || unit === "thousand") amount *= 1000;
  else if (type === "sale" && amount < 1000) amount *= 100000;
  return Math.round(amount);
}

function sanitizeLocality(value: string) {
  const text = String(value || "").trim();
  if (!text || /\d/.test(text) || text.length >= 40) return null;
  if (/₹|lakh|lac|crore|cr\b|touch with|contact|call|whatsapp|month/i.test(text)) return null;
  const firstChunk = text.split(",")[0]?.trim() || text;
  return normalizeLocality(firstChunk);
}

function inferReasonableLocality(rawText: string) {
  const match = rawText.match(/\b(Bandra West|Bandra East|Powai|Andheri West|Andheri East|Santacruz West|Santacruz East|Worli|Juhu|Chembur|Dadar|Malad|Goregaon|Borivali|Thane|Khar West|Khar East)\b/i);
  return match ? normalizeLocality(match[1]) : null;
}

function sanitizeArea(value: string, locality: string) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.toLowerCase() === locality.toLowerCase()) return null;
  if (/\d{6,}|₹|lakh|crore|touch with|contact|call/i.test(text)) return null;
  if (!looksLikeRoadOrMicroLocation(text)) return null;
  return text;
}

function sanitizeCity(value: string) {
  const text = String(value || "").trim();
  if (!text || /^india$/i.test(text)) return "Mumbai";
  return text;
}

function sanitizePriceDisplay(priceDisplay: string, priceValue: unknown, priceUnit: unknown) {
  const clean = String(priceDisplay || "").trim();
  if (clean && isCanonicalPriceDisplay(clean)) return clean;
  const numeric = typeof priceValue === "number" ? priceValue : Number(String(priceValue || "").replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const unit = String(priceUnit || "").toLowerCase();
  if (unit === "per_month") return numeric >= 100000 ? `₹${stripZeroes((numeric / 100000).toFixed(2))} Lakh/month` : `₹${stripZeroes((numeric / 1000).toFixed(0))}K/month`;
  if (unit === "crore") return `₹${stripZeroes(numeric.toFixed(2))} Cr`;
  if (unit === "lakh") return `₹${stripZeroes(numeric.toFixed(2))} Lakh`;
  if (numeric >= 10000000) return `₹${stripZeroes((numeric / 10000000).toFixed(2))} Cr`;
  if (numeric >= 100000) return `₹${stripZeroes((numeric / 100000).toFixed(2))} Lakh`;
  if (numeric >= 1000) return `₹${stripZeroes((numeric / 1000).toFixed(0))}K`;
  return `₹${Math.round(numeric)}`;
}

function isCanonicalPriceDisplay(value: string) {
  const text = String(value || "").trim();
  if (!text) return false;
  return [
    /^₹\d+(?:\.\d+)?K(?:\/month)?$/i,
    /^₹\d+(?:\.\d+)?\s+Lakh(?:\/month)?$/i,
    /^₹\d+(?:\.\d+)?\s+Cr$/i,
    /^₹\d+(?:\.\d+)?\/month$/i,
    /^₹\d+$/i,
  ].some((pattern) => pattern.test(text));
}

function stripZeroes(value: string) {
  return String(value || "").replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function sanitizeBhkDisplay(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/(\d(?:\.\d+)?)/);
  return match ? `${match[1]} BHK` : null;
}

function sanitizeDescription(description: string, rawText: string) {
  const base = description || rawText;
  const cleaned = base
    .replace(/(?:\+91[-\s]?)?[6-9]\d{9}/g, "")
    .replace(/touch with.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Property details available on request.";
}

function sanitizeFurnishing(value: string) {
  const lower = String(value || "").trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes("semi")) return "Semi-furnished";
  if (lower.includes("unfurnished")) return "Unfurnished";
  if (lower.includes("furnished")) return "Furnished";
  return null;
}

function buildCleanTitle(bhkDisplay: string | null, dealType: string, locality: string) {
  const bhk = bhkDisplay ? bhkDisplay.replace(/\s+/g, "") : "Property";
  const lower = String(dealType || "").toLowerCase();
  const deal = lower.includes("rent") ? "for Rent" : lower.includes("pre") ? "Pre-leased" : lower.includes("requirement") ? "Requirement" : "for Sale";
  return `${bhk} ${deal} — ${locality}`;
}

function looksLikeRoadOrMicroLocation(value: string) {
  return /\b(road|rd\b|street|st\b|lane|ln\b|marg|nagar|cross road|cross rd|linking road|sv road|s v road|carter road|turner road|mount mary road|hill road|pali hill)\b/i.test(String(value || "").trim());
}

function extractBuildingDeveloper(value: string) {
  const text = String(value || "").trim();
  if (!text || looksLikeRoadOrMicroLocation(text)) {
    return { buildingName: null as string | null, developer: null as string | null };
  }
  const split = text.match(/^(.+?)\s+by\s+(.+)$/i);
  if (split) {
    return { buildingName: split[1].trim() || null, developer: split[2].trim() || null };
  }
  return { buildingName: text, developer: null };
}

function inferBuilding(rawText: string) {
  const line = rawText.split("\n").map((entry) => entry.trim()).find((entry) => /^[A-Z][A-Z\s.&'-]{3,}$/i.test(entry) && !/rent|sale|price|sqft/i.test(entry));
  return line || null;
}

function inferParking(rawText: string) {
  const match = rawText.match(/(\d+)\s+car\s+parking/i);
  return match ? `${match[1]} car parking` : null;
}

function inferDeposit(rawText: string) {
  const match = rawText.match(/deposit[:\s-]*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

function inferAmenities(data: Record<string, unknown>, rawText: string) {
  const amenityValues = Array.isArray(data.amenities) ? data.amenities.map((item) => String(item)) : [];
  const detected = [
    /sea view/i.test(rawText) ? "Sea View" : null,
    /gym/i.test(rawText) ? "Gym" : null,
    /parking/i.test(rawText) ? "Parking" : null,
    /furnished/i.test(rawText) ? "Furnished" : null,
    /lift/i.test(rawText) ? "Lift" : null,
    /balcony/i.test(rawText) ? "Balcony" : null
  ].filter(Boolean) as string[];
  return Array.from(new Set([...amenityValues, ...detected])).slice(0, 6);
}

function inferMatchScore(data: Record<string, unknown>, rawText: string) {
  const structuredConfidence = Number(data.confidence || data.match || 0);
  if (structuredConfidence > 0) return Math.max(1, Math.min(99, Math.round(structuredConfidence)));
  return Math.max(76, Math.min(98, 80 + Math.round(rawText.length / 50)));
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return null;
}

function extractPhone(rawText: string) {
  const match = rawText.match(/(?:\+91[-\s]?)?([6-9]\d{9})/);
  return match?.[1] || null;
}

function digitsOnly(value: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function initials(value: string) {
  return value.split(" ").filter(Boolean).slice(0, 2).map((chunk) => chunk[0]?.toUpperCase() || "").join("") || "P";
}
