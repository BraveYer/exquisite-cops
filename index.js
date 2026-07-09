require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('📦 Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

const { Player, Match, QueueEntry, db } = require('./models');
const { applyMatchResult } = require('./elo');

// --- CONFIG ---
const GUILD_ID             = process.env.GUILD_ID;
const VERIFIED_ROLE_ID     = process.env.VERIFIED_ROLE_ID;
const RESULTS_CHANNEL_ID   = process.env.RESULTS_CHANNEL_ID || process.env.MATCH_LOG_CHANNEL_ID;
const MATCHES_CATEGORY_ID  = process.env.MATCHES_CATEGORY_ID || undefined;
const SITE_URL             = process.env.SITE_URL || 'http://localhost:3000';
const COPS_API_URL         = process.env.COPS_API_URL || 'https://api-cops.criticalforce.fi/api/public/profile?usernames=';
const COPS_USER_AGENT      = process.env.COPS_USER_AGENT || 'Mozilla/5.0';

// Staff roles (granular permissions). Comma-separated Discord role IDs in .env.
// Anyone with Discord Administrator permission counts as 'admin' regardless of these.
const ADMIN_ROLE_IDS = (process.env.ADMIN_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const MOD_ROLE_IDS   = (process.env.MOD_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const MAX_PLAYERS = 10; // 5v5
const MAPS = ['Bureau', 'Canals', 'Grounded', 'Castello', 'Legacy', 'Plaza', 'Port', 'Raid', 'Soar', 'Village'];
const DELETE_DELAY_MS = 60000; // delete match channel 60s after it's finalized
const STALE_MS = 120000;       // remove queue entries that haven't sent a heartbeat for 2 minutes
let radarBusy = false;         // in-process lock so two radar ticks never grab the same players

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// =================== STAFF / PERMISSIONS ===================
// 'admin' > 'mod' > null. Admins can do everything; mods can confirm matches but not cancel/override.
function staffLevelFromRoleIds(roleIds, hasAdminPerm) {
  if (hasAdminPerm) return 'admin';
  if (roleIds.some(id => ADMIN_ROLE_IDS.includes(id))) return 'admin';
  if (roleIds.some(id => MOD_ROLE_IDS.includes(id))) return 'mod';
  return null;
}
function staffLevelOfMember(member) {
  if (!member) return null;
  const hasAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);
  const roleIds = member.roles?.cache ? [...member.roles.cache.keys()] : [];
  return staffLevelFromRoleIds(roleIds, hasAdmin);
}
function staffLevelOfInteraction(interaction) {
  const hasAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const roleIds = interaction.member?.roles?.cache ? [...interaction.member.roles.cache.keys()] : [];
  return staffLevelFromRoleIds(roleIds, hasAdmin);
}
// Mirror each linked player's Discord staff level into Mongo so the website can gate /admin
// without needing a bot token. Discord roles remain the source of truth.
async function syncStaffLevels() {
  try {
    if (!GUILD_ID) return;
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;
    const players = await Player.find({ discordId: { $regex: /^\d{17,20}$/ } }).select('discordId staffLevel');
    for (const p of players) {
      const member = await guild.members.fetch(p.discordId).catch(() => null);
      const level = staffLevelOfMember(member); // null if not in the guild or has no staff role
      if ((p.staffLevel || null) !== (level || null)) {
        await Player.updateOne({ discordId: p.discordId }, { $set: { staffLevel: level } });
      }
    }
  } catch (e) {
    console.error('staff sync error:', e);
  }
}

// =================== SLASH COMMANDS ===================
const commands = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Critical Ops account (one time only)')
    .addStringOption(o => o.setName('username').setDescription('Your in-game name').setRequired(true)),
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your linked account by changing your in-game icon'),
  new SlashCommandBuilder()
    .setName('win')
    .setDescription('(Admin) Manually give a player a win (+25 ELO)')
    .addUserOption(o => o.setName('player').setDescription('The player').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('lose')
    .setDescription('(Admin) Manually give a player a loss (-25 ELO)')
    .addUserOption(o => o.setName('player').setDescription('The player').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your rank, or another player\'s')
    .addUserOption(o => o.setName('player').setDescription('The player (defaults to you)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 players by ELO'),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Get a link to your profile, or another player\'s')
    .addUserOption(o => o.setName('player').setDescription('The player (defaults to you)').setRequired(false)),
].map(c => c.toJSON());

// =================== HELPERS ===================
// ELO → rank name (mirrors the website's tier thresholds).
function tierName(elo) {
  const TIERS = [
    { name: 'Challenger III', min: 0 }, { name: 'Challenger II', min: 900 }, { name: 'Challenger I', min: 1100 },
    { name: 'Master III', min: 1300 }, { name: 'Master II', min: 1500 }, { name: 'Master I', min: 1700 },
    { name: 'Grandmaster III', min: 1900 }, { name: 'Grandmaster II', min: 2100 }, { name: 'Grandmaster I', min: 2300 },
    { name: 'Exquisite Pro League', min: 2500 },
  ];
  let cur = TIERS[0];
  for (const t of TIERS) if ((elo ?? 1000) >= t.min) cur = t;
  return cur.name;
}

// Verifies account ownership: the player must have CHANGED their in-game icon
// since /link. Compares the live iconID to the baseline stored at link time.
async function tryVerify(interaction) {
  const discordId = interaction.user.id;
  const player = await Player.findOne({ discordId });
  if (!player) return { msg: 'You are not linked yet. Use **/link** first.' };
  if (player.verified) return { msg: '✅ You are already verified.' };

  try {
    const response = await fetch(`${COPS_API_URL}${encodeURIComponent(player.copsName)}`, {
      headers: { 'User-Agent': COPS_USER_AGENT, 'Accept': 'application/json, text/plain, */*' },
    });
    const rawText = await response.text();
    if (!rawText.trim().startsWith('[') && !rawText.trim().startsWith('{')) {
      return { msg: '⚠️ The game servers blocked the request. Please try again in a moment.' };
    }
    const data = JSON.parse(rawText);
    if (!Array.isArray(data) || data.length === 0 || !data[0].basicInfo) {
      return { msg: `❌ Couldn't find your account (**${player.copsName}**). If you changed your name, open a support ticket.` };
    }
    const info = data[0].basicInfo;
    if (info.userID !== player.accountId) {
      return { msg: '❌ That name now belongs to a different account. Open a support ticket.' };
    }
    if (info.iconID === player.iconID) {
      return { msg: `🔄 Your icon hasn't changed yet (still icon **#${player.iconID}**). Change it **in-game**, wait a few seconds, then try again.` };
    }

    await Player.updateOne(
      { discordId },
      { $set: { verified: true, verifiedAt: new Date(), iconID: info.iconID, copsName: info.name, level: info.playerLevel?.level ?? player.level } }
    );
    try {
      const member = await interaction.guild.members.fetch(discordId);
      await member.setNickname(info.name);
      if (VERIFIED_ROLE_ID) {
        const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
        if (role) await member.roles.add(role);
      }
    } catch (e) {
      console.log("Couldn't set role/nickname after verify (permissions?).");
    }
    return { msg: `✅ **Verified!** Welcome, **${info.name}**. You can now join the ranked queue.` };
  } catch (e) {
    console.error('Verify error:', e);
    return { msg: '⚠️ An error occurred while contacting the game API.' };
  }
}

function verifyButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify').setLabel('I changed my icon ✅').setStyle(ButtonStyle.Success)
  );
}

