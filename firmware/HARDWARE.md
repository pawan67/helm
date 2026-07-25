# HELM Bar-Node — Hardware Wiring (beginner guide)

Step-by-step wiring for the ESP32 bar node: **which pin goes where**, **which
side is +**, and **how to read your color-code resistors**. Take it slow and
build one component at a time.

> ⚠️ **Always unplug the ESP32 from USB while you wire.** Only plug in power
> after you've double-checked a connection. A swapped `+`/`GND` can kill a part.

---

## 1. Parts

| # | Part | What it does | Needed? |
|---|------|--------------|---------|
| 1 | ESP32 dev board (DevKitC / WROOM) | The brain | ✅ required |
| 2 | VL53L0X ToF distance sensor | Detects reps / hang | ✅ required |
| 3 | DHT11 temp/humidity sensor | Room climate | ✅ required |
| 4 | **Passive** piezo buzzer | Chirps on reps | ✅ required |
| 5 | IR LED + 2N2222 transistor + 470 µF cap | Controls your AC/fan/TV | ⭕ optional |
| — | Resistors: **10 kΩ**, **220 Ω**, **~47 Ω** | see §3 | ✅ / ⭕ |
| — | Breadboard + jumper wires | Connections | ✅ |

> **Passive** buzzer, not active: the firmware plays tones with `tone()`. A
> passive piezo has no sticker over the hole and clicks (not beeps) if you touch
> its pins to 3V3. An active buzzer will just buzz one note — wrong part here.

---

## 2. Know your ESP32 pins first

You only need to find these labels printed on the board (both sides are labeled):

| Label on board | Meaning | Use it for |
|----------------|---------|------------|
| `3V3` | 3.3 V **power out (+)** | VL53L0X, DHT11 power |
| `5V` or `VIN` | 5 V **power out (+)** | IR LEDs (optional) |
| `GND` | Ground **(−)** | every part's `−` |
| `GPIO21` | I²C data (SDA) | VL53L0X SDA |
| `GPIO22` | I²C clock (SCL) | VL53L0X SCL |
| `GPIO25` | Digital | DHT11 DATA |
| `GPIO26` | Digital | Buzzer `+` |
| `GPIO27` | Digital | IR driver (optional) |

There are **several `GND` pins** — any of them work. `3V3` is your `+` rail for
the sensors; `GND` is your `−` rail. Think of it as a `+` line and a `−` line.

---

## 3. How to read your resistors (4-band color code)

Your resistors have **4 colored bands**. Here's how to turn the colors into a
value.

### Step A — point it the right way

One band is **gold** (or silver) and sits slightly apart from the other three.
**Turn the resistor so that gold/silver band is on the RIGHT.** Now read the
bands **left → right**.

```
 ┌───────────────────────────┐
 │  ▓   ▓   ▓          ▓      │   ← gold on the right
 └───────────────────────────┘
    1st 2nd  ×          tolerance
   digit digit multiplier  (gold = ±5%)
```

### Step B — the color chart

| Color  | Digit (bands 1 & 2) | Multiplier (band 3) |
|--------|:---:|:---|
| Black  | 0 | × 1 |
| Brown  | 1 | × 10 |
| Red    | 2 | × 100 |
| Orange | 3 | × 1,000 (k) |
| Yellow | 4 | × 10,000 |
| Green  | 5 | × 100,000 |
| Blue   | 6 | × 1,000,000 (M) |
| Violet | 7 | — |
| Grey   | 8 | — |
| White  | 9 | — |
| **Gold** | — | tolerance **±5%** (band 4) |
| **Silver** | — | tolerance ±10% (band 4) |

**Value = (digit1 digit2) × multiplier.**
Example — Brown, Black, Red: `1` `0` × `100` = **1,000 Ω = 1 kΩ**.

### Step C — find the exact resistors THIS build needs

Look through your bag and match these color patterns:

| You need | Bands (left → right) | Reads as | Used for |
|----------|----------------------|----------|----------|
| **10 kΩ** | 🟤 Brown, ⚫ Black, 🟠 Orange, 🟡 Gold | 1,0 × 1k = 10,000 | DHT11 pull-up |
| **220 Ω** | 🔴 Red, 🔴 Red, 🟤 Brown, 🟡 Gold | 2,2 × 10 = 220 | IR transistor base (optional) |
| **47 Ω** | 🟡 Yellow, 🟣 Violet, ⚫ Black, 🟡 Gold | 4,7 × 1 = 47 | IR LED limit (optional) |

Close alternatives for the IR LED resistor if you don't have 47 Ω:
- **22 Ω** = Red, Red, Black, Gold
- **33 Ω** = Orange, Orange, Black, Gold

> 💡 **Not sure? Measure it.** Set a multimeter to Ω (ohms), touch one probe to
> each leg (resistors have no polarity — either way is fine). It reads the value
> directly. This is the foolproof method if colors are hard to tell apart.

---

## 4. Wire it up, one part at a time

