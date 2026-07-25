"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  Center,
  Field,
  Heading,
  Icon,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/logo";
import { Eyebrow } from "@/components/shared/bits";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }
      const from = params.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <Center
      minH="100dvh"
      bg="bg"
      px="5"
      py="10"
      position="relative"
      overflow="hidden"
    >
      {/* atmosphere */}
      <Box
        position="absolute"
        top="33%"
        left="50%"
        boxSize="420px"
        transform="translate(-50%, -50%)"
        rounded="full"
        bg="hazard.solid/10"
        filter="blur(140px)"
        pointerEvents="none"
      />

      <Box
        w="full"
        maxW="sm"
        position="relative"
        zIndex="1"
        animation="ih-rise 0.4s ease-out"
      >
        <form onSubmit={submit}>
          <Card.Root bg="bg.panel">
            <Card.Header alignItems="center" textAlign="center" gap="3" pt="2">
              <Box position="relative">
                <Box
                  position="absolute"
                  inset="0"
                  rounded="2xl"
                  bg="hazard.solid/15"
                  filter="blur(20px)"
                />
                <Logo size={56} />
              </Box>
              <Heading size="3xl" letterSpacing="wide" color="hazard.fg">
                HELM
              </Heading>
              <Eyebrow>operator console</Eyebrow>
            </Card.Header>

            <Card.Body>
              <Stack gap="4">
                <Field.Root invalid={!!error}>
                  <Field.Label htmlFor="access-key">
                    <Eyebrow>Access key</Eyebrow>
                  </Field.Label>
                  <Input
                    id="access-key"
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    size="lg"
                    fontFamily="mono"
                    letterSpacing="widest"
                  />
                </Field.Root>

                {error ? (
                  <Alert.Root status="error" size="sm">
                    <Alert.Indicator>
                      <Icon as={TriangleAlert} />
                    </Alert.Indicator>
                    <Alert.Title fontFamily="mono">{error}</Alert.Title>
                  </Alert.Root>
                ) : null}
              </Stack>
            </Card.Body>

            <Card.Footer>
              <Button
                type="submit"
                colorPalette="hazard"
                size="lg"
                w="full"
                loading={loading}
                loadingText="UNLOCKING…"
                disabled={password.length === 0}
              >
                TAKE THE HELM
                <Icon as={ArrowRight} boxSize="4" />
              </Button>
            </Card.Footer>
          </Card.Root>
        </form>

        <Text
          mt="6"
          textAlign="center"
          fontFamily="mono"
          fontSize="xs"
          color="fg.subtle"
        >
          single-user access · self-hosted
        </Text>
      </Box>
    </Center>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
