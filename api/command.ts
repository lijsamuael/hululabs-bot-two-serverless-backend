import type { VercelRequest, VercelResponse } from "@vercel/node";
// import bot from '../bot'
import { EN } from "../i18n";
import { AM } from "../i18n";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const bot_token = process.env.BOT_TOKEN;

function formatTextToEqualBlockWidth(string) {
  // Special zero-width connector in hex format that doesn't cut off the bot:
  const nullSeparator = "&#x200D;";
  // The maximum number of characters, upon reaching the number of which the bot starts to stretch the width of the block with buttons:
  const maxNumberOfSymbol = 29;
  // Pad the right side of each new line with spaces and a special character, thanks to which the bot does not cut off these spaces, and then add them to the array:
  let resultStringArray = [];
  while (string.length) {
    // Get a substring with the length of the maximum possible width of the option block:
    let partOfString = string.substring(0, maxNumberOfSymbol).trim();
    // Find the first space on the left of the substring to pad with spaces and a line break character:
    let positionOfCarriageTransfer =
      string.length < maxNumberOfSymbol
        ? string.length
        : partOfString.lastIndexOf(" ");
    positionOfCarriageTransfer =
      positionOfCarriageTransfer == -1
        ? partOfString.length
        : positionOfCarriageTransfer;
    // Pad the substring with spaces and a line break character at the end:
    partOfString = partOfString.substring(0, positionOfCarriageTransfer);
    partOfString =
      partOfString +
      new Array(maxNumberOfSymbol - partOfString.length).join(" ") +
      nullSeparator;
    // Add to array of strings:
    resultStringArray.push(`<pre>${partOfString}</pre>`);
    // Leave only the unprocessed part of the string:
    string = string.substring(positionOfCarriageTransfer).trim();
  }

  // Send a formatted string as a column equal to the maximum width of the message that the bot does not deform:

  return resultStringArray.join("\n");
}

const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  // another common pattern
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { body } = req;
  const {
    chat: { id },
    text,
  } = body.message;
  console.log(text);
  const bot = new TelegramBot(bot_token);

  await bot.sendMessage(id, "       👇 Open Store | ለመክፈት ክሊክ ያድርጉ 👇      ", {
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "        Open Store        ",
            web_app: {
              url: "https://demo-three-tg-store.netlify.app/",
            },
          },
        ],
      ],
    },
  });
  res.status(200).send("");
};

module.exports = allowCors(handler);
