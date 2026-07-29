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

## Part A — Google side (Home Developer Console + Cloud)

> Google retired the old "Actions on Google → Smart Home" console. The free
> integration now lives in the **Google Home Developer Console**, under
> **Cloud-to-cloud**. Do **not** use **Matter**: it demands Connectivity
> Standards Alliance (CSA) certification you neither need nor can easily get. If
> you land on a "Checklist" saying *your device must be certified by the CSA*,
> you're in the Matter section; back out and open **Cloud-to-cloud**.

1. **Create the project**
   - Go to <https://console.home.google.com/> → **Create a project** → name it
     e.g. `Helm Home` → **Create**.
   - Copy the **Project ID** (⚙ **Project settings**, or read it from the URL).
     It looks like `helm-home-1a2b3`. You need it in HA.

2. **Add the Cloud-to-cloud integration**
   - Left nav → expand **Cloud-to-cloud** → **Develop** → **Add integration**
     (step through **Next: Develop → Next: Configure**).
   - **Integration name**: e.g. `Helm`.
   - **Select device types**: tick **Air conditioner** and **Fan**. This is the
     "pick fan / AC" screen; it's informational, the real device list comes from HA.
   - Upload a **144×144 px** PNG app icon (any square logo).

3. **Account linking (OAuth) + fulfillment URL**
   On the same integration form:
   - **OAuth Client ID**: this **must** be
     `https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID`
     (e.g. `https://oauth-redirect.googleusercontent.com/r/helm-home-28739`).
     HA validates the client_id as an IndieAuth URL whose host must match Google's
     redirect URI — a plain string like `helm-google` fails with
     **"client invalid"** during phone linking.
   - **Client secret**: any random string (HA does not check it).
   - **Authorization URL**: `https://home.pawan67.dev/auth/authorize`
   - **Token URL**: `https://home.pawan67.dev/auth/token`
   - **Cloud fulfillment URL**: `https://home.pawan67.dev/api/google_assistant`
   - **Scopes**: add `email` and `name`. Leave "use basic auth header" unchecked.
   - **Save**.

4. **Enable the HomeGraph API + make a service-account key**
   - Open <https://console.cloud.google.com/> and select the **same project**.
   - **APIs & Services → Library** → search **HomeGraph API** → **Enable**.
   - **APIs & Services → Credentials → Create credentials → Service account** →
     name it → grant the **Service Account Token Creator** role → **Done**.
   - Open the service account → **Keys → Add key → Create new key → JSON** → it
     downloads a `*.json`. Rename it `SERVICE_ACCOUNT.json` and drop it in HA's
     `/config/` folder.

---

## Part B — Home Assistant config

Add a `google_assistant:` block to HA's `configuration.yaml`.

> **On this deploy, HA runs as a Docker container on Dokploy, so there are no
> add-ons** (no File editor / Studio Code Server). `/config` is bind-mounted from
> `/opt/homeassistant` on the VPS, and `/config/configuration.yaml` is the live
> file. Edit it over SSH (or Dokploy's container terminal) and drop
> `SERVICE_ACCOUNT.json` into `/opt/homeassistant/`. The current deploy already
> has this block installed.

```yaml
google_assistant:
  project_id: helm-home-28739                     # from Part A step 1
  service_account: !include SERVICE_ACCOUNT.json  # the JSON key from Part A step 4
  report_state: true                              # pushes state changes back to Google

  # Only expose what you want Google to control. These IDs come from HELM's MQTT
  # discovery — confirm them under Developer Tools → States (climate. / fan.):
  entity_config:
    climate.helm_bar_node_panasonic_ac:
      name: AC
      room: Bedroom
    fan.helm_bar_node_atomberg_fan:
      name: Fan
      room: Bedroom
```

Prefer inlining the key? Drop the `!include` line and paste the two fields from
the JSON instead:

```yaml
  service_account:
    client_email: xxxxx@YOUR_PROJECT.iam.gserviceaccount.com
    private_key: >
      -----BEGIN PRIVATE KEY-----
      ...the whole private_key value from the JSON, newlines kept...
      -----END PRIVATE KEY-----
```

Notes:
- **Confirm the entity IDs.** In HA go to **Developer Tools → States** and search for
  `climate.` and `fan.`. On this deploy they are `climate.helm_bar_node_panasonic_ac`
  and `fan.helm_bar_node_atomberg_fan` (HA derives them from the MQTT device name).
- `name:` is what you'll *say* to Google. "AC" and "Fan" are easy; or use "Bedroom AC".
- To also expose the leftover buttons (Boost/Sleep/Timer/LED,
  `button.helm_bar_node_atomberg_fan_*`), add them under `entity_config` too — but
  buttons map to Google "scenes" (`activate` only), so a `fan` + `climate` is the
  better voice surface.
- Validate before restarting (in the container):
  `docker exec <ha-container> python -m homeassistant --script check_config -c /config`,
  then restart the container.

---

## Part C — Link it on your phone

1. Open the **Google Home** app → **+** → **Set up device** → **Works with Google**.
2. Search for **`[test] Helm Home`** (your project name, prefixed `[test]` while the
   integration is unpublished) → tap it.
3. Log in to Home Assistant when prompted → authorize.
4. Your **AC** and **Fan** appear. Assign them a room if asked.

You do **not** need to publish/certify the integration — leaving it in **test mode**
works for your own account indefinitely.

Now try:
- *"Hey Google, turn on the AC."*
- *"Hey Google, set the AC to 24."*
- *"Hey Google, turn on the fan."* / *"set the fan to speed 3."*

---

## Troubleshooting

- **Stuck on a "your device must be certified by the CSA" checklist** → you opened
  the **Matter** section. Back out and use **Cloud-to-cloud** (Part A). Matter needs
  certification; the HA integration does not.
- **"Couldn't reach Helm Home"** → the fulfillment URL is wrong, or HA isn't reachable
  at `https://home.pawan67.dev/api/google_assistant`. Test it's public.
- **Account linking fails / login loops** → recheck the **Authorization URL**
  (`/auth/authorize`) and **Token URL** (`/auth/token`) point at your HA host over
  HTTPS, and that HA isn't behind a self-signed cert.
- **Devices don't sync** → say *"Hey Google, sync my devices"*, or re-link the account.
- **State looks stale** → make sure `report_state: true` and the HomeGraph API is
  enabled. (For the IR fan, on/off is a toggle so it can drift — set a speed to resync.)

---

## Meanwhile: instant voice with no Google setup

If you want something working *today* while you do the above, use Helm's **Shortcuts**
(Home → Shortcuts): create "AC on", "Fan speed 3", etc., then make a **Bixby Quick
Command** ("AC on" → *Open* `https://helm.pawan67.dev/a/<key>`). The links are public,
so they work on cellular too. No accounts, no subscription.
