require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const fs = require('fs');
const texts = require('./texts');
const keyboards = require('./keyboards');

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

// خرید سرویس - نمایش پلن‌ها
bot.action('buy', async (ctx) => {
  log(ctx.from.id, "click buy");
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.buy(), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.plans
    }
  });
});

// انتخاب پلن
bot.action(/plan_(.+)/, async (ctx) => {
  const planKey = ctx.match[1];
  const plan = config.plans[planKey];

  if (!plan) {
    await ctx.answerCbQuery("⚠️ پلن یافت نشد.");
    return;
  }

  log(ctx.from.id, `selected plan ${planKey}`);
  ctx.session.currentPlan = plan;

  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.discountOrContinue(plan), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.discountOrContinue
    }
  });
});

// وارد کردن کد تخفیف
bot.action("_enter_discount", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("🔢 کد تخفیف خود را وارد کنید:", {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.backToMenu
    }
  });
  ctx.session.step = "_awaiting_discount";
});

// ادامه بدون تخفیف
bot.action("_continue_no_discount", async (ctx) => {
  const plan = ctx.session.currentPlan;

  if (!plan) {
    await ctx.answerCbQuery("⚠️ ابتدا یه پلن انتخاب کنید.");
    return;
  }

  log(ctx.from.id, "continue without discount");

  await ctx.answerCbQuery();

  ctx.session.finalPrice = plan.price;
  ctx.session.discount = 0;
  ctx.session.hasReceipt = false;

  const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
  const holderName = process.env.HOLDER_NAME || config.holderName || "محسن صادقی";

  await ctx.editMessageText(texts.continueNoDiscountMessage(plan, cardNumber, holderName), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.backToMenu
    }
  });

  ctx.session.step = "_awaiting_receipt";
});

// دریافت کد تخفیف
bot.on("text", (ctx) => {
  if (ctx.session.step === "_awaiting_discount") {
    const code = ctx.message.text.trim().toUpperCase();
    const discount = config.discountCodes[code];
    const plan = ctx.session.currentPlan;

    if (discount) {
      const finalPrice = plan.price - discount;

      ctx.session.finalPrice = finalPrice;
      ctx.session.discount = discount;
      ctx.session.hasReceipt = false;

      const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
      const holderName = process.env.HOLDER_NAME || config.holderName || "محسن صادقی";

      // جایگزینی مقدار در متن
      const message = texts.discountApplied(discount, finalPrice)
        .replace("{card_number}", cardNumber)
        .replace("{holder_name}", holderName);

      ctx.reply(message, { parse_mode: 'HTML' });
      ctx.session.step = "_awaiting_receipt";
    } else {
      ctx.reply(texts.discountInvalid(), {
        reply_markup: {
          inline_keyboard: keyboards.discountOrContinue
        }
      });
      ctx.session.step = null;
    }
  }
});

// دریافت رسید (عکس)
bot.on("photo", async (ctx) => {
  if (ctx.session.step === "_awaiting_receipt") {
    log(ctx.from.id, "sent receipt");

    const plan = ctx.session.currentPlan;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || "ناشناس";
    const userName = ctx.from.username || "ندارد";

    // ذخیره وضعیت پرداخت
    ctx.session.hasReceipt = true;

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
        inline_keyboard: keyboards.backToMenu
      }
    });

    ctx.session.step = null;
  }
});

// تأیید توسط ادمین
bot.action(/approve_(.+)/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);
  const plan = ctx.session.currentPlan || config.plans["1month"];

  log(targetUserId, "approved by admin");

  await ctx.answerCbQuery();

  await ctx.telegram.sendMessage(
    targetUserId,
    texts.activationSuccess(plan.label, plan.duration_days, plan.volume_gb, plan.subLink),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboards.mainMenu
      }
    }
  );

  await ctx.reply(`✅ سفارش کاربر ${targetUserId} تأیید شد.`);
});

