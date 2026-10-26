# Dorsum v0.6.4 — Client Record Workspace

## Client directory
- Rebuilt ADMIN client directory as responsive cards instead of a dense table.
- Search by full name or phone.
- Shows active courses, nearest appointment, discount category, card-image availability and internal-note availability.
- `/clients` is no longer public; ADMIN authentication is required.

## Specialist client directory
- Added `/specialist/clients` and a sidebar entry.
- Specialist sees only clients for whom that specialist has at least one appointment.
- Specialist profile access is re-checked server-side; guessing another client ID returns `CLIENT_ACCESS_DENIED`.

## Client profile
- Shared branded profile UI for ADMIN and SPECIALIST.
- Courses with progress, planned appointments and appointment history.
- All appointment timestamps in this workspace use Dorsum centre time formatting.
- ADMIN can manage military/pensioner flags.
- SPECIALIST is strictly read-only.

## Internal client information
- Existing `ClientProfile.notes` is now editable through an ADMIN-only endpoint.
- Maximum length: 5000 characters.
- Specialists assigned to the client can read the note.
- Client self-service `/clients/me` explicitly excludes internal notes.

## Client card image
- New `ClientCardImage` DB model, one image per client.
- Stored in PostgreSQL instead of Render's ephemeral filesystem.
- JPEG / PNG / WebP only, maximum decoded size 5 MB.
- MIME type is verified against the actual binary signature.
- No public URL: image download requires authenticated ADMIN/SPECIALIST access.
- Response uses `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
- ADMIN: upload / replace / delete / open.
- SPECIALIST assigned to that client: open only.

## Migration
- `20260820090000_client_record_card`
