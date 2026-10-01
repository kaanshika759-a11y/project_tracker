import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, addDays } from "date-fns";

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

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: [{ createdAt: "asc" }, { key: "asc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/projects/:id/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const title = text(body.title, "Title", 200);
    const description = body.description != null
      ? text(body.description, "Description", 10000, false)
      : null;
    const assigneeId = text(body.assigneeId, "Assignee", 100);
    const dueDate = validateDate(body.dueDate);
    const priority = body.priority != null ? validatePriority(body.priority) : "normal";
    const status = body.status != null ? validateStatus(body.status) : "backlog";

    const isMember = project.members.some((m) => m.userId === assigneeId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Assignee must be a member of this project." },
        { status: 422 }
      );
    }

    const userExists = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json({ error: "Choose a valid team member." }, { status: 422 });
    }

    const nextTaskNumberRow = await prisma.task.aggregate({
      _max: { createdAt: true },
    });
    const allTasks = await prisma.task.findMany({
      select: { key: true },
    });
    const maxNum = allTasks.reduce((max, t) => {
      const m = t.key.match(/^HL-(\d+)$/);
      if (m) return Math.max(max, parseInt(m[1], 10));
      return max;
    }, 0);
    const nextNum = maxNum + 1;
    const key = `HL-${nextNum}`;

    const now = new Date().toISOString();

    const task = await prisma.task.create({
      data: {
        key,
        projectId: id,
        title,
        description,
        assigneeId,
        priority,
        status,
        dueDate,
        createdAt: now,
        movedAt: now,
        completedAt: status === "done" ? now : null,
      },
    });

    const userId = typeof body.userId === "string" && body.userId
      ? body.userId
      : (project.members[0]?.userId ?? assigneeId);
    await prisma.taskEvent.create({
      data: {
        taskId: task.id,
        projectId: id,
        userId,
        fromStatus: null,
        toStatus: status,
        createdAt: now,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/:id/tasks error:", error);
    const message = error instanceof Error ? error.message : "Failed to create task";
    const isValidation =
      error instanceof Error &&
      (message.includes("required.") ||
        message.includes("characters or fewer") ||
        message.includes("valid") ||
        message.includes("Choose a valid") ||
        message.includes("must be a member"));
    return NextResponse.json(
      { error: message },
      { status: isValidation ? 422 : 500 }
    );
  }
}
