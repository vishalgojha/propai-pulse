export interface MessageLogEntry {
    id: string;
    remote_jid: string;
    message_text?: string;
    text?: string;
    timestamp: string;
    sender?: string;
}

export interface SavedLogStreamItem {
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
    primary_contact_wa?: string | null;
    message_timestamp?: string | null;
    created_at?: string | null;
    fallback_source?: 'saved_log';
}

export function normalizeMessageText(message: MessageLogEntry) {
    return message.message_text || message.text || '';
}

function jidLabel(remoteJid: string) {
    return remoteJid.replace(/@g\.us$|@s\.whatsapp\.net$/g, '');
}

export function buildSavedLogStream(messages: MessageLogEntry[], limit = 24): SavedLogStreamItem[] {
    return [...messages]
        .filter((message) => message.remote_jid.endsWith('@g.us'))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
        .map((message) => {
            const text = normalizeMessageText(message);
            const title = text.split('\n').map((line) => line.trim()).find(Boolean) || jidLabel(message.remote_jid);
            return {
                source_message_id: message.id,
                source_group_name: jidLabel(message.remote_jid),
                listing_type: 'saved_log',
                title,
                description: text || 'No saved message body.',
                message_timestamp: message.timestamp,
                created_at: message.timestamp,
                fallback_source: 'saved_log',
            };
        });
}