// In-game custom room: a recognizable name tied to the match + a short password.
function generateRoomCredentials(matchId) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let pwd = '';
  for (let i = 0; i < 6; i++) pwd += alphabet[Math.floor(Math.random() * alphabet.length)];
  return { roomName: `EXQ-${matchId}`, roomPassword: pwd };
}

function buildMatchEmbed(match) {
  const fmt = (team) => (team && team.length)
    ? team.map(p => `• ${p.copsName || p.discordId} (${p.elo})`).join('\n')
    : '—';
  const reports = match.reports || [];
  const countA = reports.filter(r => r.winner === 'A').length;
  const countB = reports.filter(r => r.winner === 'B').length;
  const hostName = (match.teamA && match.teamA[0]) ? (match.teamA[0].copsName || match.teamA[0].discordId) : '—';

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ MATCH #${match.matchId}`)
    .addFields(
      { name: '🗺️ Map', value: match.map || '—', inline: true },
      { name: '📊 Status', value: String(match.status), inline: true },
      { name: '🅰️ Team A', value: fmt(match.teamA), inline: false },
      { name: '🅱️ Team B', value: fmt(match.teamB), inline: false },
    );

  if (match.roomName) {
    embed.addFields(
      { name: '🏠 Room', value: match.roomName, inline: true },
      { name: '🔑 Password', value: match.roomPassword || '—', inline: true },
      { name: '👑 Host', value: hostName, inline: true },
    );
  }

  embed.addFields(
    { name: '🗳️ Reports', value: `Team A: ${countA}  •  Team B: ${countB}`, inline: false },
    { name: '🔗 Web', value: `[View on the website](${SITE_URL}/match/${match.matchId})`, inline: false },
  ).setColor('#00ffff');

  return embed;
}

