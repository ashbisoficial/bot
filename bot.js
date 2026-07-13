// bot.js
// Bot que queda corriendo: publica el mensaje de auto-rol en #roles
// y registra el comando /reportbug para reportes rápidos de bugs.
//
// Correr con: node bot.js

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('./serverConfig');
const ASHBIS_SYSTEM_PROMPT = require('./ashbisContext');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
if (!anthropic) {
  console.warn('⚠️ ANTHROPIC_API_KEY no está seteado: el asistente de preguntas queda desactivado.');
}

const BETA_TESTER_BUTTON_ID = 'toggle_beta_tester';

// ---------- Registro de slash commands ----------
const commands = [
  new SlashCommandBuilder()
    .setName('reportbug')
    .setDescription('Reportá un bug de la beta de Ashbis')
    .addStringOption(opt =>
      opt.setName('titulo').setDescription('Resumen corto del bug').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('descripcion').setDescription('Qué pasó, qué esperabas que pasara').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('pasos').setDescription('Pasos para reproducirlo').setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Publica una entrada de changelog en #changelog (solo staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt.setName('version').setDescription('Versión (ej: 0.4.2)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('titulo').setDescription('Resumen corto de la entrada').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('cambios').setDescription('Lista de cambios (uno por línea)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('tipo').setDescription('Tipo de entrada').setRequired(false)
        .addChoices(
          { name: '🚀 Feature', value: 'feature' },
          { name: '🐛 Fix', value: 'fix' },
          { name: '✨ Mejora', value: 'mejora' },
          { name: '⚠️ Breaking', value: 'breaking' },
        )
    ),
].map(c => c.toJSON());

const CHANGELOG_STYLE = {
  feature: { emoji: '🚀', label: 'Feature', color: 0x57f287 },
  fix: { emoji: '🐛', label: 'Fix', color: 0xed4245 },
  mejora: { emoji: '✨', label: 'Mejora', color: 0x5865f2 },
  breaking: { emoji: '⚠️', label: 'Breaking', color: 0xfee75c },
};

async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log('✅ Slash commands registrados');
}

// ---------- Ready ----------
client.once('ready', async () => {
  console.log(`✅ Bot activo como ${client.user.tag}`);
  const guildId = process.env.GUILD_ID;
  await registerCommands(guildId);

  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  const rolesChannel = channels.find(c => c && c.name === 'roles' && c.type === ChannelType.GuildText);

  if (rolesChannel) {
    const messages = await rolesChannel.messages.fetch({ limit: 10 });
    const alreadyPosted = messages.some(m => m.author.id === client.user.id);

    if (!alreadyPosted) {
      const embed = new EmbedBuilder()
        .setTitle('🎭 Auto-asignación de roles')
        .setDescription('Tocá el botón para sumarte como **Beta Tester** y acceder a los canales de beta.')
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(BETA_TESTER_BUTTON_ID)
          .setLabel('🧪 Beta Tester')
          .setStyle(ButtonStyle.Primary)
      );

      await rolesChannel.send({ embeds: [embed], components: [row] });
      console.log('📌 Mensaje de auto-rol publicado en #roles');
    }
  } else {
    console.warn('⚠️ No encontré el canal #roles. Corré setup.js primero.');
  }
});

