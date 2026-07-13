// setup.js
// Corré esto UNA VEZ (node setup.js) para crear categorías, canales y roles en tu server.
// Es seguro correrlo de nuevo: si un canal/rol ya existe con el mismo nombre, lo salta.

require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const config = require('./serverConfig');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_TYPE_MAP = {
  text: ChannelType.GuildText,
  forum: ChannelType.GuildForum,
  voice: ChannelType.GuildVoice,
};

client.once('ready', async () => {
  console.log(`✅ Conectado como ${client.user.tag}`);

  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    console.error('❌ Falta GUILD_ID en el archivo .env');
    process.exit(1);
  }

  const guild = await client.guilds.fetch(guildId);
  console.log(`📌 Trabajando en el servidor: ${guild.name}`);

  // 1. Crear roles
  const roleMap = {};
  for (const roleDef of config.roles) {
    let role = guild.roles.cache.find(r => r.name === roleDef.name);
    if (!role) {
      role = await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color,
        hoist: roleDef.hoist,
        mentionable: roleDef.mentionable,
        permissions: new PermissionsBitField(roleDef.permissions),
      });
      console.log(`  ➕ Rol creado: ${role.name}`);
    } else {
      console.log(`  ⏭️  Rol ya existe: ${role.name}`);
    }
    roleMap[roleDef.name] = role;
  }

  const everyone = guild.roles.everyone;
  const adminRole = roleMap['Admin'];
  const modRole = roleMap['Moderador'];

  // 2. Crear categorías y canales
  for (const catDef of config.categories) {
    let category = guild.channels.cache.find(c => c.name === catDef.name && c.type === ChannelType.GuildCategory);
    if (!category) {
      const overwrites = [{ id: everyone.id, allow: [], deny: [] }];

      if (catDef.private) {
        overwrites[0].deny = [PermissionsBitField.Flags.ViewChannel];
        overwrites.push(
          { id: adminRole.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: modRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
        );
      }

      category = await guild.channels.create({
        name: catDef.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
      });
      console.log(`📁 Categoría creada: ${category.name}`);
    } else {
      console.log(`⏭️  Categoría ya existe: ${category.name}`);
    }

    for (const chDef of catDef.channels) {
      const exists = guild.channels.cache.find(
        c => c.name === chDef.name && c.parentId === category.id
      );
      if (exists) {
        console.log(`  ⏭️  Canal ya existe: #${chDef.name}`);
        continue;
      }

      const overwrites = [];
      if (chDef.readOnly) {
        overwrites.push(
          { id: everyone.id, deny: [PermissionsBitField.Flags.SendMessages] },
          { id: adminRole.id, allow: [PermissionsBitField.Flags.SendMessages] },
          { id: modRole.id, allow: [PermissionsBitField.Flags.SendMessages] }
        );
      }

      const channel = await guild.channels.create({
        name: chDef.name,
        type: CHANNEL_TYPE_MAP[chDef.type] || ChannelType.GuildText,
        parent: category.id,
        topic: chDef.topic || undefined,
        permissionOverwrites: overwrites.length ? overwrites : undefined,
      });
      console.log(`  ➕ Canal creado: #${channel.name}`);
    }
  }

  console.log('\n🎉 Listo. La estructura del servidor está creada.');
  console.log('Ahora corré "node bot.js" para dejar el bot activo (auto-roles + /reportbug).');
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
