require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// --- 1. CONECTAREA LA BAZA DE DATE ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('📦 Successfully connected to MongoDB database!'))
    .catch(err => console.error('❌ Error connecting to MongoDB:', err));

// FORȚĂM BOT-UL SĂ FOLOSEASCĂ BAZA 'test' PENTRU TOT
const testDb = mongoose.connection.useDb('test');

// --- 2. SCHEMELE BAZEI DE DATE ---
const playerSchema = new mongoose.Schema({
    discordId: String, 
    copsName: String,
    accountId: String,
    level: Number,
    elo: { type: Number, default: 1000 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    coins: { type: Number, default: 0 }
});
// Aici folosim testDb în loc de mongoose normal
const Player = testDb.model('Player', playerSchema, 'players');

const matchSchema = new mongoose.Schema({
    matchId: String,
    map: String,
    teamA: Array,
    teamB: Array,
    status: { type: String, default: 'ongoing' },
    createdAt: { type: Date, default: Date.now }
});
// Aici la fel, forțăm salvarea în colecția 'matches' din baza 'test'
const Match = testDb.model('Match', matchSchema, 'matches');

// ... [restul codului cu client = new Client(...) și setInterval rămâne exact la fel] ...

// --- 3. SETĂRILE BOT-ULUI ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const MAX_PLAYERS = 1; // Păstrăm 1 pentru testare, schimbăm în 10 la final
const MATCH_LOG_CHANNEL_ID = '1487559983146209511';
const MAPS = ['Bureau', 'Canals', 'Grounded', 'Castello', 'Legacy', 'Plaza', 'Port', 'Raid', 'Soar', 'Village'];

client.on('clientReady', () => {
    console.log(`✅ Radar Online! Logged in as: ${client.user.tag}`);

    // RADARUL PENTRU MATCHMAKING
    setInterval(async () => {
        try {
            const db = mongoose.connection.useDb('test'); 
            if (!db) return;

            const queuePlayers = await db.collection("queue").find({}).sort({ joinedAt: 1 }).toArray();

            if (queuePlayers.length >= MAX_PLAYERS) {
                const matchedQueue = queuePlayers.slice(0, MAX_PLAYERS);
                const matchedDiscordIds = matchedQueue.map(p => p.discordId);

                // 1. Ștergem din coada de așteptare
                await db.collection("queue").deleteMany({ discordId: { $in: matchedDiscordIds } });
                const playersData = await Player.find({ discordId: { $in: matchedDiscordIds } });

                // 2. Generăm Detaliile Meciului
                const randomMap = MAPS[Math.floor(Math.random() * MAPS.length)];
                const matchId = uuidv4().substring(0, 8); // ID Scurt (ex: '9b1deb4d')

                // 3. Facem Echipele (Adaptat pentru testul cu 1 om)
                let teamA = [];
                let teamB = [];
                
                if (MAX_PLAYERS === 1) {
                    teamA = [{ name: playersData[0]?.discordId || matchedDiscordIds[0], elo: playersData[0]?.elo || 1000 }];
                    teamB = [{ name: 'Awaiting Opponent...', elo: '---' }];
                } else {
                    playersData.sort((a, b) => b.elo - a.elo);
                    teamA = [
                        { name: playersData[0]?.discordId || 'Unknown', elo: playersData[0]?.elo || 1000 },
                        { name: playersData[3]?.discordId || 'Unknown', elo: playersData[3]?.elo || 1000 }
                    ];
                    teamB = [
                        { name: playersData[1]?.discordId || 'Unknown', elo: playersData[1]?.elo || 1000 },
                        { name: playersData[2]?.discordId || 'Unknown', elo: playersData[2]?.elo || 1000 }
                    ];
                }

                // 4. Salvăm meciul în Baza de Date pentru SITE
                const newMatch = new Match({ matchId, map: randomMap, teamA, teamB });
                await newMatch.save();

                // 5. Trimitem Log-ul pe Discord cu Link către SITE
                let channel;
                try {
                    channel = await client.channels.fetch(MATCH_LOG_CHANNEL_ID);
                } catch (err) {
                    return console.log("❌ ERROR: Can't find the channel!");
                }

                const embed = new EmbedBuilder()
                    .setTitle('⚔️ MATCH GENERATED!')
                    .setDescription(`Match **#${matchId}** is ready on the website!`)
                    .addFields(
                        { name: '🗺️ Map', value: randomMap, inline: true },
                        { name: '🔗 Match Link', value: `[Click here to view on Website](http://localhost:3000/match/${matchId})`, inline: true }
                    )
                    .setColor('#00ff00')
                    .setFooter({ text: 'Exquisite Cops Hub' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Radar error:", error);
        }
    }, 5000);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!link ')) {
        const args = message.content.split(' ');
        const username = args[1];

        if (!username) return message.reply("⚠️ Please enter a name! Example: `!link pvx67`");
        const loadingMessage = await message.reply(`🔍 Searching data for **${username}**...`);

        try {
            const apiUrl = `https://api-cops.criticalforce.fi/api/public/profile?usernames=${username}`;
            const response = await fetch(apiUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/plain, */*' }
            });
            const rawText = await response.text();
            
            if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
                const data = JSON.parse(rawText);
                if (data && data.length > 0 && data[0].basicInfo) {
                    const player = data[0].basicInfo;
                    await loadingMessage.edit(`✅ **Account successfully validated!**\n🎮 **In Game Name:** ${player.name}\n⭐ **Level:** ${player.playerLevel.level}\n🆔 **Account ID:** ${player.userID}`);

                    const member = message.member;
                    try {
                        await member.setNickname(player.name);
                        const role = message.guild.roles.cache.get('1486798653397008394');
                        if (role) await member.roles.add(role);
                    } catch (err) { console.log("Couldn't change role/name."); }

                    let dbPlayer = await Player.findOne({ discordId: message.author.username });
                    if (!dbPlayer) {
                        dbPlayer = new Player({ discordId: message.author.username, copsName: player.name, accountId: player.userID, level: player.playerLevel.level });
                        await dbPlayer.save();
                        await message.channel.send(`💾 **Profile created in the database!** Your starting ELO is: **1000**.`);
                    } else {
                        dbPlayer.copsName = player.name;
                        dbPlayer.level = player.playerLevel.level;
                        await dbPlayer.save();
                        await message.channel.send(`🔄 **Profile updated!** Your current ELO is: **${dbPlayer.elo}**.`);
                    }
                } else { await loadingMessage.edit(`❌ I couldn't find the account. **${username}**.`); }
            } else { await loadingMessage.edit("⚠️ The servers blocked the request."); }
        } catch (error) {
            console.error(error);
            await loadingMessage.edit("⚠️ API error.");
        }
    }

    if (message.content.startsWith('!win ')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("⛔ Only admins can use this command!");
        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply("⚠️ You must mention a player! Ex: `!win @name`");

        const result = await Player.findOneAndUpdate({ discordId: targetUser.username }, { $inc: { elo: 25, wins: 1 } }, { new: true });
        if (!result) return message.reply("❌ This player is not registered (!link).");
        return message.reply(`🏆 **${targetUser.username}** has won the match! They now have **${result.elo} ELO** and **${result.wins} Wins**.`);
    }

    if (message.content.startsWith('!lose ')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("⛔ Only admins can use this command!");
        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply("⚠️ You must mention a player! Ex: `!lose @name`");

        const result = await Player.findOneAndUpdate({ discordId: targetUser.username }, { $inc: { elo: -25, losses: 1 } }, { new: true });
        if (!result) return message.reply("❌ This player is not registered (!link).");
        return message.reply(`💀 **${targetUser.username}** has lost the match! They have been reduced to **${result.elo} ELO** and have **${result.losses} Losses**.`);
    }
});

client.login(process.env.DISCORD_TOKEN);