function buildButtonRows(matchId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`report_A_${matchId}`).setLabel('Team A won').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`report_B_${matchId}`).setLabel('Team B won').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`leaver_${matchId}`).setLabel('Report a leaver').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_A_${matchId}`).setLabel('Confirm A (admin)').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`confirm_B_${matchId}`).setLabel('Confirm B (admin)').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cancel_${matchId}`).setLabel('Cancel (admin)').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

function scheduleChannelDelete(channelId) {
  if (!channelId) return;
  setTimeout(async () => {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (ch) await ch.delete('Match finished').catch(() => {});
  }, DELETE_DELAY_MS);
}

// Applies ELO exactly once (atomic claim), updates players, writes result.
async function completeMatch(matchId, winner) {
  const claim = await Match.updateOne(
    { matchId, eloApplied: { $ne: true }, status: { $nin: ['cancelled', 'completed'] } },
    { $set: { eloApplied: true } }
  );
  if (claim.modifiedCount !== 1) return Match.findOne({ matchId });

  const match = await Match.findOne({ matchId });
  if (!match) return null;

  const teamAIds = (match.teamA || []).map(p => p.discordId);
  const teamBIds = (match.teamB || []).map(p => p.discordId);
  const allIds = [...teamAIds, ...teamBIds];

  const players = await Player.find({ discordId: { $in: allIds } });
  const byId = new Map(players.map(p => [p.discordId, p]));

  const toElo = (ids) => ids.map(id => {
    const p = byId.get(id);
    return { discordId: id, elo: p ? p.elo : 1000, gamesPlayed: p ? p.gamesPlayed : 0 };
  });

  const deltas = applyMatchResult(toElo(teamAIds), toElo(teamBIds), winner);
  const changes = [];
  const WIN_EP = 100, LOSS_EP = 20;

  for (const id of allIds) {
    const p = byId.get(id);
    const d = deltas[id] || { oldElo: p ? p.elo : 1000, newElo: p ? p.elo : 1000, delta: 0 };
    const won = teamAIds.includes(id) ? winner === 'A' : winner === 'B';
    const epEarned = won ? WIN_EP : LOSS_EP;
    await Player.updateOne(
      { discordId: id },
      { $set: { elo: d.newElo }, $inc: { gamesPlayed: 1, wins: won ? 1 : 0, losses: won ? 0 : 1 } }
    );
    await db.collection('economy').updateOne(
      { discordId: id },
      { $inc: { balance: epEarned }, $setOnInsert: { items: [], equipped: { frame: null, name: null, theme: null }, claims: {} } },
      { upsert: true }
    );
    changes.push({ discordId: id, copsName: p ? p.copsName : null, oldElo: d.oldElo, newElo: d.newElo, delta: d.delta, won, epEarned });
  }

  await Match.updateOne(
    { matchId },
    { $set: { status: 'completed', winner, completedAt: new Date(), result: { winner, changes } } }
  );
  return Match.findOne({ matchId });
}

