import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      select: { id: true, _count: { select: { comments: true } } },
    });
    return NextResponse.json(Object.fromEntries(tasks.map(task => [task.id, task._count.comments])));
  } catch (error) {
    console.error("GET /api/projects/:id/comment-counts error:", error);
    return NextResponse.json({ error: "Failed to fetch comment counts" }, { status: 500 });
  }
}
