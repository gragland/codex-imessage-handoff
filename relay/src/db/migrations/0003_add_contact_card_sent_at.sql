-- Track whether this phone has already received the optional Codex contact card.
ALTER TABLE phone_bindings ADD COLUMN contact_card_sent_at TEXT;
