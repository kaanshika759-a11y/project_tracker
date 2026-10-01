import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        tasks: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("GET /api/projects/:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
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
    const existing = await prisma.project.findUnique({ where: { id }, include: { members: true } });
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name === undefined ? existing.name : typeof body.name === "string" ? body.name.trim() : "";
    const description = body.description === undefined ? existing.description ?? "" : typeof body.description === "string" ? body.description.trim() : "";
    const color = body.color === undefined ? existing.color : body.color;
    const memberIds = body.memberIds === undefined
      ? existing.members.map(member => member.userId)
      : Array.isArray(body.memberIds)
        ? [...new Set(body.memberIds.filter((value): value is string => typeof value === "string" && !!value))]
        : [];

    if (!name || name.length > 100) return NextResponse.json({ error: "Project name is required and must be 100 characters or fewer." }, { status: 422 });
    if (description.length > 2000) return NextResponse.json({ error: "Description must be 2000 characters or fewer." }, { status: 422 });
    if (!["teal", "indigo", "amber", "blue", "violet"].includes(String(color))) return NextResponse.json({ error: "Choose a supported project color." }, { status: 422 });
    if (!memberIds.length) return NextResponse.json({ error: "Select at least one project member." }, { status: 422 });

    const [users, assignedTasks] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true } }),
      prisma.task.findMany({ where: { projectId: id }, select: { assigneeId: true } }),
    ]);
    if (users.length !== memberIds.length) return NextResponse.json({ error: "Choose valid team members." }, { status: 422 });
    if (assignedTasks.some(task => !memberIds.includes(task.assigneeId))) {
      return NextResponse.json({ error: "Reassign tasks before removing their assignee from the project." }, { status: 422 });
    }

    const existingMemberIds = new Set(existing.members.map(member => member.userId));
    const addedMembers = memberIds.filter(userId => !existingMemberIds.has(userId));
    const removedMembers = [...existingMemberIds].filter(userId => !memberIds.includes(userId));
    const project = await prisma.$transaction(async tx => {
      if (removedMembers.length) {
        await tx.projectMember.deleteMany({ where: { projectId: id, userId: { in: removedMembers } } });
      }
      return tx.project.update({
        where: { id },
        data: {
          name,
          description,
          color: String(color),
          updatedAt: new Date(),
          ...(addedMembers.length ? { members: { create: addedMembers.map(userId => ({ userId })) } } : {}),
        },
        include: { members: { include: { user: true } }, tasks: true },
      });
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error("PATCH /api/projects/:id error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    await prisma.project.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/projects/:id error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
