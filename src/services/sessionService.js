const crypto = require("crypto");
const Session = require("../models/Session");

const INACTIVITY_MS = 30 * 60 * 1000;
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

const createSession = async (userId) => {
  const token = crypto.randomBytes(32).toString("hex");

  const now = new Date();

  await Session.create({
    user: userId,
    tokenHash: hashToken(token),
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + MAX_SESSION_MS),
  });

  return token;
};

const validateSession = async (token) => {
  const now = new Date();

  return Session.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      expiresAt: { $gt: now },
      lastActivityAt: {
        $gt: new Date(now.getTime() - INACTIVITY_MS),
      },
    },
    {
      $set: { lastActivityAt: now },
    },
    {
      new: true,
    }
  );
};

const revokeSession = async (sessionId) => {
  await Session.deleteOne({ _id: sessionId });
};

const revokeAllUserSessions = async (userId) => {
  await Session.deleteMany({ user: userId });
};

module.exports = {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
};