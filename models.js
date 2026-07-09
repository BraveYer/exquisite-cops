const mongoose = require('mongoose');
const { ELO } = require('./elo');

const DB_NAME = process.env.MONGODB_DB || 'test';

// =================== PLAYER ===================
const playerSchema = new mongoose.Schema(
  {
    discordId:       { type: String, required: true, unique: true, index: true },
    discordUsername: { type: String },
    accountId: { type: Number, required: true, unique: true, index: true },
    copsName:  { type: String },
    iconID:    { type: Number },
    level:     { type: Number, default: 0 },
    elo:         { type: Number, default: ELO.DEFAULT },
    wins:        { type: Number, default: 0 },
    losses:      { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    coins:       { type: Number, default: 0 },
    verified:   { type: Boolean, default: false },
    verifiedAt: { type: Date },
    staffLevel: { type: String, default: null }, // 'admin' | 'mod' | null — mirrored from Discord roles by the bot
  },
  { timestamps: true }
);

// =================== MATCH ===================
const teamPlayerSchema = new mongoose.Schema(
  { discordId: { type: String, required: true }, copsName: { type: String }, elo: { type: Number }, avatar: { type: String } },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  { discordId: { type: String, required: true }, winner: { type: String }, reportedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, unique: true, index: true },
    map:     { type: String, default: null },
    teamA:   { type: [teamPlayerSchema], default: [] },
    teamB:   { type: [teamPlayerSchema], default: [] },
    pool:    { type: [teamPlayerSchema], default: [] },
    pickTurn:{ type: String, default: null },
    status:  { type: String, enum: ['drafting', 'veto', 'ongoing', 'pending_review', 'completed', 'disputed', 'cancelled'], default: 'ongoing' },
    vetoTurn:  { type: String, default: null },
    mapPool:   { type: [String], default: [] },
    bannedMaps:{ type: [{ map: String, by: String, _id: false }], default: [] },
    winner:  { type: String, default: null },
    reports: { type: [reportSchema], default: [] },
    result:  { type: mongoose.Schema.Types.Mixed },
    channelId:    { type: String },
    eloApplied:   { type: Boolean, default: false },
    roomName:     { type: String },
    roomPassword: { type: String },
    completedAt:  { type: Date },
  },
  { timestamps: true }
);

// =================== QUEUE ===================
const queueSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true },
    copsName:  { type: String },
    elo:       { type: Number, default: ELO.DEFAULT },
    partyId:   { type: String, default: null },    // set when queued as a party (members stay together)
    joinedAt:  { type: Date, default: Date.now },  // order in queue
    lastSeen:  { type: Date, default: Date.now },  // last heartbeat from the page
  },
  { versionKey: false }
);

// TTL: MongoDB auto-removes an entry 120s after its lastSeen (heartbeat resets it).
queueSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 120 });

const db = mongoose.connection.useDb(DB_NAME);
const Player     = db.model('Player', playerSchema, 'players');
const Match      = db.model('Match', matchSchema, 'matches');
const QueueEntry = db.model('QueueEntry', queueSchema, 'queue');

module.exports = { Player, Match, QueueEntry, db };
