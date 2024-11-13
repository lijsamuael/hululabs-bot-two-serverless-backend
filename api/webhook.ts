import type { VercelRequest, VercelResponse } from "@vercel/node";
import { EN } from "../i18n";
import { AM } from "../i18n";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const hulupay_token = process.env.HULUPAY_TOKEN;
const bot_token = process.env.TELEGRAM_BOT_TOKEN;
const header = `Authorization: Bearer ${hulupay_token}`;

function getPaymentUrl(order_objet, bot_name) {
  const order_id = order_objet.order_id;
  const total = order_objet.total_price;
  const merchant_category_id = order_objet.merchent_category_id;

  const return_url = `https://telegram-hulupay-api.vercel.app/api/webhook?orderNumber=${order_id}&name=${bot_name}&nonce=${order_id}`;
  const temp_return_url = `https://t.me/${bot_name}`;

  let msg_url = `https://dev.hulu-pay.com/api/v1/telebirr/getpaymenturl`;
  let config = {
    method: "post",
    url: msg_url,
    headers: { Authorization: `Bearer ${hulupay_token}` },
    data: {
      totalAmount: total.toString(),
      nonce: order_id,
      outTradeNo: order_id + "" + merchant_category_id,
      returnUrl: temp_return_url,
      subject: "subject",
    },
  };

  // Return the axios promise so that it can be awaited in the calling function
  return axios.request(config);
}

const verifyInitData = (telegramInitData: string, BOT_TOKEN): boolean => {
  const urlParams = new URLSearchParams(telegramInitData);

  console.log("order object", telegramInitData);
  console.log("url params", urlParams);

  const hash = urlParams.get("hash");
  urlParams.delete("hash");
  urlParams.sort();

  let dataCheckString = "";
  for (const [key, value] of urlParams.entries()) {
    dataCheckString += `${key}=${value}\n`;
  }
  dataCheckString = dataCheckString.slice(0, -1);

  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN);
  const calculatedHash = crypto
    .createHmac("sha256", secret.digest())
    .update(dataCheckString)
    .digest("hex");

  console.log("calculated hash: " + calculatedHash);
  console.log("passed hash: " + hash);
  // return calculatedHash === hash;
  return BOT_TOKEN === bot_token;
};

const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");

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

const prepare_group_message = (
  order,
  customer,
  tg_username,
  local,
  order_date
) => {
  const customer_name = customer ? customer.name : "Unknown";
  const customer_phone = customer ? customer.phone : "Unknown";
  const payment_method = order.payment_method;
  const list_of_items = order.items;

  let items = "";
  for (let key in list_of_items) {
    var item = list_of_items[key];
    items =
      items +
      "• " +
      item.name +
      " X " +
      item.quantity +
      ` ETB ` +
      item.price +
      `\n    `;
  }

  let msg = `
    <strong> NEW ORDER!</strong>
  ▬▬▬▬▬▬▬▬▬▬▬
  <b>Order Number: ${order.order_id}</b>
  <b>Date: ${order_date}</b>

  <b>Customer</b>:
    Name: ${customer_name}
    Phone: ${customer_phone}
    Telegram: @${tg_username}

  <b>Items</b>:
    ${items}

  <b>Payment method</b>: ${EN[payment_method]}  `;
  return msg;
};

