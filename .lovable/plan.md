
# Chatwave: Big Feature Rollout

I'll ship this in 3 phases so you get value fast and we don't break anything.

## Phase 1 — UI polish & messaging extras
- **Dark mode** toggle (system / light / dark) in the sidebar, persisted in localStorage.
- **Emoji picker** in the composer (`emoji-picker-react`, fully offline, no key).
- **GIF picker** in the composer using the **GIPHY public demo key** (free, no signup). You can later swap it for your own GIPHY key for production rate limits.
- **Message reactions** (long-press / hover → emoji bar, stored in a new `message_reactions` table).
- **Reply to message** (quote a prior message inline).
- **Typing indicator** via Realtime broadcast channel.
- **Read receipts** (per-participant `last_read_at`).
- **Delete-for-me** and **delete-for-everyone** (with 1-hour window).

## Phase 2 — Contacts, blocking, mute
- **Block / unblock users** — new `blocked_users` table; RLS hides messages/conversations from blocked users on both sides.
- **Mute conversation** — `muted_until` on `conversation_participants`.
- **Forward message** to another conversation.
- **Pin conversation** to top of sidebar.
- **Profile preview sheet** (avatar, name, status, block/mute actions).

## Phase 3 — Calls
- **Voice & video calls** with **WebRTC** peer-to-peer, signaling over Supabase Realtime broadcast. Free, no Twilio/Agora needed. New `calls` table records call history (started, ended, missed, duration).
- **"Text call" ping** — when a friend is offline you can send a "📞 ping to chat" notification. They see a highlighted incoming-ping card at the top of the conversation when they next open the app; tapping it jumps to the chat. Stored in a new `chat_pings` table.
- **Call history tab** in the sidebar.

## Technical notes
- New deps: `emoji-picker-react`, `@giphy/js-fetch-api`, `@giphy/react-components`, `date-fns` (already present).
- New tables: `message_reactions`, `blocked_users`, `calls`, `chat_pings`. New columns: `messages.reply_to_id`, `messages.deleted_for_everyone`, `messages.gif_url`, `messages.message_type` (text/gif/system/call), `conversation_participants.last_read_at`, `conversation_participants.muted_until`, `conversation_participants.pinned`.
- RLS policies for every new table; realtime publication added for messages/reactions/typing/calls/pings.
- WebRTC: standard `RTCPeerConnection` with STUN servers (`stun:stun.l.google.com:19302`). Works for 1:1; group calls deferred.

## What I will NOT change
- Auth flows, group ownership/co-owner rules from earlier turns.
- Existing message encryption (none — already removed).

## Order I'll build
1. Phase 1 migration + emoji/GIF/reactions/reply/typing/read/delete UI.
2. Phase 2 migration + block/mute/forward/pin UI.
3. Phase 3 migration + WebRTC call screen + ping system.

Each phase is independently usable — if you want to stop after Phase 1 or 2, the app stays consistent.
