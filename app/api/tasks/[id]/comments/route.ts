import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("GET /api/tasks/:id/comments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
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
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const authorId = typeof body.authorId === "string" && body.authorId.trim()
      ? body.authorId.trim()
      : null;
    const rawBody = body.body;

    if (!authorId) {
      return NextResponse.json({ error: "Author is required." }, { status: 422 });
    }
    if (typeof rawBody !== "string" || !rawBody.trim()) {
      return NextResponse.json({ error: "Comment is required." }, { status: 422 });
    }
    const commentText = rawBody.trim();
    if (commentText.length > 10000) {
      return NextResponse.json(
        { error: "Comment must be 10000 characters or fewer." },
        { status: 422 }
      );
    }

    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true },
    });
    if (!author) {
      return NextResponse.json({ error: "Choose a valid team member." }, { status: 422 });
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: id,
        authorId,
        body: commentText,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks/:id/comments error:", error);
    const message = error instanceof Error ? error.message : "Failed to add comment";
    const isValidation =
      error instanceof Error &&
      (message.includes("required") ||
        message.includes("characters or fewer") ||
        message.includes("valid team member"));
    return NextResponse.json(
      { error: message },
      { status: isValidation ? 422 : 500 }
    );
  }
}
