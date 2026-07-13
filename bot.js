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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

client.login(process.env.BOT_TOKEN);
