import type { ReactNode } from "react";
import { Box, Flex, HStack, Square, Stack, Text } from "@chakra-ui/react";
import type { Session } from "@/db/schema";
import { Metric, TypeBadge } from "@/components/shared/bits";
import { formatHang } from "@/lib/time";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A single session in a list. Left tile shows the headline metric (reps for a
 * pull-up set, best hold for a dead hang); right column shows the detail.
 */
export function SessionRow({
  session,
  actions,
}: {
  session: Session;
  /** Optional trailing controls (e.g. edit/delete), shown at the far right. */
  actions?: ReactNode;
}) {
  const isPull = session.type === "pullup_set";
  const started = new Date(session.startedAt);
  const accent = isPull ? "teal" : "cyan";

  return (
    <Flex
      align="center"
      gap="3.5"
      py="3"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      _last={{ borderBottomWidth: "0" }}
    >
      <Square
        size="11"
        rounded="lg"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
        colorPalette={accent}
      >
        <Metric fontSize="lg" color="colorPalette.fg">
          {isPull ? session.reps : formatHang(session.maxHangMs).replace(" ", "")}
        </Metric>
      </Square>

      <Stack gap="1" flex="1" minW="0">
        <Box>
          <TypeBadge type={session.type} />
        </Box>
        <Text fontFamily="mono" fontSize="11px" color="fg.subtle">
          {started.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {timeAgo(started)}
        </Text>
      </Stack>

      <Stack gap="0.5" textAlign="right">
        {isPull ? (
          <>
            <Text fontFamily="mono" fontSize="sm" fontVariantNumeric="tabular-nums">
              {session.reps} reps
            </Text>
            <Text fontFamily="mono" fontSize="11px" color="fg.subtle">
              {formatHang(session.hangMs)} on bar
            </Text>
          </>
        ) : (
          <>
            <Text fontFamily="mono" fontSize="sm" fontVariantNumeric="tabular-nums">
              {formatHang(session.maxHangMs)}
            </Text>
            <Text fontFamily="mono" fontSize="11px" color="fg.subtle">
              best hold
            </Text>
          </>
        )}
      </Stack>

      {actions ? <Box flexShrink="0">{actions}</Box> : null}
    </Flex>
  );
}
