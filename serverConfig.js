// serverConfig.js
// Acá definís TODA la estructura del server. Editá esto sin tocar el resto del código.

module.exports = {
  // Moderación automática (sin IA): borra links de invitación externos y
  // mensajes con estas palabras, y aplica timeout si un usuario acumula
  // varias infracciones. Agregá/quitá palabras sin tocar bot.js.
  moderation: {
    bannedWords: [],
    spam: { maxRepeats: 3, windowMs: 8000 }, // mismo mensaje repetido N veces en X ms
    maxInfractions: 3, // infracciones antes de timeout
    infractionWindowMs: 10 * 60 * 1000, // ventana para contar infracciones
    timeoutMs: 10 * 60 * 1000, // duración del timeout
    logChannel: 'logs',
  },

  roles: [
    { name: 'Admin', color: 'Red', permissions: ['Administrator'], hoist: true, mentionable: false },
    { name: 'Moderador', color: 'Orange', permissions: ['ManageMessages', 'ModerateMembers', 'KickMembers'], hoist: true, mentionable: false },
    { name: 'Beta Tester', color: 'Blue', permissions: [], hoist: true, mentionable: true, selfAssignable: true, emoji: '🧪' },
    { name: 'Verificado', color: 'Green', permissions: [], hoist: false, mentionable: false },
    { name: 'Miembro', color: 'Grey', permissions: [], hoist: false, mentionable: false },
  ],

  // El orden de categorías/canales acá define el orden visual en Discord
  categories: [
    {
      name: '📢 INICIO',
      channels: [
        { name: 'bienvenida', type: 'text', topic: 'Bienvenidos a Ashbis 🎉 Leé las reglas antes de participar.' },
        { name: 'anuncios', type: 'text', topic: 'Anuncios oficiales del equipo. Solo staff puede postear.', readOnly: true },
        { name: 'roles', type: 'text', topic: 'Elegí tus roles acá 👇' },
      ],
    },
    {
      name: '🐛 BETA',
      channels: [
        { name: 'como-empezar', type: 'text', topic: 'Guía de instalación y onboarding de la beta.' },
        { name: 'changelog', type: 'text', topic: 'Novedades y actualizaciones de la beta 📝', readOnly: true },
        { name: 'reportar-bugs', type: 'forum', topic: 'Usá el template al crear un post nuevo.' },
        { name: 'dudas-soporte', type: 'text', topic: 'Preguntas generales de uso de la app.' },
        { name: 'sugerencias', type: 'text', topic: 'Ideas y feedback de nuevas features.' },
      ],
    },
    {
      name: '💬 COMUNIDAD',
      channels: [
        { name: 'general', type: 'text' },
        { name: 'off-topic', type: 'text' },
        { name: 'showcase', type: 'text', topic: 'Mostrá cómo usás Ashbis 📸' },
      ],
    },
    {
      name: '🔒 STAFF',
      private: true, // solo Admin y Moderador la ven
      channels: [
        { name: 'staff-chat', type: 'text' },
        { name: 'logs', type: 'text' },
      ],
    },
  ],
};
