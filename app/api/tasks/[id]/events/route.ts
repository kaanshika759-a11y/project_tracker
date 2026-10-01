import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const events = await prisma.taskEvent.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/tasks/:id/events error:", error);
    return NextResponse.json({ error: "Failed to fetch task events" }, { status: 500 });
  }
}
