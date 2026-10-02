-- Packs move from one weight table shared by every slot (plus a guaranteed
-- RARE+ last slot) to a booster layout like the big TCGs': common slots, an
-- uncommon slot and a single rare slot, the only one that can give an epic or
-- a legendary. The old odds handed out a legendary about every 10 packs; the
-- new default, about every 60.

ALTER TABLE "game_settings" ADD COLUMN "pack_slots" JSONB NOT NULL DEFAULT '[
  {"count": 3, "weights": {"COMMON": 95, "UNCOMMON": 5, "RARE": 0, "EPIC": 0, "LEGENDARY": 0}},
  {"count": 1, "weights": {"COMMON": 0, "UNCOMMON": 90, "RARE": 10, "EPIC": 0, "LEGENDARY": 0}},
  {"count": 1, "weights": {"COMMON": 0, "UNCOMMON": 0, "RARE": 84.3, "EPIC": 14, "LEGENDARY": 1.7}}
]'::jsonb;

-- The default only serves the existing row: new rows get theirs from the code.
ALTER TABLE "game_settings" ALTER COLUMN "pack_slots" DROP DEFAULT;

ALTER TABLE "game_settings"
DROP COLUMN "cards_per_pack",
DROP COLUMN "guaranteed_rare_slot",
DROP COLUMN "drop_weight_common",
DROP COLUMN "drop_weight_uncommon",
DROP COLUMN "drop_weight_rare",
DROP COLUMN "drop_weight_epic",
DROP COLUMN "drop_weight_legendary";
