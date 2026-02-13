export const PRICING = {
  currency: "ZAR",

  FREE: {
    lifetime_parses: 15
  },

  PRO_MONTHLY: {
    plan_code: "PRO_MONTHLY",
    name: "Pro Subscription",
    billing_cycle: "monthly",
    price_cents: 15000
  },

  CREDIT_BUNDLES: {
    CREDIT_10: {
      plan_code: "CREDIT_10",
      credits: 10,
      price_cents: 5000
    },
    CREDIT_25: {
      plan_code: "CREDIT_25",
      credits: 25,
      price_cents: 10000
    },
    CREDIT_100: {
      plan_code: "CREDIT_100",
      credits: 100,
      price_cents: 37500
    }
  }
};
