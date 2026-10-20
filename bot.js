require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const fs = require('fs');
const texts = require('./texts');
const keyboards = require('./keyboards');
const escapeHtml = require('./utils/escape');

// بارگذاری تنظیمات از فایل config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// ساخت ربات با توکن از متغیر محیطی یا config.json
const bot = new Telegraf(process.env.BOT_TOKEN || config.botToken);

// استفاده از سشن
bot.use(session());

// لاگ‌گیری رویدادها
const log = (userId, action) => {
  const now = new Date().toISOString();
  console.log(`[${now}] کاربر ${userId} عملی انجام داد: ${action}`);
};

// دستورات اصلی
bot.start((ctx) => {
  const firstName = ctx.from.first_name || "کاربر عزیز";
  log(ctx.from.id, "/start");

  ctx.reply(texts.start(firstName), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.mainMenu
    }
  });
});

bot.help((ctx) => {
  log(ctx.from.id, "/help");
  ctx.reply(texts.help(), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.mainMenu
    }
  });
});

// منوی اصلی - callbackها
bot.action('back_to_menu', async (ctx) => {
  const firstName = ctx.from.first_name || "کاربر عزیز";
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.start(firstName), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.mainMenu
    }
  });
});

// خرید سرویس
bot.action('buy', async (ctx) => {
  log(ctx.from.id, "click buy");
  await ctx.answerCbQuery();

  const plan = config.plans['1month'];
  if (!plan) {
    await ctx.editMessageText(texts.noPlans(), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboards.backToMenu }
    });
    return;
  }

  const planText = `🔹 ${plan.label}\nقیمت: ${plan.price.toLocaleString()} تومان\nمدت: ${plan.duration_days} روز\n`;

  await ctx.editMessageText(texts.buy(planText), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📥 وارد کردن کد تخفیف", callback_data: "enter_discount" },
          { text: "➡️ ادامه بدون تخفیف", callback_data: "continue_no_discount" }
        ],
        ...keyboards.backToMenu
      ]
    }
  });
});

// ورود کد تخفیف
bot.action('enter_discount', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("🔢 کد تخفیف خود را وارد کنید:", {
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });
  ctx.session.step = "awaiting_discount";
});

// ادامه بدون تخفیف
bot.action('continue_no_discount', async (ctx) => {
  log(ctx.from.id, "continue without discount");
  const plan = config.plans['1month'];
  const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
  const holderName = process.env.HOLDER_NAME || "ناشناس";

  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.payment(plan.price.toLocaleString(), cardNumber, holderName), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });

  ctx.session.pendingPayment = {
    planKey: "1month",
    price: plan.price,
    discount: 0
  };
  ctx.session.step = "awaiting_receipt";
});

// دریافت کد تخفیف
bot.on('text', (ctx) => {
  if (ctx.session.step === "awaiting_discount") {
    const code = ctx.message.text.trim().toUpperCase();
    const discount = config.discountCodes[code];

    if (discount) {
      const plan = config.plans['1month'];
      const finalPrice = plan.price - discount;

      ctx.session.pendingPayment = {
        planKey: "1month",
        price: plan.price,
        discount: discount,
        finalPrice: finalPrice
      };
      ctx.session.step = "awaiting_receipt";

      ctx.reply(
        `✅ کد تخفیف شما معتبر است!\n\n🎁 تخفیف: ${discount.toLocaleString()} تومان\n💰 قیمت نهایی: <b>${finalPrice.toLocaleString()} تومان</b>\n`,
        { parse_mode: 'HTML' }
      ).then(() => {
        return ctx.reply(
          "💳 لطفاً مبلغ را به کارت زیر واریز کنید:\n" +
          `<code>${process.env.CARD_NUMBER || config.cardNumber}</code>\n\nبه نام: ${process.env.HOLDER_NAME || "ناشناس"}\n`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboards.backToMenu }
          }
        );
      });
    } else {
      ctx.reply("❌ کد تخفیف نامعتبر است. لطفاً دوباره تلاش کنید.", {
        reply_markup: { inline_keyboard: keyboards.backToMenu }
      });
      ctx.session.step = null;
    }
  }
});

// دریافت رسید (عکس)
bot.on('photo', async (ctx) => {
  if (ctx.session.step === "awaiting_receipt") {
    log(ctx.from.id, "sent receipt");
    const payment = ctx.session.pendingPayment;

    if (!payment) {
      ctx.reply("⚠️ ابتدا یه پلن انتخاب کنید.", {
        reply_markup: { inline_keyboard: [{ text: "🛒 خرید سرویس", callback_data: "buy" }] }
      });
      return;
    }

    // ارسال رسید به ادمین
    const adminId = process.env.ADMIN_ID || 6202839966;
    ctx.telegram.sendPhoto(
      adminId,
      ctx.message.photo[ctx.message.photo.length - 1].file_id,
      {
        caption: `🔔 سفارش جدید:\n👤 ${ctx.from.first_name}\n🆔 ${ctx.from.id}\n💰 ${payment.finalPrice || payment.price} تومان`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ تایید", callback_data: `approve_${ctx.from.id}` }],
            [{ text: "❌ رد", callback_data: `reject_${ctx.from.id}` }]
          ]
        }
      }
    );

    ctx.reply(texts.receiptReceived(), {
      reply_markup: { inline_keyboard: keyboards.backToMenu }
    });

    ctx.session.step = null;
  }
});

