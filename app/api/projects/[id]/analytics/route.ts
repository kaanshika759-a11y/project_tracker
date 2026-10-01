import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAnalytics } from "@/lib/utils";

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

    const [tasks, events, members] = await Promise.all([
      prisma.task.findMany({
        where: { projectId: id },
      }),
      prisma.taskEvent.findMany({
        where: { projectId: id },
      }),
      prisma.projectMember.findMany({
        where: { projectId: id },
        include: { user: true },
      }),
    ]);

    const users = members.map((m) => m.user);

    const plainTasks = tasks.map((t) => ({
      id: t.id,
      key: t.key,
      projectId: t.projectId,
      title: t.title,
      description: t.description ?? undefined,
      assigneeId: t.assigneeId,
      priority: t.priority as "urgent" | "high" | "normal",
      status: t.status as "backlog" | "in_progress" | "review" | "done",
      dueDate: t.dueDate,
      createdAt: typeof t.createdAt === "string" ? t.createdAt : t.createdAt.toISOString(),
      movedAt: typeof t.movedAt === "string" ? t.movedAt : t.movedAt.toISOString(),
      completedAt: t.completedAt
        ? typeof t.completedAt === "string"
          ? t.completedAt
          : t.completedAt.toISOString()
        : null,
    }));

    const plainEvents = events.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      projectId: e.projectId,
      userId: e.userId,
      fromStatus: e.fromStatus as "backlog" | "in_progress" | "review" | "done" | null,
      toStatus: e.toStatus as "backlog" | "in_progress" | "review" | "done",
      createdAt: typeof e.createdAt === "string" ? e.createdAt : e.createdAt.toISOString(),
    }));

    const analytics = computeAnalytics(plainTasks, plainEvents, users);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("GET /api/projects/:id/analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
