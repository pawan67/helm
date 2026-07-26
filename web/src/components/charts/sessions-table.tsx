"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  CloseButton,
  Dialog,
  EmptyState,
  Flex,
  HStack,
  Icon,
  IconButton,
  Pagination,
  Portal,
  SegmentGroup,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Trash2,
  X,
} from "lucide-react";
import type { Session } from "@/db/schema";
import { SessionForm } from "@/components/session-form";
import { SessionRowActions } from "@/components/session-row-actions";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { toaster } from "@/components/ui/toaster";
import { Eyebrow, TypeBadge } from "@/components/shared/bits";
import { formatHang } from "@/lib/time";

const PAGE_SIZE = 20;

type TypeFilter = "all" | "pullup_set" | "dead_hang";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pullup_set", label: "Pull-ups" },
  { value: "dead_hang", label: "Hangs" },
];

/** Turn the API's ISO strings back into Date objects for the editor form. */
function hydrate(s: Session): Session {
  return {
    ...s,
    startedAt: new Date(s.startedAt),
    endedAt: new Date(s.endedAt),
    createdAt: new Date(s.createdAt),
  };
}

/**
 * Filterable, selectable table of every logged session. Owns its own filter /
 * pagination / selection state and fetches server-side so the date range spans
 * all of history, not just a recent window. `onMutate` lets the parent refresh
 * its charts when a session is edited or deleted here.
 */
