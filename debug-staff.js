// Read-only diagnostic. Does NOT touch the database.
// Run next to index.js:  node debug-staff.js
// Test another member:    node debug-staff.js <theirDiscordId>
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const GUILD_ID = process.env.GUILD_ID;
const ADMIN_ROLE_IDS = (process.env.ADMIN_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const MOD_ROLE_IDS   = (process.env.MOD_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const TARGET = process.argv[2] || '1352882652721446965'; // defaults to pvx6.

console.log('--------------------------------------------------');
console.log('GUILD_ID         =', GUILD_ID || '(missing!)');
console.log('ADMIN_ROLE_IDS   =', ADMIN_ROLE_IDS);
console.log('MOD_ROLE_IDS     =', MOD_ROLE_IDS);
console.log('Target member ID =', TARGET);
console.log('--------------------------------------------------');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log('Bot logged in as :', client.user.tag);

  const guild = await client.guilds.fetch(GUILD_ID).catch(e => {
    console.log('GUILD FETCH FAILED:', e.message, '\n=> GUILD_ID is wrong or the bot is not in that server.');
    return null;
  });
  if (!guild) return process.exit(1);
  console.log('Guild            :', guild.name);
  console.log('Guild owner ID   :', guild.ownerId);

  const member = await guild.members.fetch(TARGET).catch(e => {
    console.log('MEMBER FETCH FAILED:', e.message, '\n=> That ID is not a member of this server (wrong GUILD_ID, or wrong account).');
    return null;
  });
  if (!member) return process.exit(1);

  const isOwner       = guild.ownerId === member.id;
  const hasAdminPerm  = member.permissions.has(PermissionFlagsBits.Administrator);
  const roleIds       = [...member.roles.cache.keys()];
  const hasAdminRole  = roleIds.some(id => ADMIN_ROLE_IDS.includes(id));
  const hasModRole    = roleIds.some(id => MOD_ROLE_IDS.includes(id));

  console.log('--------------------------------------------------');
  console.log('Member           :', member.user.tag);
  console.log('Is server owner  :', isOwner);
  console.log('Has Administrator:', hasAdminPerm);
  console.log('Their role IDs   :', roleIds.length ? roleIds : '(none besides @everyone)');
  console.log('Has an ADMIN role:', hasAdminRole);
  console.log('Has a MOD role   :', hasModRole);

  let level = null;
  if (hasAdminPerm || hasAdminRole) level = 'admin';
  else if (hasModRole) level = 'mod';

  console.log('--------------------------------------------------');
  console.log('=> Bot computes staffLevel =', level === null ? 'null' : `"${level}"`);
  if (level) {
    console.log('   Good. If your DB still showed null, the running bot just needs a restart');
    console.log('   so it loads the env and runs syncStaffLevels (or your index.js lacks that function).');
  } else {
    console.log('   The bot sees NO staff role/permission for this account.');
    console.log('   Fix: in the server, Server Settings -> Members -> this user -> add the @admin role.');
    console.log('   (Putting the role ID in .env is not the same as assigning the role to your account.)');
  }
  console.log('--------------------------------------------------');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
