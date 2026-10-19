const { Telegraf, session } = require('telegraf');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const bot = new Telegraf(config.botToken);
bot.use(session());

// ذخیره‌سازی موقت سفارشات کاربران
const pendingPayments = {};
const userSubscriptions = {};

// شروع ربات
bot.start((ctx) => {
  const firstName = ctx.from.first_name || "کاربر عزیز";
  const username = ctx.from.username || "ندارد";

  // ثبت‌نام کاربر در سیستم
  if (!userSubscriptions[ctx.from.id]) {
    userSubscriptions[ctx.from.id] = {
      username: username,
      subscriptions: []
    };
  }

  ctx.reply(
    `👋 سلام ${firstName} عزیز!\n\n` +
    `به ربات LandBit خوش اومدی 🌐\n\n` +
    `اینجا می‌تونی V‌PN باکیفیت و امن بگیری.\n` +
    `از منوی زیر می‌تونی انتخاب کنی چه کاری انجام بدی.\n\n` +
    `🚀 ربات با قابلیت ارائه سرویس فعال و پشتیبانی ۲۴ ساعته`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 خرید سرویس", callback_data: "buy" }],
          [{ text: "📚 آموزش استفاده", callback_data: "guide" }],
          [{ text: "💼 سرویس‌های من", callback_data: "my_services" }],
          [{ text: "📞 تماس با پشتیبانی", callback_data: "support" }]
        ]
      }
    }
  );
});

// منوی اصلی
bot.action("back_to_menu", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("🔙 منوی اصلی:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 خرید سرویس", callback_data: "buy" }],
        [{ text: "📚 آموزش استفاده", callback_data: "guide" }],
        [{ text: "💼 سرویس‌های من", callback_data: "my_services" }],
        [{ text: "📞 تماس با پشتیبانی", callback_data: "support" }]
      ]
    }
  });
});

// خرید سرویس
bot.action("buy", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    "🛒 خرید سرویس\n\n" +
    "🔹 اشتراک یک ماهه: 250,000 تومان\n\n" +
    "📌 برای ادامه، کد تخفیف خود را وارد کنید یا از بدون تخفیف ادامه کنید:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📥 وارد کردن کد تخفیف", callback_data: "enter_discount" }],
          [{ text: "➡️ ادامه بدون تخفیف", callback_data: "continue_no_discount" }],
          [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
        ]
      }
    }
  );
});

// وارد کردن کد تخفیف
bot.action("enter_discount", (ctx) => {
  ctx.answerCbQuery();
  ctx.session.step = "awaiting_discount";
  ctx.reply("🔢 کد تخفیف خود را وارد کنید:");
});

// ادامه بدون تخفیف
bot.action("continue_no_discount", (ctx) => {
  ctx.answerCbQuery();
  const plan = config.plans["1month"];
  ctx.session.finalPrice = plan.price;
  ctx.session.planKey = "1month";
  ctx.session.discount = 0;

  ctx.reply(
    `💰 قیمت نهایی: ${plan.price.toLocaleString()} تومان\n\n` +
    `💳 لطفاً مبلغ را به کارت زیر واریز کنید:\n` +
    `<code>${config.cardNumber}</code>\n\n` +
    `📎 پس از واریز، عکس رسید خود را ارسال کنید.`,
    { parse_mode: "HTML", reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
      ]
    }}
  );

  // ذخیره سفارش در حالت منتظر پرداخت
  pendingPayments[ctx.from.id] = {
    planKey: "1month",
    price: plan.price,
    discount: 0,
    userId: ctx.from.id,
    username: ctx.from.username || "ندارد",
    firstName: ctx.from.first_name || "ناشناس"
  };

  ctx.session.step = "awaiting_receipt";
});

