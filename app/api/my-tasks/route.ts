import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const tasks = await prisma.task.findMany({
      where: { assigneeId: userId },
      orderBy: [
        { projectId: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/my-tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch my tasks" },
      { status: 500 }
    );
  }
}
