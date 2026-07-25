# Product

## Register

product

## Users

One person: the operator of a self-hosted console for the systems under their own
roof. No team, no tenants, no cloud account. They run the server, wire the sensors,
and read the panel. It spans three contexts:

- **At the bar, mid-set.** Sweaty hands, a phone or tablet propped a couple of feet
  away, glances measured in fractions of a second between reps. The rep count and
  hang timer have to read at arm's length without squinting or tapping.
- **On the couch or across the house, giving an order.** Firing the AC or the TV
  through the IR blaster and needing the panel to confirm the new state, not spin
  hopefully.
- **Later, reviewing.** On a laptop or phone, checking whether they beat a record,
  kept a streak, hit the day's goal, how the room's temperature moved over the week,
  and whether every device is still reporting.

Also, recurringly, a tinkerer: calibrating detection thresholds, watching the raw
sensor beam, wiring up the next device.

## Product Purpose

Sensors and actuators around the home report to, and take orders from, one
self-hosted web console. A bar sensor streams reps and hang time; a climate sensor
streams temperature and humidity; an IR blaster relays commands out to a TV, an AC,
anything that speaks infrared. The console persists the history, tracks records,
streaks and goals for the body, charts the climate, and sends control back down to
the hardware live, without reflashing anything.

It is not a smart-home app and not a fitness app. It is one operator's instrument
panel for the physical systems they own: their training, their rooms, their devices.
Success is not "a tidy dashboard." Success is telemetry trustworthy enough to train
by and control reliable enough to trust from the next room, on a panel that feels
like real equipment rather than a rented cloud service.

## Brand Personality

Raw, physical, honest, in command. Three words: **instrument, earned, sovereign.**
It should feel like a machined control panel bolted to the wall, not an app with a
cloud account. Voice is terse and confident, closer to a stopwatch, a breaker box
and a chalk bucket than a coach or a chirpy assistant. It states the number plainly
and large, confirms a command by showing the new state, and never celebrates with
confetti. Sovereign because the operator owns the whole stack: their data, their
devices, their server, no one else's.

## Anti-references

- **Generic SaaS dashboard.** Identical rounded card grids, the big-number-hero
  template, soft shadows, safe and soulless. The stock-Chakra look drifts here.
- **Consumer smart-home app.** Pastel round bubbles, a chatty assistant, "Good
  morning!" greeting cards, cloud dependency and a walled garden. This is
  self-hosted, wired and plain. Control is a switch that reports back, not a
  conversation.
- **Neon crypto / gamer.** Glowing neon on pure black, gradient text, cyberpunk
  chrome. Energy comes from contrast and weight, never from glow.
- **Cluttered / data-dense.** Nothing competes with the one reading that matters on
  a given screen. Glanceable under load is a hard requirement, whether that load is
  a set of reps or a room full of devices.
- Soft corporate-wellness pastels, rounded blobs and cutesy illustration are out.

## Design Principles

1. **Earned, not gamified.** Progress is stated, not rewarded with points and
   sparkles. A PR lands like a plate hitting the floor: heavy, plain, unmistakable.
2. **Glanceable under load.** One dominant reading per screen, high-contrast,
   legible across a room. Reps mid-set, temperature at a glance, a device's on/off
   state from the doorway. Everything else recedes.
3. **Control shows its state.** A command reflects the new reality immediately and
   reports back. The panel shows what a device *is* now, never a hopeful spinner
   with no confirmation. When it cannot confirm, it says so plainly.
4. **Built like equipment.** Utilitarian and structural. Hard edges, real borders,
   honest surfaces. Decoration only where it aids reading (a hazard stripe means
   "live", not "pretty").
5. **Steel and chalk, not glass and gradient.** Physical materials over digital
   sheen: matte steel surfaces, chalk-white marks, one hot hazard signal. No
   glassmorphism.
6. **Instrument-grade trust.** Telemetry looks like telemetry: monospaced, tabular,
   precise. If a number is on screen, the operator should bet a set, or the room's
   comfort, on it.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** contrast. The high-contrast chalk-on-steel palette clears
  it comfortably; verify the hazard accent against its backgrounds.
- **Never signal by color alone.** Online/offline, live/idle, on/off, PR/normal each
  carry a shape, label or icon in addition to hue (color-blind safe).
- **Respect `prefers-reduced-motion`.** Count-ups, sweeps and state changes degrade
  to instant.
- **Tabular figures** for every changing number so counters, timers and readings do
  not jitter.
- Large touch targets (min 44px) for sweaty-hand, look-away taps and quick device
  toggles.
