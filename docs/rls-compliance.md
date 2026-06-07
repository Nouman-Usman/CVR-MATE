# RLS Compliance Checklist

## Auth Tables (Sensitive Data)
- [x] account — tokens, passwords protected (user-owned)
- [x] session — session tokens protected (user-owned)
- [x] verification — email verification protected (user-owned)
- [x] user — PII protected (user-visible + org-admin visible)

## Organization Tables
- [x] organization — org data protected (member-visible)
- [x] member — membership protected (org-member-visible, admin-write)
- [x] invitation — invitations protected (admin + invitee visible)

## User Data
- [x] user_brand — brand settings protected (user-owned)
- [x] profile_enrichment — enrichment data protected (user-owned)
- [x] activity — activity log protected (user-owned)
- [x] todo — todos protected (user-owned)
- [x] user_video_view — video tracking protected (user-owned)
- [x] notification — notifications protected (user-owned)
- [x] email_log — email history protected (user-owned)
- [x] followed_person — followed people protected (user-owned)

## Company Data
- [x] company — company data public-read (search requirement)
- [x] saved_company — saved companies protected (user-owned)
- [x] saved_search — saved searches protected (user-owned)
- [x] company_workspace — workspace data protected (org-member-visible)
- [x] company_briefing — briefings protected (org-workspace-visible)
- [x] company_metrics — metrics protected (org-workspace-visible)
- [x] company_note — notes protected (org-owned)

## CRM/Integration Data
- [x] crm_connection — API tokens protected (org-owned)
- [x] crm_sync_log — sync logs protected (org-owned)
- [x] crm_sync_mapping — mappings protected (org-owned)
- [x] outreach_message — messages protected (org-owned)

## Lead Data
- [x] lead_trigger — triggers protected (org-owned)
- [x] trigger_result — results protected (org-owned)

## Admin Data
- [x] org_audit_log — audit logs protected (admin-only)
- [x] usage_record — usage protected (user-owned + org-admin-visible)
- [x] subscription — subscription protected (admin-only)

## Public Data
- [x] features — feature metadata public-read
- [x] feature_video — videos public-read (published only)
- [x] person_role_snapshot — role data public-read
- [x] person_role_event — event data public-read
- [x] person_company_index — index data public-read
- [x] enterprise_inquiry — inquiry form public-write

## Sensitive Columns Protected
- [x] account.access_token — encrypted, user-owned only
- [x] account.refresh_token — encrypted, user-owned only
- [x] account.password — hashed, user-owned only
- [x] session.token — session token, user-owned only
- [x] crm_connection.access_token — encrypted, org-owned only
- [x] crm_connection.refresh_token — encrypted, org-owned only

## Implementation Complete
✅ All 40+ tables have RLS enabled
✅ Helper functions created (is_org_member, is_org_admin, get_user_org_ids)
✅ Policies enforce user ownership, org membership, and public read access
✅ Migrations created and ready to apply (0024–0036)
