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
    <Center minH="100dvh" bg="bg" px="5" py="10">
      <Box w="full" maxW="sm">
        <form onSubmit={submit}>
          <Card.Root bg="bg.panel">
            <Card.Header alignItems="center" textAlign="center" gap="3" pt="2">
              <Logo size={56} />
              <Heading size="3xl" color="lime.fg">
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
                  />
                </Field.Root>

                {error ? (
                  <Alert.Root status="error" size="sm">
                    <Alert.Indicator>
                      <Icon as={TriangleAlert} />
                    </Alert.Indicator>
                    <Alert.Title>{error}</Alert.Title>
                  </Alert.Root>
                ) : null}
              </Stack>
            </Card.Body>

            <Card.Footer>
              <Button
                type="submit"
                colorPalette="lime"
                size="lg"
                w="full"
                loading={loading}
                loadingText="Unlocking…"
                disabled={password.length === 0}
              >
                Take the helm
                <Icon as={ArrowRight} boxSize="4" />
              </Button>
            </Card.Footer>
          </Card.Root>
        </form>

        <Text mt="6" textAlign="center" fontSize="xs" color="fg.subtle">
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