// رد توسط ادمین
bot.action(/reject_(.+)/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);

  log(targetUserId, "rejected by admin");

  await ctx.answerCbQuery();

  await ctx.telegram.sendMessage(
    targetUserId,
    `❌ سفارش شما رد شد.\nاگر مشکلی بوده، با پشتیبانی تماس بگیرید. 🎫`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboards.mainMenu
      }
    }
  );

  await ctx.reply(`✅ سفارش کاربر ${targetUserId} رد شد.`);
});

// تمدید سرویس
bot.action("renew", async (ctx) => {
  log(ctx.from.id, "click renew");

  const activeService = ctx.session.activeService || config.plans["1month"];

  if (!activeService) {
    await ctx.answerCbQuery();
    await ctx.editMessageText(texts.noActiveService(), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboards.backToMenu
      }
    });
    return;
  }

  await ctx.answerCbQuery();

  const servicesText = `🔹 ${activeService.label}\n${activeService.duration_days} روز`;

  await ctx.editMessageText(
    `${texts.renew(servicesText)}\n` +
    `لطفاً یکی از گزینه‌های زیر را انتخاب کنید:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboards.renewPlans
      }
    }
  );
});

// انتخاب پلن تمدید
bot.action(/renew_(.+)/, async (ctx) => {
  const planKey = ctx.match[1];
  const plan = config.plans[planKey];

  if (!plan) {
    await ctx.answerCbQuery("⚠️ پلن یافت نشد.");
    return;
  }

  log(ctx.from.id, `selected renew plan ${planKey}`);
  ctx.session.currentPlan = plan;

  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.discountOrContinue(plan), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.discountOrContinue
    }
  });
});

// حساب کاربری
bot.action("account", async (ctx) => {
  log(ctx.from.id, "click account");

  const userId = ctx.from.id;
  const activeService = ctx.session.activeService || config.plans["1month"];

  await ctx.answerCbQuery();

  if (activeService) {
    await ctx.editMessageText(
      texts.account(userId, activeService.label, activeService.duration_days, "0", "نامحدود", activeService.subLink),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboards.backToMenu
        }
      }
    );
  } else {
    await ctx.editMessageText(texts.noAccount(userId), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboards.backToMenu
      }
    });
  }
});

// آموزش
bot.action("tutorial", async (ctx) => {
  log(ctx.from.id, "click tutorial");
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.tutorial(), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.backToMenu
    }
  });
});

// پرداخت - نمایش وضعیت پرداخت فعلی
bot.action("payment", async (ctx) => {
  log(ctx.from.id, "click payment");

  const plan = ctx.session.currentPlan || config.plans["1month"];
  const cardNumber = process.env.CARD_NUMBER || config.cardNumber;
  const holderName = process.env.HOLDER_NAME || config.holderName || "محسن صادقی";
  const hasReceipt = ctx.session.hasReceipt || false;

  await ctx.answerCbQuery();

  await ctx.editMessageText(
    texts.payment(plan.price.toLocaleString(), cardNumber, holderName, hasReceipt),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboards.backToMenu
      }
    }
  );
});

// پشتیبانی
bot.action("support", async (ctx) => {
  log(ctx.from.id, "click support");

  const supportId = process.env.SUPPORT_USERNAME || config.supportId || "mohsen5600";

  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.support(supportId), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboards.backToMenu
    }
  });
  ctx.session.step = "in_support";
});

// پیام عمومی برای ساپورت
bot.on("text", (ctx) => {
  if (ctx.session.step === "in_support") {
    const msg = ctx.message.text;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const userName = ctx.from.username || "ندارد";
    const supportId = process.env.SUPPORT_USERNAME || config.supportId || "mohsen5600";

    ctx.telegram.sendMessage(
      supportId.startsWith("@") ? supportId : "@" + supportId,
      `📩 پیام جدید از کاربر:\n👤 نام: ${firstName}\n🆔 آیدی: ${userId}\n🔗 یوزرنیم: ${userName}\n\n📝 پیام:\n${msg}`
    ).then(() => {
      ctx.reply(
        "✅ پیام شما ارسال شد. مدیر در اسرعت پاسخ می‌ده.",
        {
          reply_markup: {
            inline_keyboard: keyboards.backToMenu
          }
        }
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
      reply_markup: {
        inline_keyboard: keyboards.mainMenu
      }
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