# Ashbis Bot — Setup del servidor de Discord

Bot que arma la estructura completa del server (categorías, canales, roles) y
después queda corriendo para auto-asignación de roles y reportes de bugs.

## 1. Crear el bot en Discord

1. Andá a https://discord.com/developers/applications → **New Application**
2. Nombralo (ej: "Ashbis Bot") → pestaña **Bot** → **Add Bot**
3. En **Privileged Gateway Intents**, activá **Server Members Intent** y
   **Message Content Intent** (esta última la necesita la moderación
   automática y el asistente de preguntas)
4. Copiá el **Token** (botón "Reset Token" si es la primera vez) — lo vas a
   necesitar en el paso 3
5. Pestaña **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (más simple para el setup inicial;
     podés restringirlo después)
6. Copiá la URL generada, abrila en el navegador y agregá el bot a tu server

## 2. Conseguir el GUILD_ID (ID de tu servidor)

En Discord: Configuración de usuario → Avanzado → activar **Modo
desarrollador**. Después click derecho sobre el ícono del server → **Copiar
ID del servidor**.

## 3. Instalar y configurar

```bash
npm install
cp .env.example .env
```

Editá `.env` y pegá tu `BOT_TOKEN` y `GUILD_ID`.

`ANTHROPIC_API_KEY` es opcional: sin ella, el bot funciona igual (moderación,
roles, /reportbug, /changelog) pero no responde si lo mencionás con una
pregunta. Conseguila en [console.anthropic.com](https://console.anthropic.com)
y pegala en `.env` (nunca en el chat).

## 4. (Opcional) Ajustar la estructura

Abrí `serverConfig.js` y modificá canales, categorías o roles a gusto —
está todo en un solo lugar, sin tocar el resto del código.

## 5. Crear la estructura del servidor

```bash
npm run setup
```

Esto crea todas las categorías, canales y roles de una sola vez. Es seguro
correrlo de nuevo: lo que ya existe, lo salta.

## 6. Dejar el bot corriendo

```bash
npm start
```

Esto:
- Publica el mensaje de auto-rol (botón "🧪 Beta Tester") en `#roles`
- Activa el comando `/reportbug` que crea un post en el foro
  `#reportar-bugs` con título, descripción y pasos para reproducir
- Activa el comando `/changelog` (solo staff con permiso de gestionar
  mensajes) que publica y fija un embed con versión, tipo (Feature/Fix/
  Mejora/Breaking) y lista de cambios en `#changelog`
- Modera automáticamente: borra links de invitación externos, mensajes con
  palabras de la lista `bannedWords` (`serverConfig.js`) y spam (mismo
  mensaje repetido). Avisa en el canal, loguea en `#logs` y aplica timeout
  si un usuario acumula varias infracciones
- Si lo mencionás (`@Bot Ashbis ¿cuándo sale para iOS?`) responde preguntas
  sobre la app usando el contexto de `ashbisContext.js` (requiere
  `ANTHROPIC_API_KEY`)

Para que quede corriendo 24/7 (no en tu compu), lo subís a un hosting como
[Railway](https://railway.app) o [Render](https://render.com) — ambos
tienen plan gratuito/barato y solo necesitás setear las mismas variables de
entorno (`BOT_TOKEN`, `GUILD_ID`).

## Estructura de archivos

- `serverConfig.js` — toda la configuración editable (canales, roles,
  moderación)
- `ashbisContext.js` — persona y datos que usa el asistente IA al responder
- `setup.js` — script de una sola corrida, crea la estructura
- `bot.js` — bot que queda activo (auto-roles + /reportbug + /changelog +
  moderación + asistente IA)
- `.env` — tus credenciales (no lo subas a git)
