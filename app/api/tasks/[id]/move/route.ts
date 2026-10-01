import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowedTransitions, transitionError } from "@/lib/utils";

const STATUSES = ["backlog", "in_progress", "review", "done"] as const;
type Status = (typeof STATUSES)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const toStatusRaw = body.toStatus;
    if (typeof toStatusRaw !== "string" || !STATUSES.includes(toStatusRaw as Status)) {
      return NextResponse.json({ error: "Choose a valid status." }, { status: 422 });
    }
    const toStatus = toStatusRaw as Status;
    const userId = typeof body.userId === "string" && body.userId
      ? body.userId
      : existing.assigneeId;

    const fromStatus = existing.status as Status;
    const allowed = allowedTransitions(fromStatus);
    if (!allowed.includes(toStatus)) {
      return NextResponse.json(
        {
          error: transitionError(fromStatus, toStatus),
          allowed,
          code: "INVALID_TRANSITION",
        },
        { status: 422 }
      );
    }

    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) {
      return NextResponse.json({ error: "Choose a valid team member." }, { status: 422 });
    }

    const now = new Date().toISOString();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.taskEvent.create({
        data: {
          taskId: id,
          projectId: existing.projectId,
          userId,
          fromStatus: existing.status,
          toStatus,
          createdAt: now,
        },
      });

      return tx.task.update({
        where: { id },
        data: {
          status: toStatus,
          movedAt: now,
          completedAt: toStatus === "done" ? now : null,
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/tasks/:id/move error:", error);
    const message = error instanceof Error ? error.message : "Failed to move task";
    const isValidation =
      error instanceof Error &&
      (message.includes("valid status") ||
        message.includes("valid team member") ||
        message.includes("must move") ||
        message.includes("must go through") ||
        message.includes("must reopen") ||
        message.includes("can only move"));
    return NextResponse.json(
      { error: message },
      { status: isValidation ? 422 : 500 }
    );
  }
}
