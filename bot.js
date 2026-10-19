const { Telegraf } = require('telegraf');
const fs = require('fs');

// بارگذاری تنظیمات از فایل config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// ساخت ربات با توکن
const bot = new Telegraf(config.botToken);

// استارت ربات
bot.start((ctx) => {
  ctx.reply(
    `سلام 👋 به ربات LandBit خوش اومدی!\n\n🌟 ربات فروش V‌PN با کیفیت و امن\n\nیه برنامهٔ سریع و ارزان و مطمئن!\n\nاز منوی زیر استفاده کن.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎁 خرید اشتراک یک ماهه (250,000 تومان)", callback_data: "buy_1m" }],
          [{ text: "💬 پشتیبانی", callback_data: "support" }]
        ]
      }
    }
  );
});

// انتخاب محصول
bot.action("buy_1m", (ctx) => {
  ctx.answerCbQuery();
  ctx.session.plan = "1month";

  ctx.reply(
    "💎 عالی! اگه کد تخفیف دارید، وارد کنید یا از گزینهٔ ادامه بدون تخفیف استفاده کنید.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📥 وارد کردن کد تخفیف", callback_data: "enter_code" }],
          [{ text: "➡️ ادامه بدون تخفیف", callback_data: "no_code" }]
        ]
      }
    }
  );
});

// وارد کردن کد تخفیف
bot.action("enter_code", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("🔢 لطفاً کد تخفیف خود را وارد کنید.");
  ctx.session.step = "awaiting_code";
});

// ادامه بدون تخفیف
bot.action("no_code", (ctx) => {
  ctx.answerCbQuery();
  const plan = config.plans[ctx.session.plan];
  ctx.session.finalPrice = plan.price;

  ctx.reply(
    `💰 قیمت اشتراک شما: <b>${plan.price.toLocaleString()} تومان</b>\n\n` +
    `💳 لطفاً مبلغ را به کارت زیر واریز کنید:\n` +
    `<code>${config.cardNumber}</code>\n\n` +
    `📎 وقتی واریز کردید، عکس رسید را بفرستید.`,
    { parse_mode: "HTML" }
  );
  ctx.session.step = "awaiting_receipt";
});

// دریافت کد تخفیف
bot.on("text", (ctx) => {
  if (ctx.session.step === "awaiting_code") {
    const code = ctx.message.text.trim().toUpperCase();
    const discount = config.discountCodes[code];

    if (discount) {
      const plan = config.plans[ctx.session.plan];
      const finalPrice = plan.price - discount;
      ctx.session.finalPrice = finalPrice;
      ctx.session.discount = discount;

      ctx.reply(
        `✅ کد تخفیف شما معتبر است!\n\n` +
        `🎉 تخفیف شما: ${discount.toLocaleString()} تومان\n` +
        `💰 قیمت نهایی: <b>${finalPrice.toLocaleString()} تومان</b>\n\n` +
        `💳 لطفاً مبلغ را به کارت زیر واریز کنید:\n` +
        `<code>${config.cardNumber}</code>\n\n` +
        `📎 وقتی واریز کردید، عکس رسید را بفرستید.`,
        { parse_mode: "HTML" }
      );
      ctx.session.step = "awaiting_receipt";
    } else {
      ctx.reply("❌ متاسفانه این کد تخفیف معتبر نیست. لطفاً دوباره امتحان کنید.");
    }
  }
});

// دریافت عکس رسید
bot.on("photo", (ctx) => {
  if (ctx.session.step === "awaiting_receipt") {
    ctx.reply(
      `✅ رسید شما دریافت شد! 🎉\n\n` +
      `🕐 لطفاً صبر کنید، مدیر در حال بررسی و فعال‌سازی اشتراک شماست.\n` +
      `🔗 پس از تأیید، لینک V‌PN براتون فرستاده می‌شه.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 منوی اصلی", callback_data: "back_to_menu" }]
          ]
        }
      }
    );

    ctx.session.step = "done";

    // ارسال اطلاعات خرید به پشتیبانی
    const userId = ctx.from.id;
    const userName = ctx.from.username || "ندارد";
    const firstName = ctx.from.first_name;

    ctx.telegram.sendMessage(
      config.supportId.startsWith("@") ? config.supportId : "@" + config.supportId,
      `🔔 خرید جدید از کاربر:\n` +
      `👤 نام: ${firstName}\n` +
      `🆔 آیدی: ${userId}\n` +
      `🔗 یوزرنیم: ${userName}`
    ).catch(err => console.error("خطا در ارسال پیام به پشتیبانی:", err.message));
  }
});