async function postResult(match) {
  if (!match || !RESULTS_CHANNEL_ID) return;
  const ch = await client.channels.fetch(RESULTS_CHANNEL_ID).catch(() => null);
  if (!ch) return console.log('❌ Results channel not found (RESULTS_CHANNEL_ID).');

  const changes = (match.result && match.result.changes) || [];
  const lines = changes.length
    ? changes.map(c => `${c.won ? '🏆' : '💀'} ${c.copsName || c.discordId}: ${c.oldElo} → ${c.newElo} (${c.delta >= 0 ? '+' : ''}${c.delta})`).join('\n')
    : '—';

  const embed = new EmbedBuilder()
    .setTitle('🏁 MATCH RESULT')
    .setDescription(`Match **#${match.matchId}** — **Team ${match.winner} won**`)
    .addFields(
      { name: '🗺️ Map', value: match.map || '—', inline: true },
      { name: '📈 ELO changes', value: lines, inline: false },
    )
    .setColor('#22c55e')
    .setTimestamp();

  await ch.send({ embeds: [embed] });
}

async function createMatchChannel(match) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const allIds = [...(match.teamA || []), ...(match.teamB || [])].map(p => p.discordId);

    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ];

    // Let staff (admin/mod roles) see and moderate match channels without needing Administrator.
    const staffRoleIds = [...new Set([...ADMIN_ROLE_IDS, ...MOD_ROLE_IDS])];
    if (staffRoleIds.length) {
      const rolesColl = await guild.roles.fetch().catch(() => null);
      for (const rid of staffRoleIds) {
        if (rolesColl && rolesColl.has(rid)) {
          overwrites.push({
            id: rid,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          });
        }
      }
    }

    // Only add overwrites for IDs that are real, resolvable guild members.
    const validIds = [];
    for (const id of allIds) {
      if (!/^\d{17,20}$/.test(id)) continue; // not a Discord snowflake (e.g. an old username) -> skip
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) continue; // not in this server -> skip
      validIds.push(id);
      overwrites.push({
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: `match-${match.matchId}`,
      type: ChannelType.GuildText,
      parent: MATCHES_CATEGORY_ID,
      permissionOverwrites: overwrites,
    });

    await Match.updateOne({ matchId: match.matchId }, { $set: { channelId: channel.id } });

    const pings = validIds.map(id => `<@${id}>`).join(' ');
    const fresh = await Match.findOne({ matchId: match.matchId });
    await channel.send({
      content: `${pings}\n**Your match is ready!** 🏠 The **Host** creates the in-game custom room (name + password in the embed); everyone else joins it. When it's over, 📸 post a screenshot and report the winner below — an admin will confirm.`,
      embeds: [buildMatchEmbed(fresh)],
      components: buildButtonRows(match.matchId),
    });
  } catch (e) {
    console.error('Failed to create match channel:', e);
  }
}

// DM every participant a link to the match page. This is the bridge for the
// draft/veto phase, which happens on the website before any Discord channel exists.
async function notifyMatchReady(participantIds, matchId, status) {
  const url = `${SITE_URL}/match/${matchId}`;
  const desc =
    status === 'drafting'
      ? 'Captains pick teams, then both captains veto maps. Open your match to take part:'
      : 'Your match is live. Open it here:';
  const embed = new EmbedBuilder()
    .setColor(0x22d3ee)
    .setTitle('⚔️ Your match is ready!')
    .setDescription(`${desc}\n${url}`)
    .addFields({ name: 'Match', value: `#${matchId}`, inline: true });
  for (const pid of [...new Set(participantIds)]) {
    try {
      const user = await client.users.fetch(pid);
      await user.send({ embeds: [embed] });
    } catch {
      // The player has DMs closed or is unreachable — skip silently.
    }
  }
}

// Build two balanced teams from queued groups, keeping every party entirely on one team.
// Parties are placed first (largest first) onto the emptier team that can fit them; solos fill the rest.
// Returns { teamA:[ids], teamB:[ids] } only if BOTH teams fill exactly, otherwise null (wait for more players).
function buildPartyTeams(groups, teamSize) {
  const parties = groups.filter(g => g.size > 1 && g.size <= teamSize).sort((a, b) => b.size - a.size);
  const solos = groups.filter(g => g.size === 1);
  let aSpace = teamSize;
  let bSpace = teamSize;
  const teamA = [];
  const teamB = [];
  for (const p of parties) {
    if (aSpace >= bSpace && aSpace >= p.size) { teamA.push(...p.ids); aSpace -= p.size; }
    else if (bSpace >= p.size) { teamB.push(...p.ids); bSpace -= p.size; }
    else if (aSpace >= p.size) { teamA.push(...p.ids); aSpace -= p.size; }
    // else: this party can't be placed right now — leave it queued.
  }
  for (const s of solos) {
    if (aSpace > 0) { teamA.push(s.ids[0]); aSpace -= 1; }
    else if (bSpace > 0) { teamB.push(s.ids[0]); bSpace -= 1; }
    if (aSpace === 0 && bSpace === 0) break;
  }
  if (aSpace === 0 && bSpace === 0) return { teamA, teamB };
  return null;
}