Colors below are a suggested convention: **red jumper = +/power**, **black
jumper = − / GND**. Do each part, then move on.

### 4a. VL53L0X (distance sensor) — required

No tricky polarity; just match 4 pins. It's an I²C device.

| VL53L0X pin | → ESP32 |
|-------------|---------|
| `VIN` (or `VCC`) = **+** | `3V3` |
| `GND` = **−** | `GND` |
| `SDA` | `GPIO21` |
| `SCL` | `GPIO22` |

Mount it **10 cm above the bar**, centered, lens pointing **outward toward your
body** (so your head enters the beam as you pull up).

### 4b. DHT11 (temp/humidity) — required

**Two kinds exist — check yours:**

- **3-pin module** (small blue/black board): it has silkscreen labels. Match by
  the label, because the pin *order differs between brands*:
  - `+` / `VCC` → `3V3`
  - `OUT` / `S` / `DATA` → `GPIO25`
  - `−` / `GND` → `GND`
  - (A module already has the pull-up resistor built in — you don't add one.)

- **Bare 4-pin sensor** (blue plastic, metal grille, 4 legs): hold it with the
  **grille facing you**, legs down. Left → right = **1,2,3,4**:
  - Pin 1 = **VCC (+)** → `3V3`
  - Pin 2 = **DATA** → `GPIO25`
  - Pin 3 = not connected (skip)
  - Pin 4 = **GND (−)** → `GND`
  - **Add a 10 kΩ resistor between Pin 1 and Pin 2** (the pull-up). Resistors
    have no `+`/`−`, so orientation doesn't matter.

```
 Bare DHT11 pull-up:
   3V3 ──┬───────── Pin 1 (VCC)
         │
       [10kΩ]
         │
 GPIO25 ─┴───────── Pin 2 (DATA)
   GND ──────────── Pin 4 (GND)
```

### 4c. Passive buzzer — required

The buzzer **is polarized** on most modules. Look for a **`+`** printed on top,
or the **longer leg = `+`**.

| Buzzer pin | → ESP32 |
|------------|---------|
| **+** (long leg / `+` mark) | `GPIO26` |
| **−** (short leg) | `GND` |

(If yours is a bare 2-pin piezo disc with no `+`, it isn't polarized — either leg
works.)

### 4d. IR blaster — OPTIONAL (only if you want AC/fan/TV control)

This one has real polarity and needs the transistor to switch a bright IR LED.
Skip this whole section if you're not using IR — the tracker works fine without
it.

```
  ESP32 GPIO27 ──[220Ω]──► B (base)
                            │
             5V ──► IR LED ──[47Ω]──► C (collector)
                  (anode +) (cathode −)      │
                                    E (emitter) ──► GND

  470µF capacitor across the 5V supply:  +leg → 5V,  −leg(stripe) → GND
```

Watch polarity on three parts:

- **IR LED:** **long leg = anode (+)** → toward `5V`. Short leg / **flat side of
  the rim = cathode (−)** → toward the 47 Ω resistor and the collector.
- **2N2222 transistor (TO-92, flat face toward you, legs down):** most common
  order is **E – B – C** (left → right): left leg = Emitter → `GND`, middle =
  Base → 220 Ω → `GPIO27`, right = Collector → the IR LED side.
  ⚠️ Pinouts vary by brand — confirm against your transistor's datasheet/marking.
- **470 µF capacitor:** **longer leg = `+`** → `5V`. The side with the **stripe /
  minus marks = `−`** → `GND`. Electrolytic caps can pop if reversed, so
  double-check this one.

Put the IR LEDs on **`5V`** (not `3V3`) for range, and point them at the AC/fan.

---

## 5. Full pin map (double-check against this)

| ESP32 pin | Connects to |
|-----------|-------------|
| `3V3` | VL53L0X VIN, DHT11 VCC |
| `5V` / `VIN` | IR LED supply, 470 µF `+` (optional) |
| `GND` | VL53L0X GND, DHT11 GND, buzzer `−`, transistor emitter, cap `−` |
| `GPIO21` | VL53L0X SDA |
| `GPIO22` | VL53L0X SCL |
| `GPIO25` | DHT11 DATA |
| `GPIO26` | Buzzer `+` |
| `GPIO27` | 220 Ω → 2N2222 base (optional) |

---

## 6. First power-on checklist

1. Re-check every `+` and `GND` against §5 **before** plugging in USB.
2. Plug in USB, open the Arduino **Serial Monitor at 115200 baud**.
3. You should see `HELM bar-node firmware …` then `[vl53l0x] ready`.
   - `[vl53l0x] NOT FOUND — check wiring!` → recheck SDA=21, SCL=22, VIN=3V3, GND.
4. Wave your hand in front of the sensor — the live distance should change.
5. Finish flashing `config.h` (see `firmware/README.md`) so it joins WiFi + MQTT.

That's it — sensor, climate, and buzzer working. The IR blaster is a bonus you
can add later.
