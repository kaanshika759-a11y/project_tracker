import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "asc",
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        tasks: true,
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("GET /api/projects error:", error);

    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const color = body.color;
    const memberIds = Array.isArray(body.memberIds)
      ? [...new Set(body.memberIds.filter((id): id is string => typeof id === "string" && !!id))]
      : [];

    if (!name || name.length > 100) {
      return NextResponse.json({ error: "Project name is required and must be 100 characters or fewer." }, { status: 422 });
    }
    if (description.length > 2000) {
      return NextResponse.json({ error: "Description must be 2000 characters or fewer." }, { status: 422 });
    }
    if (!["teal", "indigo", "amber", "blue", "violet"].includes(String(color))) {
      return NextResponse.json({ error: "Choose a supported project color." }, { status: 422 });
    }
    if (!memberIds.length) {
      return NextResponse.json({ error: "Select at least one project member." }, { status: 422 });
    }
    const users = await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true } });
    if (users.length !== memberIds.length) {
      return NextResponse.json({ error: "Choose valid team members." }, { status: 422 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        color: String(color),
        members: { create: memberIds.map(userId => ({ userId })) },
      },
      include: { members: { include: { user: true } }, tasks: true },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
