import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  GetAdminSlidesResponse,
  GetSlidesResponse,
  UpdateSlideBody,
  UpdateSlideParams,
  UpdateSlideResponse,
} from "@workspace/api-zod";
import { db, slidesTable } from "@workspace/db";
import { requireAdmin } from "../lib/marrakech-auth";

const router: IRouter = Router();

router.get("/slides", async (_req, res): Promise<void> => {
  const rows = await db.select().from(slidesTable).orderBy(asc(slidesTable.orderIndex));
  res.json(
    GetSlidesResponse.parse(
      rows.map(({ id, title, subtitle, content, orderIndex }) => ({ id, title, subtitle, content, order: orderIndex })),
    ),
  );
});

router.get("/admin/slides", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(slidesTable).orderBy(asc(slidesTable.orderIndex));
  res.json(
    GetAdminSlidesResponse.parse(
      rows.map(({ id, title, subtitle, content, presenterNotes, orderIndex }) => ({
        id,
        title,
        subtitle,
        content,
        notes: presenterNotes,
        order: orderIndex,
      })),
    ),
  );
});

router.patch("/admin/slides/:slideId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateSlideParams.safeParse(req.params);
  const body = UpdateSlideBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const values = {
    ...(body.data.title !== undefined ? { title: body.data.title } : {}),
    ...(body.data.subtitle !== undefined ? { subtitle: body.data.subtitle } : {}),
    ...(body.data.content !== undefined ? { content: body.data.content } : {}),
    ...(body.data.notes !== undefined ? { presenterNotes: body.data.notes } : {}),
    updatedAt: new Date(),
  };
  const [row] = await db
    .update(slidesTable)
    .set(values)
    .where(eq(slidesTable.id, params.data.slideId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Slide not found." });
    return;
  }
  res.json(
    UpdateSlideResponse.parse({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      content: row.content,
      order: row.orderIndex,
      notes: row.presenterNotes,
    }),
  );
});

export default router;
