import { FALLBACK_LOCALE, parseLocale, type AppLocale } from "../common/locale";

/**
 * What the bot says, in the game's three languages. Replies follow the
 * language of the Discord user who typed the command; announcements follow
 * the player's account.
 */
export interface DiscordMessages {
  linked: (username: string) => string;
  invalidCode: string;
  unlinked: string;
  notLinked: string;
  guildOnly: string;
  setupDone: (channelId: string) => string;
  setupFailed: (channelId: string) => string;
  setupWelcome: string;
  setupAlready: (channelId: string) => string;
  setupOff: string;
  setupWasOff: string;
  channelRemoved: (channelId: string) => string;
  channelNotListed: (channelId: string) => string;
  channelList: (channelIds: string[]) => string;
  /** `names` are already escaped. */
  announce: (mention: string, names: string[], shiny: boolean) => string;
  legendary: string;
}

const and = (names: string[], word: string): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} ${word} ${names[names.length - 1]}`;

export const DISCORD_MESSAGES: Record<AppLocale, DiscordMessages> = {
  fr: {
    linked: (username) =>
      `✅ Compte Discord **${username}** lié à Maladie Masters. Tes cartes légendaires seront annoncées sur les serveurs où le bot est installé.`,
    invalidCode:
      "❌ Code invalide ou expiré. Génère-en un nouveau sur le site Maladie Masters (page Discord).",
    unlinked: "✅ Ton compte Discord n'est plus lié : tes tirages ne seront plus annoncés.",
    notLinked: "Ton compte Discord n'est lié à aucun joueur.",
    guildOnly: "Cette commande ne marche que sur un serveur.",
    setupDone: (channelId) => `✅ Les cartes légendaires des membres seront annoncées dans <#${channelId}>.`,
    setupFailed: (channelId) =>
      `❌ Je ne peux pas écrire dans <#${channelId}>. Il me faut les permissions Voir le salon, Envoyer des messages et Intégrer des liens.`,
    setupWelcome:
      "🏆 Les cartes légendaires tirées sur Maladie Masters seront annoncées ici. Pour être mentionné, lie ton compte avec `/maladie link`.",
    setupAlready: (channelId) => `Les annonces sont déjà faites dans <#${channelId}>.`,
    setupOff: "🔕 Plus aucune annonce sur ce serveur.",
    setupWasOff: "Les annonces n'étaient pas activées sur ce serveur.",
    channelRemoved: (channelId) => `🔕 Plus d'annonce dans <#${channelId}>.`,
    channelNotListed: (channelId) => `Aucune annonce n'est faite dans <#${channelId}>.`,
    channelList: (channelIds) =>
      channelIds.length === 0
        ? "Aucun salon d'annonce sur ce serveur. Ajoute-en un avec `/maladie-setup channel`."
        : `Annonces dans : ${channelIds.map((id) => `<#${id}>`).join(", ")}.`,
    announce: (mention, names, shiny) =>
      names.length > 1
        ? `🏆 ${mention} vient de tirer ${names.length} cartes **légendaires** : ${and(names, "et")} !`
        : `${shiny ? "✨" : "🏆"} ${mention} vient de tirer une carte **légendaire${shiny ? " shiny" : ""}** : ${names[0]} !`,
    legendary: "Légendaire",
  },
  en: {
    linked: (username) =>
      `✅ Discord account **${username}** linked to Maladie Masters. Your legendary cards will be announced on the servers that installed the bot.`,
    invalidCode:
      "❌ Invalid or expired code. Get a new one on the Maladie Masters site (Discord page).",
    unlinked: "✅ Your Discord account is unlinked: your drops will no longer be announced.",
    notLinked: "Your Discord account is not linked to any player.",
    guildOnly: "This command only works in a server.",
    setupDone: (channelId) => `✅ Members' legendary cards will be announced in <#${channelId}>.`,
    setupFailed: (channelId) =>
      `❌ I cannot write in <#${channelId}>. I need the View Channel, Send Messages and Embed Links permissions.`,
    setupWelcome:
      "🏆 Legendary cards drawn on Maladie Masters will be announced here. To be mentioned, link your account with `/maladie link`.",
    setupAlready: (channelId) => `Announcements already go to <#${channelId}>.`,
    setupOff: "🔕 No more announcements on this server.",
    setupWasOff: "Announcements were not on for this server.",
    channelRemoved: (channelId) => `🔕 No more announcements in <#${channelId}>.`,
    channelNotListed: (channelId) => `No announcements go to <#${channelId}>.`,
    channelList: (channelIds) =>
      channelIds.length === 0
        ? "No announcement channel on this server. Add one with `/maladie-setup channel`."
        : `Announcing in: ${channelIds.map((id) => `<#${id}>`).join(", ")}.`,
    announce: (mention, names, shiny) =>
      names.length > 1
        ? `🏆 ${mention} just drew ${names.length} **legendary** cards: ${and(names, "and")}!`
        : `${shiny ? "✨" : "🏆"} ${mention} just drew a **${shiny ? "shiny " : ""}legendary** card: ${names[0]}!`,
    legendary: "Legendary",
  },
  zh: {
    linked: (username) =>
      `✅ Discord 账号 **${username}** 已绑定 Maladie Masters。你的传说卡牌将在安装了机器人的服务器上公布。`,
    invalidCode: "❌ 代码无效或已过期。请在 Maladie Masters 网站（Discord 页面）重新生成。",
    unlinked: "✅ 已解绑 Discord 账号：你的抽卡将不再公布。",
    notLinked: "你的 Discord 账号没有绑定任何玩家。",
    guildOnly: "此命令只能在服务器中使用。",
    setupDone: (channelId) => `✅ 成员抽到的传说卡牌将在 <#${channelId}> 公布。`,
    setupFailed: (channelId) =>
      `❌ 我无法在 <#${channelId}> 发言。需要“查看频道”、“发送消息”和“嵌入链接”权限。`,
    setupWelcome: "🏆 在 Maladie Masters 抽到的传说卡牌将在这里公布。用 `/maladie link` 绑定账号即可被提及。",
    setupAlready: (channelId) => `已经在 <#${channelId}> 公布。`,
    setupOff: "🔕 本服务器不再公布。",
    setupWasOff: "本服务器尚未开启公布。",
    channelRemoved: (channelId) => `🔕 不再在 <#${channelId}> 公布。`,
    channelNotListed: (channelId) => `<#${channelId}> 没有开启公布。`,
    channelList: (channelIds) =>
      channelIds.length === 0
        ? "本服务器没有公布频道。用 `/maladie-setup channel` 添加。"
        : `公布频道：${channelIds.map((id) => `<#${id}>`).join("、")}。`,
    announce: (mention, names, shiny) =>
      names.length > 1
        ? `🏆 ${mention} 抽到了 ${names.length} 张**传说**卡牌：${names.join("、")}！`
        : `${shiny ? "✨" : "🏆"} ${mention} 抽到了一张**${shiny ? "闪光" : ""}传说**卡牌：${names[0]}！`,
    legendary: "传说",
  },
};

/** Discord locales (`fr`, `en-US`, `zh-CN`, `zh-TW`, `pt-BR`…) → the game's. */
export function localeFromDiscord(...candidates: unknown[]): AppLocale {
  for (const candidate of candidates) {
    const locale = parseLocale(candidate);
    if (locale) return locale;
  }
  return FALLBACK_LOCALE;
}

export function discordMessages(locale: AppLocale): DiscordMessages {
  return DISCORD_MESSAGES[locale];
}

/**
 * Card names come from Wikipedia and usernames from Discord: neither should
 * be able to turn a message bold, strike it through or hide it in a spoiler.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>#[\]()-])/g, "\\$1");
}
