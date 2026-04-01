## 1. Proper Architecture (What you SHOULD build)

### ✅ Recommended Flow:

**Step 1: Sync Changes**

```
/changed/list/company/{last_id}
```

**Step 2: Fetch Companies**

```
/company/{vat}
```

**Step 3: Store in DB**

* Cache results (Redis / DB)

**Step 4: Query Locally**

* DO NOT hit API repeatedly

---

## 4. Performance Strategy

* Use **feeds API** for updates
* Cache aggressively
* Build your own search layer (Postgres / Elastic)

---

Given your SaaS + automation work, the **best architecture is**:

```
CVR API → Sync Worker → Database → API Layer → Frontend / AI Agents
```