// =================== READY: register + radar ===================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    if (GUILD_ID) {
      await client.application.commands.set(commands, GUILD_ID);
      console.log(`✅ Slash commands registered for guild ${GUILD_ID}`);
    } else {
      await client.application.commands.set(commands);
      console.log('⚠️ GUILD_ID missing — registered global commands (may take up to 1h).');
    }
  } catch (e) {
    console.error('Failed to register slash commands:', e);
  }

  // Mirror Discord staff roles into Mongo for the website's /admin gate.
  syncStaffLevels();
  setInterval(syncStaffLevels, 5 * 60 * 1000);

  setInterval(async () => {
    if (radarBusy) return;          // prevent overlapping ticks from grabbing the same players
    radarBusy = true;
    try {
      // Drop players who went silent (no heartbeat for STALE_MS) — defensive, on top of the TTL index.
      await QueueEntry.deleteMany({ lastSeen: { $lt: new Date(Date.now() - STALE_MS) } });

      const teamSize = Math.floor(MAX_PLAYERS / 2);

      // Pull a wider pool than a single match so we can keep whole parties together.
      const candidates = await QueueEntry.find({}).sort({ joinedAt: 1 }).limit(Math.max(MAX_PLAYERS * 3, MAX_PLAYERS));
      if (candidates.length < MAX_PLAYERS) return;

      // Group queued players by party (solos are their own group).
      const groupsMap = new Map();
      for (const c of candidates) {
        const key = c.partyId || `solo:${c.discordId}`;
        if (!groupsMap.has(key)) groupsMap.set(key, { partyId: c.partyId || null, ids: [] });
        groupsMap.get(key).ids.push(c.discordId);
      }
      const groups = [...groupsMap.values()].map(g => ({ ...g, size: g.ids.length }));
      const hasParty = groups.some(g => g.size > 1);

      // Decide the lineup. A party present → balanced pre-made teams (skip draft). All solo → captain draft.
      let selectedIds;
      let teamAids = null;
      let teamBids = null;
      if (MAX_PLAYERS === 1) {
        selectedIds = [candidates[0].discordId];
      } else if (!hasParty) {
        selectedIds = candidates.slice(0, MAX_PLAYERS).map(c => c.discordId);
      } else {
        const teams = buildPartyTeams(groups, teamSize);
        if (!teams) return;                       // can't form a valid party lineup yet — wait for more players.
        teamAids = teams.teamA;
        teamBids = teams.teamB;
        selectedIds = [...teamAids, ...teamBids];
      }
      if (!selectedIds || selectedIds.length !== MAX_PLAYERS) return;

      // Atomic claim: remove ONLY the selected players. Proceed only if we claimed all of them.
      const claim = await QueueEntry.deleteMany({ discordId: { $in: selectedIds } });
      if (claim.deletedCount < selectedIds.length) return;

      const playersData = await Player.find({ discordId: { $in: selectedIds } });
      const byId = new Map(playersData.map(p => [p.discordId, p]));

      const randomMap = MAPS[Math.floor(Math.random() * MAPS.length)];
      const matchId = uuidv4().substring(0, 8);
      const toTeamPlayer = (p) => ({ discordId: p.discordId, copsName: p.copsName || p.discordUsername || p.discordId, elo: p.elo, avatar: p.avatar || null });
      const buildTeam = (memberIds) => memberIds.map(id => byId.get(id)).filter(Boolean).sort((a, b) => b.elo - a.elo).map(toTeamPlayer);

      let teamA = [];
      let teamB = [];
      let pool = [];
      let pickTurn = null;
      let status = 'ongoing';
      let map = randomMap;                       // solo matches keep a random map
      let vetoTurn = null;
      let mapPool = null;
      if (MAX_PLAYERS === 1) {
        const only = byId.get(selectedIds[0]);
        if (only) teamA = [toTeamPlayer(only)];
      } else if (teamAids) {
        // Party present → pre-assigned balanced teams. Skip the draft, go straight to the map veto.
        teamA = buildTeam(teamAids);             // captain = highest ELO on the team (index 0)
        teamB = buildTeam(teamBids);
        status = 'veto';
        map = null;
        mapPool = [...MAPS];
        vetoTurn = Math.random() < 0.5 ? 'A' : 'B';
      } else {
        // All solo → captain draft: the two highest-rated players are captains, everyone else goes to the pool.
        const players = buildTeam(selectedIds);
        teamA = [players[0]];                      // captain A (highest ELO)
        teamB = [players[1]];                      // captain B (second highest ELO)
        pool = players.slice(2);
        pickTurn = Math.random() < 0.5 ? 'A' : 'B'; // coin flip decides who picks first
        status = 'drafting';
        map = null;                                // the map is decided by the veto after the draft
      }

      const { roomName, roomPassword } = generateRoomCredentials(matchId);
      const matchDoc = { matchId, map, teamA, teamB, pool, pickTurn, status, roomName, roomPassword };
      if (status === 'veto') {
        matchDoc.mapPool = mapPool;
        matchDoc.bannedMaps = [];
        matchDoc.vetoTurn = vetoTurn;
      }
      await Match.create(matchDoc);

      // Clear the "searching" flag on any party that just got matched.
      const matchedPartyIds = [...new Set(candidates.filter(c => selectedIds.includes(c.discordId) && c.partyId).map(c => c.partyId))];
      if (matchedPartyIds.length) {
        try { await db.collection('parties').updateMany({ partyId: { $in: matchedPartyIds } }, { $set: { queuing: false } }); } catch {}
      }

      // DM every participant a link so they head to the website for the draft/veto.
      notifyMatchReady([...teamA, ...teamB, ...pool].map(p => p.discordId), matchId, status).catch(() => {});
      // The channel watcher (below) creates the Discord channel once the match is 'ongoing' —
      // immediately for a solo match, or right after the website draft finishes for a 5v5.
    } catch (error) {
      console.error('Radar error:', error);
    } finally {
      radarBusy = false;
    }
  }, 5000);

  // Create the Discord channel for any recent match that is 'ongoing' but has no channel yet.
  // Fires right after a solo match is made, or right after a 5v5 draft completes on the website.
  let channelWatcherBusy = false;
  setInterval(async () => {
    if (channelWatcherBusy) return;
    channelWatcherBusy = true;
    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000); // ignore anything older than 10 min (stale)
      const pending = await Match.find({ status: 'ongoing', channelId: null, createdAt: { $gte: cutoff } }).limit(5);
      for (const m of pending) await createMatchChannel(m);
    } catch (error) {
      console.error('Channel watcher error:', error);
    } finally {
      channelWatcherBusy = false;
    }
  }, 4000);
});

