require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const fs = require('fs');
const texts = require('./texts');
const keyboards = require('./keyboards');

// بارگذاری تنظیمات
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// ساخت ربات
const bot = new Telegraf(process.env.BOT_TOKEN || config.botToken);

// فعال‌سازی session
bot.use(session());

// تابع لاگ
const log = (userId, action) => {
  const now = new Date().toISOString();
  console.log(`[${now}] کاربر ${userId} عملی انجام داد: ${action}`);
};

// /start
bot.start((ctx) => {
  log(ctx.from.id, "/start");
  const firstName = ctx.from.first_name || "کاربر عزیز";
  ctx.reply(texts.start(firstName), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.mainMenu }
  });
});

// /help
bot.help((ctx) => {
  log(ctx.from.id, "/help");
  ctx.reply(texts.help(), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.mainMenu }
  });
});

// بازگشت به منوی اصلی
bot.action('back_to_menu', async (ctx) => {
  const firstName = ctx.from.first_name || "کاربر عزیز";
  log(ctx.from.id, "back_to_menu");
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.start(firstName), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.mainMenu }
  });
  ctx.session.step = null;
});

// خرید سرویس
bot.action('buy', async (ctx) => {
  log(ctx.from.id, "click buy");
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.buy(), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.plans }
  });
});

// انتخاب پلن (مثلاً plan_1month یا plan_2month)
bot.action(/plan_(.+)/, async (ctx) => {
  const planKey = ctx.match[1];
  const plan = config.plans[planKey];

  if (!plan) {
    log(ctx.from.id, `خطا در انتخاب پلن: ${planKey}`);
    await ctx.answerCbQuery("⚠️ پلن یافت نشد.");
    return;
  }

  log(ctx.from.id, `انتخاب پلن: ${planKey}`);

  const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
  const holderName = process.env.HOLDER_NAME || config.holderName || "محسن صادقی";

  // ذخیره وضعیت در session
  ctx.session.currentPlan = plan;
  ctx.session.step = "_awaiting_receipt";

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    texts.buyPrompt(plan, cardNumber, holderName),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
        ]
      }
    }
  );
});

// تمدید سرویس (در حال ساخت - فعلاً پیام مناسب می‌ده)
bot.action('renew', async (ctx) => {
  log(ctx.from.id, "click renew");
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.noActiveService(), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });
});

// حساب کاربری
bot.action('account', async (ctx) => {
  log(ctx.from.id, "click account");
  const userId = ctx.from.id;
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.noAccount(userId), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });
});

// آموزش اتصال
bot.action('tutorial', async (ctx) => {
  log(ctx.from.id, "click tutorial");
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.tutorial(), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });
});

// پرداخت
bot.action('payment', async (ctx) => {
  log(ctx.from.id, "click payment");
  const plan = ctx.session.currentPlan || config.plans["1month"];
  const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
  const holderName = process.env.HOLDER_NAME || config.holderName || "محسن صادقی";

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    texts.payment(plan.price.toLocaleString(), cardNumber, holderName, false),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboards.backToMenu }
    }
  );
});

// پشتیبانی
bot.action('support', async (ctx) => {
  log(ctx.from.id, "click support");
  const supportId = process.env.SUPPORT_USERNAME || config.supportId || "mohsen5600";

  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.support(supportId), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });
  ctx.session.step = "in_support";
});

// دریافت رسيد (عکس)
bot.on("photo", async (ctx) => {
  if (ctx.session.step === "_awaiting_receipt") {
    log(ctx.from.id, "sent receipt");

    const plan = ctx.session.currentPlan;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || "ناشناس";
    const userName = ctx.from.username || "ندارد";

    ctx.session.hasReceipt = true;
    ctx.session.step = null;

    // ارسال رسید به ادمین
    await ctx.telegram.sendPhoto(
      config.adminId,
      ctx.message.photo[ctx.message.photo.length - 1].file_id,
      {
        caption: texts.adminNewOrder(plan, userId, firstName, userName),
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ تایید و ارسال V‌PN", callback_data: `approve_${userId}` }],
            [{ text: "❌ رد", callback_data: `reject_${userId}` }]
          ]
        }
      }
    );

    await ctx.reply(texts.receiptReceived(), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
        ]
      }
    });
  }
});

// دریافت پیام متنی (برای پشتیبانی)
bot.on("text", (ctx) => {
  if (ctx.session.step === "in_support") {
    const msg = ctx.message.text;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || "ناشناس";
    const userName = ctx.from.username || "ندارد";
    const supportId = process.env.SUPPORT_USERNAME || config.supportId || "mohsen5600";

    ctx.telegram.sendMessage(
      supportId.startsWith("@") ? supportId : "@" + supportId,
      `📩 پیام جدید از کاربر:\n👤 نام: ${firstName}\n🆔 آیدی: ${userId}\n🔗 یوزرنیم: ${userName}\n\n📝 پیام:\n${msg}`
    ).then(() => {
      ctx.reply("✅ پیام شما ارسال شد. مدیر در اسرعت پاسخ می‌ده.", {
        reply_markup: { inline_keyboard: keyboards.backToMenu }
      });
      ctx.session.step = null;
    }).catch(() => {
      ctx.reply("❌ در ارسال پیام شما مشکلی بوجود آمد. لطفاً دوباره تلاش کنید.");
    });
  }
});

// تأیید توسط ادمین
bot.action(/approve_(.+)/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);
  const plan = config.plans["1month"];

  log(targetUserId, "سفارش تأیید شد");

  await ctx.answerCbQuery();

  await ctx.telegram.sendMessage(
    targetUserId,
    texts.activationSuccess(plan.label, plan.duration_days, plan.volume_gb, plan.subLink),
    { parse_mode: 'HTML' }
  ).catch(() => {});

  await ctx.reply(`✅ سفارش کاربر ${targetUserId} تأیید شد.`);
});

// رد توسط ادمین
bot.action(/reject_(.+)/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);

  log(targetUserId, "سفارش رد شد");

  await ctx.answerCbQuery();

  await ctx.telegram.sendMessage(
    targetUserId,
    "❌ سفارش شما رد شد. اگر مشکلی بوده، با پشتیبانی تماس بگیرید.",
    { parse_mode: 'HTML' }
  ).catch(() => {});

  await ctx.reply(`✅ سفارش کاربر ${targetUserId} رد شد.`);
});

// خطاها
bot.catch((err, ctx) => {
  console.error(`[ERROR] در ربات: ${err.message}`);
});

bot.on('polling_error', (err) => {
  console.error(`[POLLING ERROR] ${err.message}`);
});

// شروع ربات
bot.launch().then(() => {
  console.log("✅ ربات LandBit با موفقیت شروع به کار کرد! 🚀");
});

// خروج
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));