// بخش پشتیبانی
bot.action("support", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    "📩 برای تماس با پشتیبانی، پیام‌تون رو اینجا بفرستید.\n" +
    "ما اون رو به مدیر منتقل می‌کنیم.\n\n" +
    `📱 آیدی پشتیبانی: @${config.supportId}\n\n` +
    "پیام خود را بفرستید یا انتخاب کنید:",
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

// ترکیب هر دو قابلیت: دریافت کد تخفیف و ارسال پیام به پشتیبانی
bot.on("text", (ctx) => {
  if (ctx.session.step === "awaiting_code") {
    const code = ctx.message.text.trim().toUpperCase();
    const discount = config.discountCodes[code];

    if (discount) {
      const plan = config.plans[ctx.session.plan];
      const finalPrice = plan.price - discount;
      ctx.session.finalPrice = finalPrice;
      ctx.session.discount = discount;

      ctx.reply(
        `✅ کد تخفیف شما معتبر است!\n\n` +
        `🎉 تخفیف شما: ${discount.toLocaleString()} تومان\n` +
        `💰 قیمت نهایی: <b>${finalPrice.toLocaleString()} تومان</b>\n\n` +
        `💳 لطفاً مبلغ را به کارت زیر واریز کنید:\n` +
        `<code>${config.cardNumber}</code>\n\n` +
        `📎 وقتی واریز کردید، عکس رسید را بفرستید.`,
        { parse_mode: "HTML" }
      );
      ctx.session.step = "awaiting_receipt";
    } else {
      ctx.reply("❌ متاسفانه این کد تخفیف معتبر نیست. لطفاً دوباره امتحان کنید.");
    }
  } else if (ctx.session.step === "in_support") {
    const msg = ctx.message.text;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const userName = ctx.from.username || "ندارد";

    ctx.telegram
      .sendMessage(
        config.supportId.startsWith("@") ? config.supportId : "@" + config.supportId,
        `📩 پیام جدید از کاربر:\n` +
        `👤 نام: ${firstName}\n` +
        `🆔 آیدی: ${userId}\n` +
        `🔗 یوزرنیم: ${userName}\n\n` +
        `📝 پیام:\n${msg}`
      )
      .then(() => {
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
      })
      .catch((err) => {
        console.error("خطا در ارسال پیام:", err.message);
        ctx.reply("❌ در ارسال پیام شما مشکلی بوجود آمد. لطفاً دوباره تلاش کنید.");
      });
  }
});

// بازگشت به منوی اصلی
bot.action("back_to_menu", (ctx) => {
  ctx.answerCbQuery();
  ctx.session.step = null;
  ctx.session.plan = null;
  ctx.session.finalPrice = null;
  ctx.session.discount = null;

  ctx.reply(
    "🔙 منوی اصلی:\n\n" +
    "🎁 خرید اشتراک یک ماهه (250,000 تومان)\n\n" +
    "💬 بخش پشتیبانی",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎁 خرید اشتراک یک ماهه (250,000 تومان)", callback_data: "buy_1m" }],
          [{ text: "💬 پشتیبانی", callback_data: "support" }]
        ]
      }
    }
  );
});

// خطاها
bot.catch((err, ctx) => {
  console.error(`[ERROR] در ربات: ${err.message}`);
});

// لاگ خروش
bot.on("polling_error", (err) => {
  console.error(`[POLLING ERROR] ${err.message}`);
});

// اجرای ربات
bot.launch().then(() => {
  console.log("✅ ربات LandBit با موفقیت شروع به کار کرد! 🚀");
});

// خروج بهینه
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));