// =================== INTERACTIONS ===================
client.on(Events.InteractionCreate, async (interaction) => {
  // ---------- Buttons (match channel) ----------
  if (interaction.isButton()) {
    if (interaction.customId === 'verify') {
      await interaction.deferReply({ ephemeral: true });
      const { msg } = await tryVerify(interaction);
      return interaction.editReply(msg);
    }
    const parts = interaction.customId.split('_');
    const action = parts[0];
    let winner = null;
    let matchId = null;
    if (action === 'report' || action === 'confirm') { winner = parts[1]; matchId = parts[2]; }
    else { matchId = parts[1]; }
    if (!matchId) return;

    const match = await Match.findOne({ matchId });
    if (!match) return interaction.reply({ content: 'Match not found.', ephemeral: true });

    const userId = interaction.user.id;
    const inMatch = [...(match.teamA || []), ...(match.teamB || [])].some(p => p.discordId === userId);
    const staff = staffLevelOfInteraction(interaction); // 'admin' | 'mod' | null

    if (action === 'report') {
      if (!inMatch) return interaction.reply({ content: 'You are not in this match.', ephemeral: true });
      if (!['ongoing', 'pending_review', 'disputed'].includes(match.status)) {
        return interaction.reply({ content: `Match is already ${match.status}.`, ephemeral: true });
      }
      const reports = (match.reports || []).filter(r => r.discordId !== userId);
      reports.push({ discordId: userId, winner, reportedAt: new Date() });
      const conflict = new Set(reports.map(r => r.winner)).size > 1;
      await Match.updateOne({ matchId }, { $set: { reports, status: conflict ? 'disputed' : 'pending_review' } });
      const fresh = await Match.findOne({ matchId });
      return interaction.update({ embeds: [buildMatchEmbed(fresh)], components: buildButtonRows(matchId) });
    }

    if (action === 'leaver') {
      if (!inMatch) return interaction.reply({ content: 'You are not in this match.', ephemeral: true });
      return interaction.reply({ content: `⚠️ <@${userId}> reported a leaver. Please confirm in chat **who** left — an admin will review and decide the outcome.` });
    }

    if (action === 'confirm') {
      if (staff !== 'admin' && staff !== 'mod') return interaction.reply({ content: '⛔ Staff only (admin/mod).', ephemeral: true });
      await interaction.deferUpdate();
      const completed = await completeMatch(matchId, winner);
      await postResult(completed);
      const fresh = await Match.findOne({ matchId });
      await interaction.editReply({ embeds: [buildMatchEmbed(fresh)], components: [] });
      await interaction.followUp({ content: `✅ Confirmed: **Team ${winner} won**. ELO applied. This channel will be deleted in 60s.` });
      return scheduleChannelDelete(match.channelId);
    }

    if (action === 'cancel') {
      if (staff !== 'admin') return interaction.reply({ content: '⛔ Admins only.', ephemeral: true });
      await interaction.deferUpdate();
      await Match.updateOne({ matchId }, { $set: { status: 'cancelled' } });
      const fresh = await Match.findOne({ matchId });
      await interaction.editReply({ embeds: [buildMatchEmbed(fresh)], components: [] });
      await interaction.followUp({ content: '🚫 Match cancelled by an admin. No ELO applied. This channel will be deleted in 60s.' });
      return scheduleChannelDelete(match.channelId);
    }
    return;
  }

  // ---------- Slash commands ----------
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) {
    return interaction.reply({ content: 'Please use this command inside the server.', ephemeral: true });
  }

  if (interaction.commandName === 'link') {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username');
    const discordId = interaction.user.id;
    const discordUsername = interaction.user.username;

    const existing = await Player.findOne({ discordId });
    if (existing) {
      if (existing.verified) {
        return interaction.editReply(
          `⛔ You are already linked as **${existing.copsName}**. To change your in-game name, please open a support ticket.`
        );
      }
      return interaction.editReply({
        content:
          `🔗 You've started linking as **${existing.copsName}** but you're not verified yet.\n` +
          `Change your in-game icon to **any different one**, then press the button below (or run \`/verify\`).`,
        components: [verifyButtonRow()],
      });
    }

    try {
      const response = await fetch(`${COPS_API_URL}${encodeURIComponent(username)}`, {
        headers: { 'User-Agent': COPS_USER_AGENT, 'Accept': 'application/json, text/plain, */*' },
      });
      const rawText = await response.text();
      if (!rawText.trim().startsWith('[') && !rawText.trim().startsWith('{')) {
        return interaction.editReply('⚠️ The game servers blocked the request. Please try again.');
      }
      const data = JSON.parse(rawText);
      if (!Array.isArray(data) || data.length === 0 || !data[0].basicInfo) {
        return interaction.editReply(`❌ Account not found: **${username}**.`);
      }
      const info = data[0].basicInfo;
      const accountId = info.userID;
      const copsName  = info.name;
      const iconID    = info.iconID;
      const level     = info.playerLevel?.level ?? 0;

      const accountOwner = await Player.findOne({ accountId });
      if (accountOwner) {
        return interaction.editReply('⛔ This Critical Ops account is already linked to another Discord user.');
      }

      await Player.create({ discordId, discordUsername, accountId, copsName, iconID, level });

      return interaction.editReply({
        content:
          `🔗 **Account found:** ${copsName} (Level ${level}).\n\n` +
          `**One step left to verify it's yours:** open Critical Ops and change your profile icon to **any different one**, wait a few seconds, then press the button below (or run \`/verify\`).`,
        components: [verifyButtonRow()],
      });
    } catch (error) {
      console.error(error);
      if (error && error.code === 11000) return interaction.editReply('⛔ This account is already linked.');
      return interaction.editReply('⚠️ An error occurred while contacting the game API.');
    }
  }

  if (interaction.commandName === 'verify') {
    await interaction.deferReply({ ephemeral: true });
    const { msg } = await tryVerify(interaction);
    return interaction.editReply(msg);
  }

  if (interaction.commandName === 'win' || interaction.commandName === 'lose') {
    if (staffLevelOfInteraction(interaction) !== 'admin') {
      return interaction.reply({ content: '⛔ Admins only.', ephemeral: true });
    }
    const target = interaction.options.getUser('player');
    const isWin = interaction.commandName === 'win';
    const update = isWin
      ? { $inc: { elo: 25, wins: 1, gamesPlayed: 1 } }
      : { $inc: { elo: -25, losses: 1, gamesPlayed: 1 } };
    const result = await Player.findOneAndUpdate({ discordId: target.id }, update, { new: true });
    if (!result) return interaction.reply({ content: '❌ This player is not registered (/link).', ephemeral: true });
    if (isWin) return interaction.reply(`🏆 **${result.copsName || target.username}** won! Now **${result.elo} ELO**, **${result.wins} Wins**.`);
    return interaction.reply(`💀 **${result.copsName || target.username}** lost! Now **${result.elo} ELO**, **${result.losses} Losses**.`);
  }

  if (interaction.commandName === 'rank') {
    await interaction.deferReply();
    const target = interaction.options.getUser('player') || interaction.user;
    const player = await Player.findOne({ discordId: target.id });
    if (!player) return interaction.editReply(`❌ **${target.username}** is not linked yet (\`/link\`).`);
    const wins = player.wins || 0;
    const losses = player.losses || 0;
    const games = player.gamesPlayed || wins + losses;
    const wr = games > 0 ? Math.round((wins / games) * 100) : 0;
    const higher = await Player.countDocuments({ elo: { $gt: player.elo ?? 1000 } });
    const embed = new EmbedBuilder()
      .setColor(0x22d3ee)
      .setTitle(player.copsName || target.username)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Rank', value: `**${tierName(player.elo ?? 1000)}**`, inline: true },
        { name: 'ELO', value: `**${player.elo ?? 1000}**`, inline: true },
        { name: 'Position', value: `#${higher + 1}`, inline: true },
        { name: 'Wins', value: `${wins}`, inline: true },
        { name: 'Losses', value: `${losses}`, inline: true },
        { name: 'Win rate', value: `${wr}%`, inline: true },
      )
      .setFooter({ text: 'Exquisite Cops' });
    return interaction.editReply({ embeds: [embed] });
  }

  if (interaction.commandName === 'leaderboard') {
    await interaction.deferReply();
    const top = await Player.find({ gamesPlayed: { $gt: 0 } }).sort({ elo: -1 }).limit(10).lean();
    if (!top.length) return interaction.editReply('No ranked players yet.');
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((p, i) => `${medals[i] || `**${i + 1}.**`} **${p.copsName || 'Unknown'}** — ${p.elo ?? 1000} ELO (${p.wins || 0}W/${p.losses || 0}L)`);
    const embed = new EmbedBuilder()
      .setColor(0xa855f7)
      .setTitle('🏆 Leaderboard — Top 10')
      .setURL(`${SITE_URL}/leaderboard`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Exquisite Cops' });
    return interaction.editReply({ embeds: [embed] });
  }

  if (interaction.commandName === 'profile') {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('player') || interaction.user;
    const player = await Player.findOne({ discordId: target.id });
    if (!player) return interaction.editReply(`❌ **${target.username}** is not linked yet (\`/link\`).`);
    const url = `${SITE_URL}/profile/${player.accountId}`;
    const embed = new EmbedBuilder()
      .setColor(0x22d3ee)
      .setTitle(`${player.copsName || target.username}'s profile`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`**${tierName(player.elo ?? 1000)}** · ${player.elo ?? 1000} ELO · ${player.wins || 0}W/${player.losses || 0}L\n\n[View full profile on the website](${url})`)
      .setFooter({ text: 'Exquisite Cops' });
    return interaction.editReply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