const prepare_message = (order, local) => {
  if (
    !order.order_id ||
    !order.items ||
    !order.total_price ||
    !order.shipping_price ||
    !order.payment_method
  ) {
    return `<b>${local["thank_you_msg"]} <tg-emoji emoji-id="5368324170671202286">👍</tg-emoji></b>
    ${local["we_will_contact_you"]}`;
  }

  const order_id = order.order_id;
  const list_of_items = order.items;
  const total = order.total_price.toString();
  const shipping_price = order.shipping_price.toString();
  const payment_method = order.payment_method;
  let items = "";
  for (let key in list_of_items) {
    var item = list_of_items[key];
    items =
      items +
      "\n•\t" +
      item.name +
      " X " +
      item.quantity +
      `${local["currency"]}` +
      item.price;
  }

  var msg =
    `<b>${local["thank_you_msg"]}<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji></b> ${local["your_order_number"]}<i><u>` +
    order_id +
    `</u></i>   

  ${local["your_order_includes"]}:-
  ` +
    items +
    `
  ▬▬▬▬▬▬▬▬▬▬▬

  ${local["shipping"]}: <strong>${local["currency"]} ` +
    shipping_price +
    ` </strong> 
  ${local["total"]}: <strong>${local["currency"]} ` +
    total +
    ` </strong>

  ${local["payment_method"]}: <strong>${local[payment_method]} </strong>`;

  if (payment_method == "banktransfer") {
    msg =
      msg +
      `

  ${local["use_one_of_the_banks"]}   
  • CBE account: 1000344345340
  • Abyssinia: 25343435
  
  ${local["use_order_number_as_ref"]}`;
  } else if (payment_method == "cashondelivery") {
    msg =
      msg +
      `
    ${local["cash_on_delivery_msg"]}
    `;
  }

  return msg;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { body } = req;

  if (!body.initData || !body.order) {
    console.log("initData and order must be provided");
    res.status(404).send("error");
    return;
  }
  const initData = body.initData;
  const bot_token = process.env.TELEGRAM_BOT_TOKEN;
  const order = body.order;

  const lang = body.lang ? body.lang : "EN";

  let local = EN;

  if (lang == "EN" || lang == "en" || lang == "english") {
    local = EN;
  } else if (lang == "AM" || lang == "am" || lang == "amharic") {
    local = AM;
  }

  const bot_name = body.bot_name ? body.bot_name : "";
  const customer_name = body.customer ? body.customer.name : "";
  const customer_phone = body.customer ? body.customer.phone : "";

  console.log("init data", initData);
  console.log("order data", order);
  // const bot_token = decrypt(token, process.env.TELEGRAM_PRIVATE_KEY)

  console.log("bot token", bot_token);

  // verify if init data is correct
  if (verifyInitData(initData, body.token)) {
    console.log("Init data verified!");
    const urlParams = new URLSearchParams(initData);
    // user from urlParams is a string
    const user_id = JSON.parse(urlParams.get("user")!).id;
    let payment_url = "";

    const tg_username = JSON.parse(urlParams.get("user")!).username;
    const timestamp = JSON.parse(urlParams.get("auth_date")!);
    const order_date = new Date(timestamp * 1000).toLocaleString();
    const group_text = prepare_group_message(
      order,
      body.customer,
      tg_username,
      local,
      order_date
    );
    const group_id = order.group_id ? order.group_id.toString() : "";
    // const group_id = ''
    if (order.payment_method && order.payment_method == "checkmo") {
      let hulupay_payment_status = await getPaymentUrl(order, bot_name);
      if (hulupay_payment_status.status == 200) {
        payment_url = hulupay_payment_status.data.data.toPayUrl;
        console.log("payment url: " + payment_url);
      } else {
        console.log(
          `Failed to get telebirr url. Status code ${hulupay_payment_status.status}`
        );
        console.log(hulupay_payment_status.data);
      }
    }

    const text = prepare_message(order, local);
    console.log("language is:" + lang);
    console.log(text);

    const bot = new TelegramBot(bot_token);
    console.log("sending message to " + user_id);

    if (order.payment_method == "checkmo") {
      if (payment_url != "") {
        await bot.sendMessage(user_id, text, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `${local["pay_with_telebirr"]}`,
                  url: payment_url,
                  callback_data: "click",
                },
              ],
            ],
          },
        });
      } else {
        await bot.sendMessage(
          user_id,
          text + `\n${local["we_will_contact_you"]}`,
          { parse_mode: "HTML" }
        );
      }

      // send msg to merchent group

      if (group_id != "") {
        console.log(`Merchant group is ${group_id}`);

        // notify our test group
        await bot.sendMessage("-4235248990", group_text, {
          parse_mode: "HTML",
        });

        await bot.sendMessage(group_id, group_text, { parse_mode: "HTML" });
      }

      // send message to admin group
      // await  bot.sendMessage("-4235248990", group_text, {parse_mode: 'HTML'})
    } else {
      await bot.sendMessage(user_id, text, { parse_mode: "HTML" });

      if (group_id != "") {
        console.log(`Merchant group is ${group_id}`);

        // notify our test group
        await bot.sendMessage("-4235248990", group_text, {
          parse_mode: "HTML",
        });

        await bot.sendMessage(group_id, group_text, { parse_mode: "HTML" });
      }
      // send message to a group
      // await  bot.sendMessage("-4235248990", group_text, {parse_mode: 'HTML'})
    }
  } else {
    console.log("can't verify init data");
  }
  res.status(204).send("");
};

module.exports = allowCors(handler);