// تأیید توسط ادمین
bot.action(/approve_(\d+)/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);
  const plan = config.plans['1month'];

  await ctx.answerCbQuery();

  const link = plan.subLink || "https://example.com/sub"; 

  await ctx.telegram.sendMessage(
    targetUserId,
    texts.activationSuccess(plan.label, plan.duration_days, plan.volume_gb, link),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboards.mainMenu } }
  );

  await ctx.reply(`✅ سفارش کاربر ${targetUserId} تأیید شد.`);
});

// رد توسط ادمین
bot.action(/reject_(\d+)/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);

  await ctx.answerCbQuery();
  await ctx.telegram.sendMessage(
    targetUserId,
    `❌ سفارش شما رد شد.\nاگر مشکلی بوده، با پشتیبانی تماس بگیرید. 🎫`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboards.mainMenu } }
  );

  await ctx.reply(`✅ سفارش کاربر ${targetUserId} رد شد.`);
});

// تمدید سرویس
bot.action('renew', async (ctx) => {
  log(ctx.from.id, "click renew");
  await ctx.answerCbQuery();

  const activeService = ctx.session.activeService;
  if (!activeService) {
    await ctx.editMessageText(texts.noActiveService(), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboards.backToMenu }
    });
    return;
  }

  const serviceText = `🔹 ${activeService.name}\n${activeService.expiry}\n`;
  await ctx.editMessageText(texts.renew(serviceText), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📥 وارد کردن کد تخفیف", callback_data: "enter_discount_renew" },
          { text: "➡️ ادامه بدون تخفیف", callback_data: "continue_no_discount_renew" }
        ],
        ...keyboards.backToMenu
      ]
    }
  });
});

// حساب کاربری
bot.action('account', async (ctx) => {
  log(ctx.from.id, "click account");
  await ctx.answerCbQuery();

  const userId = ctx.from.id;
  const activeService = ctx.session.activeService;

  if (activeService) {
    await ctx.editMessageText(
      texts.account(userId, activeService.name, activeService.daysLeft, activeService.usedGb, activeService.totalGb, activeService.subscriptionLink),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboards.backToMenu } }
    );
  } else {
    await ctx.editMessageText(texts.noAccount(userId), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboards.backToMenu }
    });
  }
});

// آموزش
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
  const payment = ctx.session.pendingPayment;
  const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
  const holderName = process.env.HOLDER_NAME || "ناشناس";

  await ctx.answerCbQuery();

  if (!payment) {
    await ctx.editMessageText(texts.noPaymentInfo(), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [{ text: "🛒 خرید سرویس", callback_data: "buy" }] }
    });
    return;
  }

  await ctx.editMessageText(
    texts.payment(payment.finalPrice?.toLocaleString() || payment.price.toLocaleString(), cardNumber, holderName),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboards.backToMenu } }
  );
});

// پشتیبانی
bot.action('support', async (ctx) => {
  log(ctx.from.id, "click support");
  const supportId = process.env.SUPPORT_USERNAME || config.supportId;

  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.support(supportId), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboards.backToMenu }
  });
  ctx.session.step = "in_support";
});

// پیام عمومی برای ساپورت
bot.on('text', (ctx) => {
  if (ctx.session.step === "in_support") {
    const msg = ctx.message.text;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const userName = ctx.from.username || "ندارد";
    const supportId = process.env.SUPPORT_USERNAME || config.supportId;

    ctx.telegram.sendMessage(
      supportId.startsWith("@") ? supportId : "@" + supportId,
      `📩 پیام جدید از کاربر:\n👤 نام: ${firstName}\n🆔 آیدی: ${userId}\n🔗 یوزرنیم: ${userName}\n\n📝 پیام:\n${msg}`
    ).then(() => {
      ctx.reply(
        "✅ پیام شما ارسال شد. مدیر در اسرعت پاسخ می‌ده.",
        { reply_markup: { inline_keyboard: keyboards.backToMenu } }
      );
      ctx.session.step = null;
    }).catch((err) => {
      console.error("خطا در ارسال پیام:", err.message);
      ctx.reply("❌ در ارسال پیام شما مشکلی بوجود آمد. لطفاً دوباره تلاش کنید.");
    });
  }
});

// دستورات ناشناخته
bot.on('text', (ctx) => {
  const knownCommands = ['/start', '/help', '/buy', '/renew', '/profile', '/account', '/tutorial', '/payment', '/support'];
  const isCommand = ctx.message.text.startsWith('/');
  const isKnown = knownCommands.some(cmd => ctx.message.text.includes(cmd));

  if (isCommand && !isKnown) {
    ctx.reply("⚠️ متوجه نشدم. لطفاً از منوی زیر استفاده کن یا /help را بفرست.", {
      reply_markup: { inline_keyboard: keyboards.mainMenu }
    });
  }
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

// خروج بهینه
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));