// تعریف تمام کیبوردها / دکمه‌های ربات در اینجا

const keyboards = {
  mainMenu: [
    [
      { text: "🛒 خرید سرویس", callback_data: "buy" },
      { text: "🔄 تمدید سرویس", callback_data: "renew" }
    ],
    [
      { text: "👤 حساب کاربری", callback_data: "account" },
      { text: "📚 آموزش اتصال", callback_data: "tutorial" }
    ],
    [
      { text: "💳 پرداخت", callback_data: "payment" },
      { text: "🎫 پشتیبانی", callback_data: "support" }
    ]
  ],

  backToMenu: [
    [
      { text: "🏠 بازگشت به منوی اصلی", callback_data: "back_to_menu" }
    ]
  ],

  plans: [
    [
      { text: "🛍️ یک ماهه (250,000 تومان)", callback_data: "plan_1month" },
      { text: "📆 دو ماهه (400,000 تومان)", callback_data: "plan_2month" }
    ],
    [
      { text: "🔙 منوی اصلی", callback_data: "back_to_menu" }
    ]
  ],

  discountOrContinue: [
    [
      { text: "📥 وارد کردن کد تخفیف", callback_data: "_enter_discount" },
      { text: "➡️ ادامه بدون تخفیف", callback_data: "_continue_no_discount" }
    ],
    [
      { text: "🔙 منوی اصلی", callback_data: "back_to_menu" }
    ]
  ],

  renewPlans: [
    [
      { text: "🔄 تمدید یک ماهه (250,000 تومان)", callback_data: "renew_1month" },
      { text: "🔁 تمدید دو ماهه (400,000 تومان)", callback_data: "renew_2month" }
    ],
    [
      { text: "🔙 منوی اصلی", callback_data: "back_to_menu" }
    ]
  ]
};

module.exports = keyboards;