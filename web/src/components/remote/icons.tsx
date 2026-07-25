import {
  AirVent,
  Fan,
  Tv,
  Power,
  Gauge,
  Zap,
  Moon,
  Timer,
  Lightbulb,
  Dot,
  Wind,
  Snowflake,
  Sun,
  Volume2,
  Volume1,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ChevronUp,
  ChevronDown,
  Radio,
  Speaker,
  Projector,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

/** Icon keys stored on devices/buttons → lucide components. */
export const IR_ICONS: Record<string, LucideIcon> = {
  "air-vent": AirVent,
  fan: Fan,
  tv: Tv,
  power: Power,
  gauge: Gauge,
  zap: Zap,
  moon: Moon,
  timer: Timer,
  lightbulb: Lightbulb,
  dot: Dot,
  wind: Wind,
  snowflake: Snowflake,
  sun: Sun,
  "volume-2": Volume2,
  "volume-1": Volume1,
  "volume-x": VolumeX,
  play: Play,
  pause: Pause,
  "skip-forward": SkipForward,
  "skip-back": SkipBack,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  radio: Radio,
  speaker: Speaker,
  projector: Projector,
  thermometer: Thermometer,
};

export const IR_ICON_KEYS = Object.keys(IR_ICONS);

/** Lucide component for an icon key, falling back to a neutral dot. */
export function iconFor(key: string | null | undefined): LucideIcon {
  return (key && IR_ICONS[key]) || Dot;
}
