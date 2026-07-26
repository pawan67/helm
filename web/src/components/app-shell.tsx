"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Drawer,
  Flex,
  HStack,
  Icon,
  IconButton,
  Portal,
  Separator,
  Spacer,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LayoutDashboard,
  Radio,
  History,
  Trophy,
  Thermometer,
  Tv,
  Settings2,
  LogOut,
  Menu,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useLive } from "@/components/live-provider";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
};

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Body",
    items: [
      { label: "Live", href: "/live", icon: Radio },
      { label: "History", href: "/history", icon: History },
      { label: "Records", href: "/records", icon: Trophy },
    ],
  },
  {
    title: "Home",
    items: [
      { label: "Climate", href: "/environment", icon: Thermometer },
      { label: "Remote", href: "/remote", icon: Tv },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings2 }],
  },
];

const SIDEBAR_W = "256px";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Stencil wordmark at the top of the sidebar. */
function Brand() {
  return (
    <HStack gap="3" px="1">
      <Logo size={36} />
      <Box>
        <Text
          fontFamily="heading"
          fontWeight="800"
          letterSpacing="-0.02em"
          lineHeight="1"
          fontSize="22px"
        >
          Helm
        </Text>
        <HStack gap="1.5" mt="1">
          <Box boxSize="1.5" rounded="full" bg="lime.solid" />
          <Text fontSize="11px" fontWeight="medium" color="fg.subtle">
            Operator console
          </Text>
        </HStack>
      </Box>
    </HStack>
  );
}

/** Device panel pinned to the sidebar footer, styled like a status readout. */
function DeviceStatus() {
  const { state, connected } = useLive();
  const online = connected && state.deviceOnline;
  return (
    <Box
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      bg="bg.subtle"
      px="3"
      py="2.5"
      className="ih-machined"
    >
      <HStack justify="space-between">
        <HStack gap="2">
          <Icon
            as={online ? Wifi : WifiOff}
            boxSize="4"
            color={online ? "online.fg" : "fg.subtle"}
          />
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Device
          </Text>
        </HStack>
        <Badge
          size="sm"
          rounded="full"
          colorPalette={online ? "online" : "gray"}
          variant={online ? "surface" : "subtle"}
        >
          {online ? "Online" : "Offline"}
        </Badge>
      </HStack>
      <HStack
        justify="space-between"
        mt="2"
        fontFamily="mono"
        fontSize="11px"
        color="fg.subtle"
      >
        <Text>{state.rssi != null ? `${state.rssi} dBm` : "— dBm"}</Text>
        <Text>{connected ? "stream live" : "reconnecting…"}</Text>
      </HStack>
    </Box>
  );
}

/** Shared sidebar body (used by both the desktop rail and the mobile drawer). */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    onNavigate?.();
    router.push("/login");
    router.refresh();
  }

  return (
    <Flex direction="column" h="full" gap="7" py="5" px="4">
      <Brand />

      <Stack gap="5" flex="1">
        {NAV_SECTIONS.map((section) => (
          <Stack key={section.title} gap="0.5">
            <Text
              fontSize="xs"
              fontWeight="semibold"
              letterSpacing="0.02em"
              color="fg.subtle"
              px="3"
              mb="1.5"
            >
              {section.title}
            </Text>
            {section.items.map((item) =>
              item.soon ? (
                <Button
                  key={item.href}
                  variant="ghost"
                  justifyContent="flex-start"
                  size="md"
                  rounded="md"
                  color="fg.subtle"
                  disabled
                  _disabled={{ opacity: 0.55, cursor: "default" }}
                >
                  <Icon as={item.icon} boxSize="4" />
                  {item.label}
                  <Spacer />
                  <Badge
                    size="xs"
                    variant="surface"
                    colorPalette="gray"
                    rounded="full"
                  >
                    soon
                  </Badge>
                </Button>
              ) : (
                (() => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Button
                      key={item.href}
                      asChild
                      variant="ghost"
                      position="relative"
                      justifyContent="flex-start"
                      size="md"
                      rounded="md"
                      fontWeight={active ? "600" : "500"}
                      bg={active ? "bg.muted" : undefined}
                      color={active ? "lime.fg" : "fg.muted"}
                      _hover={{ bg: "bg.muted", color: active ? "lime.fg" : "fg" }}
                    >
                      <Link href={item.href} onClick={onNavigate}>
                        {active ? (
                          <Box
                            position="absolute"
                            left="0"
                            top="50%"
                            transform="translateY(-50%)"
                            w="3px"
                            h="56%"
                            bg="lime.solid"
                            rounded="full"
                          />
                        ) : null}
                        <Icon as={item.icon} boxSize="4" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })()
              ),
            )}
          </Stack>
        ))}
      </Stack>

      <Stack gap="3">
        <DeviceStatus />
        <Separator borderColor="border.subtle" />
        <Button
          variant="ghost"
          justifyContent="flex-start"
          color="fg.muted"
          _hover={{ bg: "bg.muted", color: "fg" }}
          size="sm"
          rounded="md"
          onClick={signOut}
        >
          <Icon as={LogOut} boxSize="4" />
          Sign out
        </Button>
      </Stack>
    </Flex>
  );
}

