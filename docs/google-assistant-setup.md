# Voice control (free): Google Assistant → Home Assistant → Helm

Goal: say *"Hey Google, turn on the AC"* / *"set the fan to speed 3"* and have it
reach the IR blaster through Home Assistant — **without paying for Nabu Casa Cloud**.

How it fits together:

```
Google Assistant ──▶ Home Assistant (home.pawan67.dev) ──▶ MQTT ──▶ Helm ──▶ ESP32 IR blaster
     (voice)          google_assistant: integration        discovery      applyClimate / fireIrButton
```

Helm already publishes the AC as a `climate` entity and the fan as a `fan` entity to
HA over MQTT discovery. This guide only covers wiring **HA → Google Assistant**, which
is a one-time setup. Nabu Casa Cloud does this in one click for ~$6.50/mo; the steps
below do the same thing for free, at the cost of ~30–45 min of Google Cloud console
fiddling.

> Google's consoles change their wording often. If a button name here doesn't match,
> the source of truth is the official HA doc:
> <https://www.home-assistant.io/integrations/google_assistant/>

## Prerequisites

- HA reachable over public HTTPS — you have **https://home.pawan67.dev/** ✅
- A Google account (the one on your phone).
- The AC + fan visible in HA (Settings → Devices → **HELM Bar Node**) ✅

---

## Part A — Google side (Actions on Google + Cloud)

1. **Create the project**
   - Go to <https://console.actions.google.com/> → **New project** → name it e.g.
     `Helm Home` → pick your country → **Create**.
   - When asked what kind of Action: choose **Smart Home** → **Start Building**.

2. **Set the fulfillment URL**
   - Left nav **Develop** → **Actions** (under "Build").
   - **Fulfillment URL**: `https://home.pawan67.dev/api/google_assistant`
   - **Save**.

3. **Enable the HomeGraph API + make a service account key**
   - Open <https://console.cloud.google.com/> and select the **same project**
     (it was created for you).
   - **APIs & Services → Library** → search **HomeGraph API** → **Enable**.
   - **APIs & Services → Credentials → Create credentials → Service account**
     → give it a name → **Done**.
   - Click the new service account → **Keys → Add key → Create new key → JSON** →
     it downloads a `*.json` file. Keep it; you'll paste two fields into HA.

4. **Account linking (lets Google log into your HA)**
   - Actions console → **Develop → Account linking**.
   - **Linking type**: *OAuth* + *Authorization Code*.
   - **Client ID / Client secret** (you invent these — any long random strings; they
     must match your HA config below):
     - Client ID: e.g. `helm-google-<random>`
     - Client secret: e.g. `<another-random-string>`
   - **Authorization URL**: `https://home.pawan67.dev/auth/authorize`
   - **Token URL**: `https://home.pawan67.dev/auth/token`
   - **Scopes**: add `email` and `name`.
   - Under *"Configure your client"* leave defaults; **Save**.

5. **Note your Project ID** — Actions console → ⚙ **Project settings** → copy the
   **Project ID** (looks like `helm-home-1a2b3`). You need it below.

---

## Part B — Home Assistant config

Edit HA's `configuration.yaml` (Settings → Add-ons → File editor, or however you edit
it) and add a `google_assistant:` block. Fill in from the pieces above:

```yaml
google_assistant:
  project_id: YOUR_PROJECT_ID            # from Part A step 5
  service_account:
    client_email: xxxxx@YOUR_PROJECT.iam.gserviceaccount.com   # from the JSON key
    private_key: >
      -----BEGIN PRIVATE KEY-----
      ...paste the whole private_key value from the JSON, keeping the newlines...
      -----END PRIVATE KEY-----
  report_state: true                     # pushes state changes back to Google
  # The client id/secret you invented in Part A step 4:
  # (HA validates the values Google sends during account linking)
  # NOTE: these live under `google_assistant` only if you use the legacy fields;
  # modern HA reads them from the account-linking handshake — if HA complains,
  # remove these two lines.
  # client_id: helm-google-<random>
  # client_secret: <another-random-string>

  # Only expose what you want Google to control:
  entity_config:
    climate.panasonic_ac:
      name: AC
      room: Bedroom
    fan.atomberg_fan:
      name: Fan
      room: Bedroom
```

Notes:
- **Confirm the entity IDs.** In HA go to **Developer Tools → States** and search for
  `climate.` and `fan.` — they'll be something like `climate.panasonic_ac` and
  `fan.atomberg_fan` (HA derives them from the device names). Use the exact IDs.
- `name:` is what you'll *say* to Google. "AC" and "Fan" are easy; or use "Bedroom AC".
- To also expose the leftover buttons (Boost/Sleep/Timer/LED), add them under
  `entity_config` too — but buttons map to Google "scenes" (`activate` only), so a
  `fan` + `climate` is the better voice surface.
- After editing: **Developer Tools → YAML → Check configuration**, then **Restart**.

---

## Part C — Link it on your phone

1. Open the **Google Home** app → **+** → **Set up device** → **Works with Google**.
2. Search for **`[test] Helm Home`** (your action name, prefixed `[test]` while it's
   unpublished) → tap it.
3. Log in to Home Assistant when prompted → authorize.
4. Your **AC** and **Fan** appear. Assign them a room if asked.

You do **not** need to publish/verify the Action — leaving it in **test mode** works
for your own account indefinitely.

Now try:
- *"Hey Google, turn on the AC."*
- *"Hey Google, set the AC to 24."*
- *"Hey Google, turn on the fan."* / *"set the fan to speed 3."*

---

## Troubleshooting

- **"Couldn't reach Helm Home"** → the fulfillment URL is wrong, or HA isn't reachable
  at `https://home.pawan67.dev/api/google_assistant`. Test it's public.
- **Devices don't sync** → say *"Hey Google, sync my devices"*, or re-link the account.
- **State looks stale** → make sure `report_state: true` and the HomeGraph API is
  enabled. (For the IR fan, on/off is a toggle so it can drift — set a speed to resync.)
- **HA errors on `client_id`/`client_secret`** → remove those two lines; modern HA
  doesn't need them in YAML.

---

## Meanwhile: instant voice with no Google setup

If you want something working *today* while you do the above, use Helm's **Shortcuts**
(Home → Shortcuts): create "AC on", "Fan speed 3", etc., then make a **Bixby Quick
Command** ("AC on" → *Open* `https://helm.pawan67.dev/a/<key>`). The links are public,
so they work on cellular too. No accounts, no subscription.
