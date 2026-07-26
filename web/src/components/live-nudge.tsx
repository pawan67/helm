"use client";

import Link from "next/link";
import { Box, Circle, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import { ArrowRight, Radio } from "lucide-react";
import { useLive } from "@/components/live-provider";

/**
 * Dashboard banner that only appears while a session is live on the bar — a
 * quick jump to the live screen. Renders nothing when idle/offline.
 */
export function LiveNudge() {
  const { state } = useLive();
  const active = state.state === "hanging" || state.state === "rep_up";
  if (!active) return null;

  return (
    <Flex
      asChild
      align="center"
      gap="3"
      colorPalette="lime"
      borderWidth="1px"
      borderColor="colorPalette.muted"
      bg="colorPalette.subtle"
      rounded="xl"
      px="4"
      py="3"
      transition="background 0.15s"
      _hover={{ bg: "colorPalette.emphasized/40" }}
    >
      <Link href="/live">
        <Box
          rounded="full"
          boxSize="2.5"
          bg="colorPalette.solid"
          flexShrink="0"
          ring="4px"
          ringColor="colorPalette.solid/20"
        />
        <Box flex="1" minW="0">
          <HStack gap="2" color="colorPalette.fg" fontWeight="semibold">
            <Icon as={Radio} boxSize="4" />
            <Text>Session live</Text>
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            {state.reps} reps · on the bar now
          </Text>
        </Box>
        <HStack gap="1" color="colorPalette.fg" fontSize="sm">
          <Text>Watch</Text>
          <Icon as={ArrowRight} boxSize="4" />
        </HStack>
      </Link>
    </Flex>
  );
}
