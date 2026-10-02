-- Shiny copies: any drawn card, whatever its rarity, has a small chance to
-- come out shiny. The flag belongs to the copy, not to the card: the same
-- disease can be owned plain and shiny.

ALTER TABLE "pack_opening_cards" ADD COLUMN "is_shiny" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user_cards" ADD COLUMN "shiny_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "game_settings" ADD COLUMN "shiny_one_in" INTEGER NOT NULL DEFAULT 10000;
