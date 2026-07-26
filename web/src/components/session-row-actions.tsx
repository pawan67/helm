"use client";

import { useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  HStack,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Pencil, Trash2 } from "lucide-react";

/** Edit + delete controls for a session row. Delete asks for confirmation. */
export function SessionRowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      await onDelete();
      setConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <HStack gap="1">
      <IconButton
        aria-label="Edit session"
        variant="ghost"
        size="sm"
        color="fg.muted"
        onClick={onEdit}
      >
        <Pencil />
      </IconButton>
      <IconButton
        aria-label="Delete session"
        variant="ghost"
        size="sm"
        color="fg.muted"
        _hover={{ color: "red.fg", bg: "bg.muted" }}
        onClick={() => setConfirm(true)}
      >
        <Trash2 />
      </IconButton>

      <Dialog.Root
        open={confirm}
        onOpenChange={(e) => setConfirm(e.open)}
        placement="center"
        role="alertdialog"
        size="sm"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="bg.panel">
              <Dialog.Header>
                <Dialog.Title>Delete this session?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted" fontSize="sm">
                  This permanently removes the session and its reps. Daily totals
                  and records will be recalculated.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  onClick={doDelete}
                  loading={deleting}
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
    </HStack>
  );
}
