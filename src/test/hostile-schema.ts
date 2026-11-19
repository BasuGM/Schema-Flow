import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import type { Schema } from "@/domain/schema/types";

// Every character that has ever broken a text generator: both quotes, backtick, backslash, newline,
// a SQL line-comment opener and a block-comment closer.
export const HOSTILE = "q'u\"o`t\\e\nn--l*/e";

/**
 * A schema whose table, column, comments, enum name/values and default all contain `HOSTILE`, to
 * prove generators escape every user string and not only identifiers.
 */
export function hostileSchema(): Schema {
  return normalizeSchema(
    draft(
      [
        {
          name: `t${HOSTILE}`,
          comment: `table ${HOSTILE}`,
          columns: [
            { name: "id", type: "int", nullable: false, primaryKey: true },
            {
              name: `c${HOSTILE}`,
              type: "text",
              comment: `column ${HOSTILE}`,
              default: { kind: "literal", value: `'${HOSTILE.replace(/'/g, "''")}'` },
            },
            { name: "kind", type: `k${HOSTILE}` },
          ],
        },
      ],
      {
        name: `db ${HOSTILE}`,
        enums: [{ name: `k${HOSTILE}`, values: [`v${HOSTILE}`, "plain"] }],
      },
    ),
  );
}
