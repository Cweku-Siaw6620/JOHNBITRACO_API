const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const isValidPin = (pin) => {
  return typeof pin === "string" && /^\d{5}$/.test(pin);
};

const hashCredential = async (credential) => {
  return bcrypt.hash(credential, 12);
};

const verifyCredential = async (credential, hash) => {
  return bcrypt.compare(credential, hash);
};

const createPinLookup = (pin) => {
  if (!isValidPin(pin)) {
    throw new Error("PIN must contain exactly 5 digits");
  }

  const secret = process.env.PIN_LOOKUP_KEY;

  if (!secret || secret.length < 64) {
    throw new Error("PIN_LOOKUP_KEY is not configured");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`employee:${pin}`)
    .digest("hex");
};

module.exports = {
  isValidPin,
  hashCredential,
  verifyCredential,
  createPinLookup,
};