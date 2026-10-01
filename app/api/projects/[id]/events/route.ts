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

    const events = await prisma.taskEvent.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/projects/:id/events error:", error);
    return NextResponse.json({ error: "Failed to fetch project events" }, { status: 500 });
  }
}
