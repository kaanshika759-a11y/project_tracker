import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowedTransitions, transitionError } from "@/lib/utils";

const PRIORITIES = ["urgent", "high", "normal"] as const;
const STATUSES = ["backlog", "in_progress", "review", "done"] as const;
type Priority = (typeof PRIORITIES)[number];
type Status = (typeof STATUSES)[number];

function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string" || (required && !value.trim())) {
    throw new Error(`${label} is required.`);
  }
  const result = value.trim();
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return result;
}

function validateDate(date: unknown): string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Choose a valid due date.");
  }
  return date;
}

function validateStatus(status: unknown): Status {
  if (typeof status !== "string" || !STATUSES.includes(status as Status)) {
    throw new Error("Choose a valid status.");
  }
  return status as Status;
}

function validatePriority(priority: unknown): Priority {
  if (typeof priority !== "string" || !PRIORITIES.includes(priority as Priority)) {
    throw new Error("Choose a valid priority.");
  }
  return priority as Priority;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("GET /api/tasks/:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const title = body.title !== undefined
      ? text(body.title, "Title", 200)
      : existing.title;
    const description = body.description !== undefined
      ? text(body.description, "Description", 10000, false)
      : existing.description ?? null;
    const assigneeId = body.assigneeId !== undefined
      ? text(body.assigneeId, "Assignee", 100)
      : existing.assigneeId;
    const dueDate = body.dueDate !== undefined
      ? validateDate(body.dueDate)
      : existing.dueDate;
    const priority = body.priority !== undefined
      ? validatePriority(body.priority)
      : (existing.priority as Priority);
    const newStatus = body.status !== undefined
      ? validateStatus(body.status)
      : null;

    if (body.assigneeId !== undefined) {
      const project = await prisma.project.findUnique({
        where: { id: existing.projectId },
        include: { members: true },
      });
      if (project && !project.members.some((m) => m.userId === assigneeId)) {
        return NextResponse.json(
          { error: "Assignee must be a member of this project." },
          { status: 422 }
        );
      }
    }

    const userId = typeof body.userId === "string" && body.userId ? body.userId : existing.assigneeId;
    const statusChanged = newStatus !== null && newStatus !== existing.status;
    if (statusChanged) {
      const allowed = allowedTransitions(existing.status as Status);
      if (!allowed.includes(newStatus as Status)) {
        return NextResponse.json(
          { error: transitionError(existing.status as Status, newStatus as Status), allowed, code: "INVALID_TRANSITION" },
          { status: 422 }
        );
      }
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!actor) return NextResponse.json({ error: "Choose a valid team member." }, { status: 422 });
    }

    const updated = await prisma.$transaction(async tx => {
      const now = new Date();
      if (statusChanged) {
        await tx.taskEvent.create({
          data: {
            taskId: id,
            projectId: existing.projectId,
            userId,
            fromStatus: existing.status,
            toStatus: newStatus as Status,
            createdAt: now,
          },
        });
      }
      return tx.task.update({
        where: { id },
        data: {
          title,
          description,
          assigneeId,
          dueDate,
          priority,
          ...(statusChanged ? {
            status: newStatus as Status,
            movedAt: now,
            completedAt: newStatus === "done" ? now : null,
          } : {}),
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/tasks/:id error:", error);
    const message = error instanceof Error ? error.message : "Failed to update task";
    const isValidation =
      error instanceof Error &&
      (message.includes("required.") ||
        message.includes("characters or fewer") ||
        message.includes("valid") ||
        message.includes("Choose a valid") ||
        message.includes("must be a member") ||
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.comment.deleteMany({ where: { taskId: id } }),
      prisma.taskEvent.deleteMany({ where: { taskId: id } }),
      prisma.task.delete({ where: { id } }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/tasks/:id error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
