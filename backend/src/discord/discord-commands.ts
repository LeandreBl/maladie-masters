/**
 * The bot's slash commands, registered globally at boot (bulk overwrite, so
 * a renamed option replaces the old one). English only, names and
 * descriptions alike: a localized name would make `/maladie link`, as written
 * on the site and in the docs, not match in a French client.
 */

/** Discord's application command option types. */
const SUB_COMMAND = 1;
const STRING = 3;
const CHANNEL = 7;
/**
 * Text and announcement channels, and the threads in them (announcement,
 * public, private): the bot posts nowhere else. A thread is a channel to the
 * REST API, so posting there needs nothing special.
 */
const POSTABLE_CHANNEL_TYPES = [0, 5, 10, 11, 12];
/** Manage Server, so that any member cannot redirect the announcements. */
const MANAGE_GUILD = String(1 << 5);
/** Interaction contexts: a server, and a DM with the bot. */
const GUILD = 0;
const BOT_DM = 1;

export const COMMAND_PLAYER = "maladie";
export const COMMAND_SETUP = "maladie-setup";

export const SUB_LINK = "link";
export const SUB_UNLINK = "unlink";
export const SUB_CHANNEL = "channel";
export const SUB_OFF = "off";
export const SUB_LIST = "list";

export const OPTION_CODE = "code";
export const OPTION_CHANNEL = "channel";

export const DISCORD_COMMANDS = [
  {
    name: COMMAND_PLAYER,
    description: "Maladie Masters: your account",
    contexts: [GUILD, BOT_DM],
    integration_types: [0],
    options: [
      {
        type: SUB_COMMAND,
        name: SUB_LINK,
        description: "Link your Discord account with the code shown on the site",
        options: [
          {
            type: STRING,
            name: OPTION_CODE,
            description: "The code, e.g. K7PQ-3MZA",
            required: true,
            min_length: 8,
            max_length: 12,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: SUB_UNLINK,
        description: "Stop announcing your drops",
      },
    ],
  },
  {
    name: COMMAND_SETUP,
    description: "Maladie Masters: where to announce legendary cards",
    default_member_permissions: MANAGE_GUILD,
    contexts: [GUILD],
    integration_types: [0],
    options: [
      {
        type: SUB_COMMAND,
        name: SUB_CHANNEL,
        description: "Announce members' legendary cards in a channel",
        options: [
          {
            type: CHANNEL,
            name: OPTION_CHANNEL,
            description: "The channel (this one by default)",
            channel_types: POSTABLE_CHANNEL_TYPES,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: SUB_OFF,
        description: "Stop announcing in a channel, or in all of them",
        options: [
          {
            type: CHANNEL,
            name: OPTION_CHANNEL,
            description: "The channel (all of the server's by default)",
            channel_types: POSTABLE_CHANNEL_TYPES,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: SUB_LIST,
        description: "Show the channels announcements go to",
      },
    ],
  },
];