/** Top bar: mobile menu trigger + live stream status. */
function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { state, connected } = useLive();
  const active = state.state === "hanging" || state.state === "rep_up";

  return (
    <Flex
      as="header"
      position="sticky"
      top="0"
      zIndex="10"
      align="center"
      gap="3"
      h="14"
      px={{ base: "3", md: "6" }}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg.panel/85"
      backdropFilter="blur(8px)"
    >
      {/* live caution stripe under the bar while a session runs */}
      {active ? (
        <Box
          position="absolute"
          bottom="-1px"
          insetX="0"
          h="2px"
          className="ih-stripe-edge"
          opacity="0.9"
        />
      ) : null}

      <IconButton
        aria-label="Open menu"
        variant="ghost"
        size="sm"
        hideFrom="lg"
        onClick={onOpenMenu}
      >
        <Menu />
      </IconButton>

      <HStack gap="2.5" hideBelow="lg">
        <Box
          boxSize="2"
          rounded="full"
          bg={active ? "lime.solid" : connected ? "online.solid" : "danger.solid"}
          animation={active ? "ih-blink 1.1s ease-in-out infinite" : undefined}
        />
        <Text
          fontSize="sm"
          fontWeight="medium"
          color={active ? "lime.fg" : "fg.muted"}
        >
          {active ? "Session live on the bar" : "Standing by"}
        </Text>
      </HStack>

      <Spacer />

      <HStack gap="2">
        <Badge
          colorPalette={connected ? "online" : "danger"}
          variant="surface"
          size="sm"
          rounded="full"
        >
          <Box boxSize="1.5" rounded="full" bg={connected ? "online.solid" : "danger.solid"} />
          {connected ? "Stream" : "Offline"}
        </Badge>
        <Badge
          colorPalette={state.deviceOnline ? "online" : "gray"}
          variant="subtle"
          size="sm"
          rounded="full"
          hideBelow="sm"
        >
          Device {state.deviceOnline ? "on" : "off"}
        </Badge>
      </HStack>
    </Flex>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Flex minH="100dvh" bg="bg">
      {/* Desktop rail */}
      <Box
        as="nav"
        w={SIDEBAR_W}
        flexShrink="0"
        borderRightWidth="1px"
        borderColor="border.subtle"
        bg="bg.panel"
        position="fixed"
        insetY="0"
        left="0"
        hideBelow="lg"
      >
        <SidebarBody />
      </Box>

      {/* Mobile drawer */}
      <Drawer.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        placement="start"
        size="xs"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg="bg.panel" maxW={SIDEBAR_W}>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Main column */}
      <Flex direction="column" flex="1" minW="0" ml={{ base: "0", lg: SIDEBAR_W }}>
        <Topbar onOpenMenu={() => setOpen(true)} />
        <Box
          as="main"
          flex="1"
          w="full"
          maxW="6xl"
          mx="auto"
          px={{ base: "4", md: "8" }}
          py={{ base: "6", md: "9" }}
        >
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
