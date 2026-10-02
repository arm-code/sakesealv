import type { ShelfRepositoryPort } from "@/lib/server/application/ports";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { bookShelves, shelves } from "@/lib/server/infrastructure/db/schema";
import { createChildLogger } from "@/lib/server/infrastructure/logging/logger";
import { createEmptyRuleGroup, isRuleGroup, type LibraryShelf, type RuleGroup } from "@/lib/types/library";
import { desc, eq, inArray } from "drizzle-orm";

function deserializeRuleGroup(
  raw: string,
  onInvalidRuleGroup?: (raw: string, reason: "invalid_json" | "invalid_shape") => void,
): RuleGroup {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRuleGroup(parsed)) return parsed;
    onInvalidRuleGroup?.(raw, "invalid_shape");
  } catch {
    onInvalidRuleGroup?.(raw, "invalid_json");
  }
  return createEmptyRuleGroup();
}

function getRuleGroupPreview(raw: string): string {
  return raw.length <= 180 ? raw : `${raw.slice(0, 180)}...`;
}

export class ShelfRepository implements ShelfRepositoryPort {
  private readonly repoLogger = createChildLogger({ repository: "ShelfRepository" });

  private mapRow(row: typeof shelves.$inferSelect): LibraryShelf {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      sortOrder: row.sortOrder,
      ruleGroup: deserializeRuleGroup(row.ruleGroupJson, (raw, reason) => {
        this.repoLogger.warn(
          {
            event: reason === "invalid_json" ? "shelf.rule_group.invalid_json" : "shelf.rule_group.invalid_shape",
            shelfId: row.id,
            rawPreview: getRuleGroupPreview(raw),
          },
          "Invalid shelf rule data encountered, fallback applied",
        );
      }),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(): Promise<LibraryShelf[]> {
    const rows = await drizzleDb.select().from(shelves).orderBy(shelves.sortOrder, shelves.name);
    return rows.map((row) => this.mapRow(row));
  }

  async listByIds(ids: number[]): Promise<LibraryShelf[]> {
    if (ids.length === 0) return [];
    const rows = await drizzleDb
      .select()
      .from(shelves)
      .where(inArray(shelves.id, ids))
      .orderBy(shelves.sortOrder, shelves.name);
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: number): Promise<LibraryShelf | undefined> {
    const [row] = await drizzleDb.select().from(shelves).where(eq(shelves.id, id)).limit(1);
    return row ? this.mapRow(row) : undefined;
  }

  async create(input: { name: string; icon: string; ruleGroup: RuleGroup }): Promise<LibraryShelf> {
    const now = new Date().toISOString();
    const [lastShelf] = await drizzleDb.select({ sortOrder: shelves.sortOrder }).from(shelves).orderBy(desc(shelves.sortOrder)).limit(1);
    const nextSortOrder = (lastShelf?.sortOrder ?? -1) + 1;

    const [created] = await drizzleDb
      .insert(shelves)
      .values({
        name: input.name,
        icon: input.icon,
        sortOrder: nextSortOrder,
        ruleGroupJson: JSON.stringify(input.ruleGroup),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) throw new Error("Failed to create shelf");

    this.repoLogger.info({ event: "shelf.created", shelfId: created.id, name: created.name }, "Shelf row inserted");
    return this.mapRow(created);
  }

  async update(id: number, input: { name: string; icon: string; ruleGroup: RuleGroup }): Promise<LibraryShelf | undefined> {
    const [updated] = await drizzleDb
      .update(shelves)
      .set({ name: input.name, icon: input.icon, ruleGroupJson: JSON.stringify(input.ruleGroup), updatedAt: new Date().toISOString() })
      .where(eq(shelves.id, id))
      .returning();

    if (!updated) return undefined;

    this.repoLogger.info({ event: "shelf.updated", shelfId: id, name: updated.name }, "Shelf row updated");
    return this.mapRow(updated);
  }

  async reorder(shelfIds: number[]): Promise<void> {
    if (shelfIds.length === 0) return;
    if (!shelfIds.every((id) => Number.isInteger(id) && id > 0)) {
      throw new Error("Invalid shelf IDs for reorder");
    }

    const now = new Date().toISOString();
    const whenClauses = shelfIds.map((id, index) => `WHEN ${id} THEN ${index}`).join(" ");
    const idList = shelfIds.join(", ");
    const escapedNow = now.replace(/'/g, "''");

    await drizzleDb.$client.execute(
      `UPDATE "Shelves"
SET "sort_order" = CASE "id" ${whenClauses} ELSE "sort_order" END,
    "updated_at" = '${escapedNow}'
WHERE "id" IN (${idList})`,
    );
    this.repoLogger.info({ event: "shelf.reordered", shelfIds }, "Shelf order updated");
  }

  async delete(id: number): Promise<void> {
    await drizzleDb.delete(shelves).where(eq(shelves.id, id));
    this.repoLogger.info({ event: "shelf.deleted", shelfId: id }, "Shelf row deleted");
  }

  async getBookShelfIds(bookId: number): Promise<number[]> {
    const rows = await drizzleDb.select({ shelfId: bookShelves.shelfId }).from(bookShelves).where(eq(bookShelves.bookId, bookId));
    return rows.map((row) => row.shelfId).sort((a, b) => a - b);
  }

  async getBookShelfIdsForBooks(bookIds: number[]): Promise<Record<number, number[]>> {
    const result: Record<number, number[]> = {};
    for (const bookId of bookIds) result[bookId] = [];
    if (bookIds.length === 0) return result;

    const rows = await drizzleDb
      .select({ bookId: bookShelves.bookId, shelfId: bookShelves.shelfId })
      .from(bookShelves)
      .where(inArray(bookShelves.bookId, bookIds));

    for (const row of rows) {
      if (!result[row.bookId]) result[row.bookId] = [];
      result[row.bookId].push(row.shelfId);
    }
    for (const bookId of Object.keys(result)) {
      result[Number(bookId)].sort((a, b) => a - b);
    }
    return result;
  }

  async setBookShelfIds(bookId: number, shelfIds: number[]): Promise<void> {
    const uniqueShelfIds = [...new Set(shelfIds)].sort((a, b) => a - b);
    const now = new Date().toISOString();

    await drizzleDb.transaction(async (tx) => {
      await tx.delete(bookShelves).where(eq(bookShelves.bookId, bookId));
      if (uniqueShelfIds.length === 0) return;
      await tx.insert(bookShelves).values(uniqueShelfIds.map((shelfId) => ({ bookId, shelfId, createdAt: now })));
    });

    this.repoLogger.info({ event: "book.shelves.updated", bookId, shelfIds: uniqueShelfIds }, "Book shelf membership updated");
  }
}
