import twilio from "twilio";
import { config } from "../config.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

export const twilioReady = Boolean(accountSid && authToken && verifySid);

const client = twilioReady ? twilio(accountSid, authToken) : null;

/**
 * Send a verification code to the given phone number.
 * @param {string} phone  E.164 format, e.g. "+12125551234"
 */
export async function sendPhoneCode(phone) {
  if (!client) throw new Error("Twilio is not configured");
  const verification = await client.verify.v2
    .services(verifySid)
    .verifications.create({ to: phone, channel: "sms" });
  return verification.status; // "pending"
}

/**
 * Check the code the user entered.
 * @returns {"approved"|"pending"|"canceled"|"expired"} Twilio status
 */
export async function checkPhoneCode(phone, code) {
  if (!client) throw new Error("Twilio is not configured");
  const check = await client.verify.v2
    .services(verifySid)
    .verificationChecks.create({ to: phone, code });
  return check.status; // "approved" on success
}