export function SessionsTable({ onMutate }: { onMutate?: () => void }) {
  const [type, setType] = useState<TypeFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Session editor (edit only — there's no add entry point on this screen).
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);

  // Bulk-delete confirmation.
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const anyFilter = type !== "all" || from !== "" || to !== "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (type !== "all") params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/sessions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const next: Session[] = data.sessions ?? [];
        const count: number = data.total ?? 0;
        setTotal(count);
        setSelected(new Set());
        // A delete can empty the last page — fall back onto the new last page.
        const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
        if (page > pageCount) {
          setPage(pageCount);
        } else {
          setRows(next);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [type, from, to, page, reload]);

  const refresh = () => setReload((n) => n + 1);

  // Filter changes reset to the first page so results aren't hidden off-page.
  function pickType(v: TypeFilter) {
    setType(v);
    setPage(1);
  }
  function pickRange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setPage(1);
  }
  function clearFilters() {
    setType("all");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const headerState: boolean | "indeterminate" = allOnPage
    ? true
    : selected.size > 0
      ? "indeterminate"
      : false;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }
  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openEdit(session: Session) {
    setEditing(session);
    setFormOpen(true);
  }

  async function removeOne(id: string) {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toaster.create({ title: "Session deleted", type: "success" });
      refresh();
      onMutate?.();
    } else {
      toaster.create({ title: "Couldn't delete the session", type: "error" });
    }
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = [...selected];
      const res = await fetch(`/api/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        const data = await res.json();
        const n = data.deleted ?? ids.length;
        toaster.create({
          title: `Deleted ${n} session${n === 1 ? "" : "s"}`,
          type: "success",
        });
        setConfirmBulk(false);
        setSelected(new Set());
        refresh();
        onMutate?.();
      } else {
        toaster.create({
          title: "Couldn't delete the selected sessions",
          type: "error",
        });
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <Card.Root bg="bg.panel">
      <Card.Header pb="0">
        <HStack justify="space-between">
          <HStack gap="2" color="fg.muted">
            <Icon as={History} boxSize="3.5" color="fg.muted" />
            <Eyebrow>All sessions</Eyebrow>
          </HStack>
          <Text
            fontFamily="mono"
            fontSize="xs"
            color="fg.subtle"
            fontVariantNumeric="tabular-nums"
          >
            {total}
          </Text>
        </HStack>
      </Card.Header>

      <Card.Body>
        <Stack gap="4">
          {/* Filters */}
          <Flex
            gap="3"
            align={{ base: "stretch", md: "center" }}
            direction={{ base: "column", md: "row" }}
            wrap="wrap"
          >
            <SegmentGroup.Root
              value={type}
              onValueChange={(e) => e.value && pickType(e.value as TypeFilter)}
              size="sm"
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items items={TYPE_FILTERS} />
            </SegmentGroup.Root>

            <DateRangePicker from={from} to={to} onChange={pickRange} />

            {anyFilter ? (
              <Button
                variant="ghost"
                size="sm"
                color="fg.muted"
                onClick={clearFilters}
              >
                <Icon as={X} boxSize="3.5" />
                Clear
              </Button>
            ) : null}
          </Flex>

          {/* Selection action bar */}
          {selected.size > 0 ? (
            <Flex
              align="center"
              gap="3"
              px="3"
              py="2"
              rounded="md"
              bg="bg.muted"
              borderWidth="1px"
              borderColor="border.subtle"
            >
              <Text fontSize="sm" fontWeight="medium">
                {selected.size} selected
              </Text>
              <Button
                size="xs"
                colorPalette="red"
                variant="subtle"
                onClick={() => setConfirmBulk(true)}
              >
                <Icon as={Trash2} boxSize="3.5" />
                Delete
              </Button>
              <Button
                size="xs"
                variant="ghost"
                color="fg.muted"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </Flex>
          ) : null}

          {/* Table / states */}
          {loading && rows.length === 0 ? (
            <Flex justify="center" py="10">
              <Spinner size="md" color="lime.solid" />
            </Flex>
          ) : total === 0 ? (
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Icon as={History} />
                </EmptyState.Indicator>
                <EmptyState.Title>
                  {anyFilter ? "No sessions match these filters" : "No sessions logged"}
                </EmptyState.Title>
                <EmptyState.Description>
                  {anyFilter
                    ? "Try widening the date range or clearing the type filter."
                    : "Your recorded sets and hangs will appear here as you train."}
                </EmptyState.Description>
                {anyFilter ? (
                  <Button variant="outline" size="sm" onClick={clearFilters} mt="2">
                    Clear filters
                  </Button>
                ) : null}
              </EmptyState.Content>
            </EmptyState.Root>
          ) : (
            <Box opacity={loading ? 0.6 : 1} transition="opacity 0.2s">
              <Table.ScrollArea borderWidth="1px" rounded="md">
                <Table.Root size="sm" interactive stickyHeader>
                  <Table.Header>
                    <Table.Row bg="bg.panel">
                      <Table.ColumnHeader w="12" px="3">
                        <Checkbox.Root
                          size="sm"
                          aria-label="Select all on this page"
                          checked={headerState}
                          onCheckedChange={(e) => toggleAll(e.checked === true)}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                        </Checkbox.Root>
                      </Table.ColumnHeader>
                      <Table.ColumnHeader>Type</Table.ColumnHeader>
                      <Table.ColumnHeader>When</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Reps</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Best hang</Table.ColumnHeader>
                      <Table.ColumnHeader w="12" />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {rows.map((s) => {
                      const started = new Date(s.startedAt);
                      const checked = selected.has(s.id);
                      return (
                        <Table.Row
                          key={s.id}
                          bg={checked ? "bg.muted" : undefined}
                        >
                          <Table.Cell px="3">
                            <Checkbox.Root
                              size="sm"
                              aria-label="Select session"
                              checked={checked}
                              onCheckedChange={(e) =>
                                toggleRow(s.id, e.checked === true)
                              }
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control />
                            </Checkbox.Root>
                          </Table.Cell>
                          <Table.Cell>
                            <TypeBadge type={s.type} />
                          </Table.Cell>
                          <Table.Cell>
                            <Stack gap="0">
                              <Text fontSize="sm" whiteSpace="nowrap">
                                {started.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </Text>
                              <Text fontSize="11px" color="fg.subtle">
                                {started.toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </Stack>
                          </Table.Cell>
                          <Table.Cell
                            textAlign="end"
                            fontVariantNumeric="tabular-nums"
                          >
                            {s.reps > 0 ? s.reps : "—"}
                          </Table.Cell>
                          <Table.Cell
                            textAlign="end"
                            fontVariantNumeric="tabular-nums"
                            whiteSpace="nowrap"
                          >
                            {formatHang(s.maxHangMs)}
                          </Table.Cell>
                          <Table.Cell textAlign="end" px="2">
                            <SessionRowActions
                              onEdit={() => openEdit(hydrate(s))}
                              onDelete={() => removeOne(s.id)}
                            />
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
            </Box>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE ? (
            <Flex justify="space-between" align="center" wrap="wrap" gap="3">
              <Text fontSize="xs" color="fg.subtle" fontVariantNumeric="tabular-nums">
                Showing {rangeStart}–{rangeEnd} of {total}
              </Text>
              <Pagination.Root
                count={total}
                pageSize={PAGE_SIZE}
                page={page}
                onPageChange={(e) => setPage(e.page)}
              >
                <ButtonGroup variant="ghost" size="sm" gap="1">
                  <Pagination.PrevTrigger asChild>
                    <IconButton aria-label="Previous page">
                      <ChevronLeft />
                    </IconButton>
                  </Pagination.PrevTrigger>
                  <Pagination.PageText />
                  <Pagination.NextTrigger asChild>
                    <IconButton aria-label="Next page">
                      <ChevronRight />
                    </IconButton>
                  </Pagination.NextTrigger>
                </ButtonGroup>
              </Pagination.Root>
            </Flex>
          ) : null}
        </Stack>
      </Card.Body>

      <SessionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        session={editing}
        onSaved={() => {
          refresh();
          onMutate?.();
        }}
      />

      {/* Bulk-delete confirmation */}
      <Dialog.Root
        open={confirmBulk}
        onOpenChange={(e) => setConfirmBulk(e.open)}
        placement="center"
        role="alertdialog"
        size="sm"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="bg.panel">
              <Dialog.Header>
                <Dialog.Title>
                  Delete {selected.size} session{selected.size === 1 ? "" : "s"}?
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted" fontSize="sm">
                  This permanently removes the selected sessions and their reps.
                  Daily totals and records will be recalculated.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  onClick={bulkDelete}
                  loading={bulkDeleting}
                  loadingText="Deleting…"
                >
                  Delete
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Card.Root>
  );
}
