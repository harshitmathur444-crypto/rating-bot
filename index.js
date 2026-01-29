const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const db = require("./database");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "+";
const RATE_LOG_CHANNEL = "1466387536774434887";

function isWhitelisted(userId) {
  return new Promise((resolve) => {
    db.get(
      "SELECT userId FROM whitelist WHERE userId = ?",
      [userId],
      (err, row) => resolve(!!row)
    );
  });
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "rate") {
    const mentions = [...message.mentions.users.values()];
    if (mentions.length === 0 || mentions.length > 3)
      return message.reply("❌ Mention 1–3 staff only.");

    const ratingPart = args.find(a => a.includes(","));
    if (!ratingPart) return message.reply("❌ Ratings missing (e.g. 2,3,4)");

    const ratings = ratingPart.split(",").map(Number);
    if (ratings.length !== mentions.length)
      return message.reply("❌ Staff & rating count mismatch.");

    if (ratings.some(r => r < 1 || r > 5))
      return message.reply("❌ Ratings must be 1–5.");

    const feedback = args.slice(args.indexOf(ratingPart) + 1).join(" ") || "No feedback";

    for (let i = 0; i < mentions.length; i++) {
      db.run(
        `INSERT INTO ratings (userId, points, reviews)
         VALUES (?, ?, 1)
         ON CONFLICT(userId)
         DO UPDATE SET points = points + ?, reviews = reviews + 1`,
        [mentions[i].id, ratings[i], ratings[i]]
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("⭐ New Rating Submitted")
      .setColor(0xffd700)
      .addFields(
        { name: "Client", value: `${message.author}` },
        {
          name: "Staff & Ratings",
          value: mentions.map((u, i) => `• ${u} → ⭐ ${ratings[i]}`).join("\n")
        },
        { name: "Feedback", value: feedback }
      )
      .setTimestamp();

    const logChannel = await client.channels.fetch(RATE_LOG_CHANNEL);
    logChannel.send({ embeds: [embed] });

    message.reply("✅ Rating submitted.");
  }

  if (command === "showrate") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention staff.");

    db.get(
      "SELECT points, reviews FROM ratings WHERE userId = ?",
      [user.id],
      (err, row) => {
        if (!row) return message.reply("❌ No data.");

        const avg = (row.points / row.reviews).toFixed(2);

        message.reply(
          `📊 **${user.username}**\n⭐ Points: ${row.points}\n📝 Reviews: ${row.reviews}\n📈 Avg: ${avg}`
        );
      }
    );
  }

  if (command === "whitelist") {
    if (!(await isWhitelisted(message.author.id)))
      return message.reply("❌ Not whitelisted.");

    const sub = args.shift();
    const user = message.mentions.users.first();

    if (sub === "add" && user) {
      db.run("INSERT OR IGNORE INTO whitelist VALUES (?)", [user.id]);
      return message.reply("✅ Added.");
    }

    if (sub === "remove" && user) {
      db.run("DELETE FROM whitelist WHERE userId = ?", [user.id]);
      return message.reply("❌ Removed.");
    }

    if (sub === "list") {
      db.all("SELECT userId FROM whitelist", [], (_, rows) => {
        if (!rows.length) return message.reply("Empty.");
        message.reply(rows.map(r => `<@${r.userId}>`).join("\n"));
      });
    }
  }
});

client.login(process.env.BOT_TOKEN);