// دریافت متن (برای کد تخفیف)
bot.on("text", (ctx) => {
  const step = ctx.session.step;

  if (step === "awaiting_discount") {
    const code = ctx.message.text.trim().toUpperCase();
    const discount = config.discountCodes[code];

    if (discount) {
      const plan = config.plans["1month"];
      const finalPrice = plan.price - discount;

      ctx.session.finalPrice = finalPrice;
      ctx.session.planKey = "1month";
      ctx.session.discount = discount;

      ctx.reply(
        `✅ کد تخفیف شما معتبر است!\n\n` +
        `🎁 تخفیف: ${discount.toLocaleString()} تومان\n` +
        `💰 قیمت نهایی: <b>${finalPrice.toLocaleString()} تومان</b>\n\n` +
        `💳 لطفاً مبلغ را به کارت زیر واریز کنید:\n` +
        `<code>${config.cardNumber}</code>\n\n` +
        `📎 پس از واریز، عکس رسید خود را ارسال کنید.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
            ]
          }
        }
      );

      pendingPayments[ctx.from.id] = {
        planKey: "1month",
        price: plan.price,
        discount: discount,
        userId: ctx.from.id,
        username: ctx.from.username || "ندارد",
        firstName: ctx.from.first_name || "ناشناس"
      };

      ctx.session.step = "awaiting_receipt";
    } else {
      ctx.reply("❌ کد تخفیف نامعتبر است. لطفاً دوباره تلاش کنید.\n" +
        "یا از منو زیر استفاده کنید:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📥 وارد کردن دوباره", callback_data: "enter_discount" }],
            [{ text: "➡️ ادامه بدون تخفیف", callback_data: "continue_no_discount" }],
            [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
          ]
        }
      });
    }

    ctx.session.step = null;
  } else if (step === "awaiting_receipt") {
    // اینجا فقط برای جلوگیری از پیام‌های غیرمنتظره
    ctx.reply("📎 لطفاً عکس رسید را ارسال کنید.");
  } else if (step === "in_support") {
    const msg = ctx.message.text;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const userName = ctx.from.username || "ندارد";

    ctx.telegram.sendMessage(
      `@${config.supportId}`,
      `📩 پیام جدید از کاربر:\n👤 نام: ${firstName}\n🆔 آیدی: ${userId}\n🔗 یوزرنیم: ${userName}\n\n📝 پیام:\n${msg}`
    ).then(() => {
      ctx.reply(
        "✅ پیام شما با موفقیت ارسال شد. مدیر در اسرعت پاسخ می‌ده.\n\n" +
        "برای بازگشت به منوی اصلی:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
            ]
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

// دریافت عکس رسید
bot.on("photo", (ctx) => {
  if (ctx.session.step === "awaiting_receipt") {
    const payment = pendingPayments[ctx.from.id];
    if (!payment) return;

    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || "ناشناس";
    const userName = ctx.from.username || "ندارد";

    ctx.reply(
      `✅ رسید شما دریافت شد! 🎉\n\n` +
      `🕐 در حال بررسی توسط مدیر...\n` +
      `🔗 پس از تأیید، لینک V‌PN برای شما ارسال می‌شود.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
          ]
        }
      }
    );

    // ارسال رسید به ادمین
    ctx.telegram.sendPhoto(
      config.adminId,
      ctx.message.photo[ctx.message.photo.length - 1].file_id,
      {
        caption:
          `🔔 سفارش جدید از کاربر:\n` +
          `👤 نام: ${firstName}\n` +
          `🆔 آیدی: ${userId}\n` +
          `🔗 یوزرنیم: ${userName}\n` +
          `💰 مبلغ: ${payment.price.toLocaleString()} تومان (تخفیف: ${payment.discount.toLocaleString()} تومان)\n\n` +
          `✅ روی "تایید" کلیک کنید تا سفارش فعال شود.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ تایید و ارسال V‌PN", callback_data: `approve_${userId}` }],
            [{ text: "❌ رد", callback_data: `reject_${userId}` }]
          ]
        }
      }
    ).catch(err => {
      console.error("خطا در ارسال رسید به ادمین:", err.message);
      ctx.telegram.sendMessage(
        config.adminId,
        `⚠️ هشدار: کاربر ${firstName} (${userId}) رسید ارسال کرده اما ارسال عکس به ادمین با خطا مواجه شد.\n` +
        `لطفاً به صورت دستی بررسی کنید.`
      );
    });

    ctx.session.step = null;
  }
});

// تایید یا رد توسط ادمین
bot.action(/approve_(\d+)/, (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);
  const plan = config.plans["1month"];

  // افزودن سرویس به کاربر
  if (!userSubscriptions[targetUserId]) {
    userSubscriptions[targetUserId] = {
      username: "ندارد",
      subscriptions: []
    };
  }

  userSubscriptions[targetUserId].subscriptions.push({
    planKey: "1month",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    configLink: plan.subLink || "در دسترس نیست"
  });

  // ارسال لینک V‌PN به کاربر
  ctx.telegram.sendMessage(
    targetUserId,
    `🎉 سفارش شما تأیید شد!\n\n` +
    `🔗 لینک V‌PN شما:\n${plan.subLink || "به زودی در دسترس قرار داده می‌شود."}\n\n` +
    `💡 برای استفاده از V‌PN، می‌توانید از اپلیکیشن V2Box استفاده کنید.\n` +
    `📖 برای راهنمای نصح و استفاده، روی "📚 آموزش استفاده" کلیک کنید.`
  ).then(() => {
    ctx.replyWithMarkdown(`✅ سفارش کاربر ${targetUserId} تأیید شد و V‌PN ارسال شد.`);
  }).catch((err) => {
    console.error("خطا در ارسال پیام به کاربر:", err.message);
    ctx.replyWithMarkdown(`⚠️ سفارش کاربر ${targetUserId} تأیید شد ولی ارسال V‌PN با خطا مواجه شد.`);
  });

  // حذف سفارش
  delete pendingPayments[targetUserId];
});

bot.action(/reject_(\d+)/, (ctx) => {
  const targetUserId = parseInt(ctx.match[1]);

  ctx.telegram.sendMessage(
    targetUserId,
    `❌ متاسفانه سفارش شما رد شد.\n\n` +
    `📞 در صورتی که مشکلی داشتید، با پشتیبانی تماس بگیرید.`
  ).then(() => {
    ctx.replyWithMarkdown(`✅ سفارش کاربر ${targetUserId} رد شد.`);
  }).catch(() => {
    ctx.reply(`⚠️ کاربر ${targetUserId} یافت نشد.`);
  });

  delete pendingPayments[targetUserId];
});

// بخش سرویس‌های من
bot.action("my_services", (ctx) => {
  ctx.answerCbQuery();
  const user = userSubscriptions[ctx.from.id];

  if (!user || !user.subscriptions || user.subscriptions.length === 0) {
    ctx.reply(
      `📭 هیچ سرویس فعالی ندارید.\n\n` +
      `🛒 برای خرید، روی "خرید سرویس" کلیک کنید.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 خرید سرویس", callback_data: "buy" }],
            [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
          ]
        }
      }
    );
    return;
  }

  const servicesList = user.subscriptions.map((sub, index) => {
    const endDate = new Date(sub.endDate);
    const now = new Date();
    const statusEmoji = sub.status === "active" ? "✅ فعال" : "❌ غیرفعال";
    const expired = endDate < now ? "⏳ منقضی شده" : "✅ معتبر";

    return `${index + 1}. ${sub.planKey === "1month" ? "اشتراک یک ماهه" : sub.planKey}\n` +
      `   وضعیت: ${statusEmoji}\n` +
      `   انقضا: ${expired}`;
  }).join("\n\n");

  ctx.reply(
    `💼 سرویس‌های شما:\n\n${servicesList}\n\n` +
    `📌 نکته: برای استفاده مجدد از هر سرویس، لینک آن را می‌توانید در ادامه دریافت کنید.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
        ]
      }
    }
  );
});

// آموزش استفاده
bot.action("guide", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    `📚 آموزش استفاده از V‌PN\n\n` +
    `🔹 ۱. ابتدا یک برنامه V2Box نصب کنید:\n` +
    `iOS: https://apps.apple.com/app/v2box/id1522233049\n` +
    `Android: https://play.google.com/store/apps/details?id=com.v2fly.androidvpn\n` +
    `ویندوز: https://github.com/2dust/v2rayN/releases\n\n` +
    `🔹 ۲. پس از خرید، یه لینک V‌PN براتون میاد.\n` +
    `🔹 ۳. لینک رو کپی کنید و داخل اپ V2Box وارد کنید.\n` +
    `🔹 ۴. وصل شوید و از اینترنت آزاد لذت ببرید! 🚀\n\n` +
    `❓ اگر سؤالی داشتید، از "تماس با پشتیبانی" استفاده کنید.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
        ]
      }
    }
  );
});

// تماس با پشتیبانی
bot.action("support", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    `📞 تماس با پشتیبانی\n\n` +
    `اگر سؤال یا مشکلی داشتید، پیام بدهید تا مدیر پاسخ بده.\n\n` +
    `@${config.supportId}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
        ]
      }
    }
  );

  ctx.session.step = "in_support";
});

// خطاها
bot.catch((err, ctx) => {
  console.error(`[ERROR] در ربات: ${err.message}`);
});

bot.on('polling_error', (err) => {
  console.error(`[POLLING ERROR] ${err.message}`);
});

// اجرای ربات
bot.launch().then(() => {
  console.log("✅ ربات LandBit با موفقیت شروع به کار کرد! 🚀");
});

// خروج بهینه
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
