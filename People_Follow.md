Short answer: **Yes — but not directly in the way you’re imagining.**
You’ll need to build a **tracking layer on top of CVR**, because the API does **not provide participant-specific change feeds**.

---

# 🧠 What CVR Actually Gives You

### ✅ Available

1. **Search participants**

   ```
   GET /v2/{country}/search/participant
   ```

   → Filter by name, address, etc.

2. **Get participant by ID**

   ```
   GET /v2/{country}/participant/{participantnumber}
   ```

3. **Company change feed (IMPORTANT)**

   ```
   GET /v2/{country}/changed/list/company/{change_id}
   ```

   → Returns companies that changed (not people directly) 

---

### ❌ Missing (Critical Limitation)

* No:

  * “notify me when this person changes role”
  * “participant change history”
  * “webhooks for participant updates”

👉 CVR is **company-centric**, not **person-tracking-centric**

---

# ⚠️ Key Insight

> **People (participants) are only updated THROUGH companies**

So:

* If a person becomes director → company changes
* If a person leaves → company changes

👉 That means:
**All participant tracking must be derived from company changes**

---

# 🏗️ How to Build This Feature (Real Architecture)

## Step 1 — Store Participants You Care About

In your DB:

```ts
tracked_participants: [
  {
    participant_id,
    name,
    last_known_roles: [...]
  }
]
```

---

## Step 2 — Use Company Change Feed

Poll:

```bash
GET /v2/dk/changed/list/company/{last_change_id}
```

This gives:

* VAT numbers of changed companies

---

## Step 3 — Fetch Updated Companies

```bash
GET /v2/dk/company/{vat}
```

Now extract:

* Participants inside that company

---

## Step 4 — Detect Changes

Compare:

```ts
OLD:
- Nouman → Director @ Company A

NEW:
- Nouman → Director @ Company A
- Nouman → Board Member @ Company B
```

👉 Diff = **new role added**

---

## Step 5 — Trigger Events

```ts
if (roleChanged) {
  triggerNotification({
    type: "ROLE_UPDATED",
    participant_id,
    company,
    change
  });
}
```

---

# 🔥 What You Can Detect

Using this method, you can track:

### ✅ Role changes

* Director → CEO
* Board member → Removed

### ✅ Company associations

* Joined new company
* Left company

### ✅ Status-related signals

* Company goes bankrupt
* Company becomes active/inactive

---

# 🧠 Advanced Insight (Important for Your App)

This is essentially:

> **Event sourcing over company changes**

Instead of:
❌ “track person directly”

You do:
✅ “track all companies → derive person changes”

---

# ⚡ Performance Considerations

This can explode quickly if done wrong.

### You MUST:

* Cache companies
* Store previous snapshots
* Only diff changed companies
* Batch process feeds

---

# 🚀 Clean System Design (Recommended)

```id="architecture"

CVR Feed Worker
   ↓
Changed Companies Queue
   ↓
Company Fetcher
   ↓
Participant Extractor
   ↓
Diff Engine
   ↓
Event Trigger System (notifications / webhooks)
```

---

# 💡 Bonus: Smarter Optimization

Instead of scanning ALL companies:

👉 Build a reverse index:

```ts
participant_to_companies: {
  participant_id: [vat1, vat2, vat3]
}
```

Then:

* Only check relevant companies when they change

---

# 🚫 What You Should NOT Do

* Poll `/search/participant` repeatedly ❌
* Expect real-time updates ❌
* Depend on participant endpoint for change detection ❌

---

# 🧭 Reality Check

This feature is:

* ✅ Totally possible
* ❗ Requires backend intelligence
* ❗ Not plug-and-play from CVR

---
