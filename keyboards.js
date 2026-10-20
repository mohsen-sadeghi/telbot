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
  ]
};

module.exports = keyboards;