// ---------- Interacciones ----------
client.on('interactionCreate', async interaction => {
  // Botón de auto-rol
  if (interaction.isButton() && interaction.customId === BETA_TESTER_BUTTON_ID) {
    const role = interaction.guild.roles.cache.find(r => r.name === 'Beta Tester');
    if (!role) {
      return interaction.reply({ content: '❌ No encontré el rol "Beta Tester". Corré setup.js primero.', ephemeral: true });
    }

    const member = interaction.member;
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      return interaction.reply({ content: '❌ Te saqué el rol de Beta Tester.', ephemeral: true });
    } else {
      await member.roles.add(role);
      return interaction.reply({ content: '✅ ¡Listo! Ahora sos Beta Tester.', ephemeral: true });
    }
  }

  // Slash command /reportbug
  if (interaction.isChatInputCommand() && interaction.commandName === 'reportbug') {
    const titulo = interaction.options.getString('titulo');
    const descripcion = interaction.options.getString('descripcion');
    const pasos = interaction.options.getString('pasos') || 'No especificado';

    const embed = new EmbedBuilder()
      .setTitle(`🐛 ${titulo}`)
      .addFields(
        { name: 'Descripción', value: descripcion },
        { name: 'Pasos para reproducir', value: pasos },
        { name: 'Reportado por', value: `<@${interaction.user.id}>` }
      )
      .setColor(0xed4245)
      .setTimestamp();

    const channels = await interaction.guild.channels.fetch();
    const bugsChannel = channels.find(c => c && c.name === 'reportar-bugs');

    if (bugsChannel && bugsChannel.type === ChannelType.GuildForum) {
      await bugsChannel.threads.create({
        name: titulo,
        message: { embeds: [embed] },
      });
    } else if (bugsChannel) {
      await bugsChannel.send({ embeds: [embed] });
    }

    return interaction.reply({ content: '✅ ¡Gracias! Tu reporte fue enviado.', ephemeral: true });
  }

  // Slash command /changelog
  if (interaction.isChatInputCommand() && interaction.commandName === 'changelog') {
    const version = interaction.options.getString('version');
    const titulo = interaction.options.getString('titulo');
    const cambios = interaction.options.getString('cambios');
    const tipo = interaction.options.getString('tipo') || 'mejora';
    const style = CHANGELOG_STYLE[tipo];

    const channels = await interaction.guild.channels.fetch();
    const changelogChannel = channels.find(c => c && c.name === 'changelog' && c.type === ChannelType.GuildText);

    if (!changelogChannel) {
      return interaction.reply({ content: '❌ No encontré el canal #changelog. Corré setup.js primero.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${style.emoji} v${version} — ${titulo}`)
      .setDescription(cambios.split('\n').map(line => `• ${line.trim()}`).join('\n'))
      .addFields({ name: 'Tipo', value: style.label, inline: true })
      .setColor(style.color)
      .setFooter({ text: `Publicado por ${interaction.user.tag}` })
      .setTimestamp();

    const message = await changelogChannel.send({ embeds: [embed] });
    await message.pin().catch(() => {});

    return interaction.reply({ content: `✅ Changelog publicado en <#${changelogChannel.id}>.`, ephemeral: true });
  }
});

// ---------- Moderación automática (sin IA) ----------
const INVITE_REGEX = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)\S+/i;
const lastMessageByUser = new Map(); // userId -> { content, count, timestamp }
const infractionsByUser = new Map(); // userId -> { count, firstAt }

function findViolation(message) {
  const content = message.content;

  if (INVITE_REGEX.test(content)) {
    return 'link de invitación externo';
  }

  const lower = content.toLowerCase();
  const bannedWord = config.moderation.bannedWords.find(w => lower.includes(w.toLowerCase()));
  if (bannedWord) {
    return 'palabra no permitida';
  }

  const { maxRepeats, windowMs } = config.moderation.spam;
  const prev = lastMessageByUser.get(message.author.id);
  const now = Date.now();
  if (prev && prev.content === content && now - prev.timestamp < windowMs) {
    prev.count += 1;
    prev.timestamp = now;
    if (prev.count >= maxRepeats) {
      return 'spam (mensaje repetido)';
    }
  } else {
    lastMessageByUser.set(message.author.id, { content, count: 1, timestamp: now });
  }

  return null;
}

async function logModeration(guild, member, reason, content) {
  const channels = await guild.channels.fetch();
  const logChannel = channels.find(c => c && c.name === config.moderation.logChannel && c.type === ChannelType.GuildText);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Moderación automática')
    .addFields(
      { name: 'Usuario', value: `<@${member.id}>` },
      { name: 'Motivo', value: reason },
      { name: 'Mensaje', value: content.slice(0, 500) || '(vacío)' }
    )
    .setColor(0xed4245)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function registerInfraction(member) {
  const { maxInfractions, infractionWindowMs, timeoutMs } = config.moderation;
  const now = Date.now();
  const record = infractionsByUser.get(member.id);

  if (record && now - record.firstAt < infractionWindowMs) {
    record.count += 1;
  } else {
    infractionsByUser.set(member.id, { count: 1, firstAt: now });
  }

  const current = infractionsByUser.get(member.id);
  if (current.count >= maxInfractions) {
    infractionsByUser.delete(member.id);
    await member.timeout(timeoutMs, 'Infracciones repetidas de moderación automática').catch(() => {});
    return true;
  }
  return false;
}

async function moderateMessage(message) {
  const reason = findViolation(message);
  if (!reason) return false;

  await message.delete().catch(() => {});

  const warning = await message.channel.send({
    content: `⚠️ <@${message.author.id}> tu mensaje fue borrado (${reason}).`,
  }).catch(() => null);
  if (warning) setTimeout(() => warning.delete().catch(() => {}), 8000);

  const timedOut = await registerInfraction(message.member);
  await logModeration(message.guild, message.member, reason + (timedOut ? ' — timeout aplicado' : ''), message.content);

  return true;
}

// ---------- Asistente IA (menciones al bot) ----------
async function handleAssistantMention(message) {
  if (!anthropic) return;

  const question = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!question) {
    await message.reply('¡Hola! Preguntame algo sobre Ashbis 🐾');
    return;
  }

  await message.channel.sendTyping().catch(() => {});

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
      max_tokens: 500,
      system: ASHBIS_SYSTEM_PROMPT,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: question }],
    });

    const text = response.content.find(b => b.type === 'text')?.text;
    await message.reply(text || 'No tengo una respuesta clara para eso ahora mismo 🐾');
  } catch (err) {
    console.error('Error consultando al asistente:', err);
    await message.reply('❌ Tuve un problema respondiendo. Probá de nuevo en un rato.');
  }
}

// ---------- Mensajes ----------
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const wasModerated = await moderateMessage(message);
  if (wasModerated) return;

  if (message.mentions.has(client.user)) {
    await handleAssistantMention(message);
  }
});

client.login(process.env.BOT_TOKEN);
