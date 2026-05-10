import "dotenv/config";

function required(name, fallback = "") {
  return process.env[name] || fallback;
}

export const config = {
  env: required("NODE_ENV", "development"),
  port: Number(process.env.PORT || required("SERVER_PORT", "8787")),
  publicBaseUrl: required("PUBLIC_BASE_URL", "https://vaultline.me"),
  allowedOrigins: required("ALLOWED_ORIGINS", "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: required("JWT_SECRET", "development-only-secret"),
  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: required("SUPABASE_ANON_KEY"),
    storageBucket: required("SUPABASE_STORAGE_BUCKET", "locked-media"),
  },
  stripe: {
    secretKey: required("STRIPE_SECRET_KEY"),
    publishableKey: required("STRIPE_PUBLISHABLE_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    platformFeePercent: Number(required("STRIPE_PLATFORM_FEE_PERCENT", "10")),
    connectRefreshUrl: required("STRIPE_CONNECT_REFRESH_URL", "https://vaultline.me/stripe/refresh"),
    connectReturnUrl: required("STRIPE_CONNECT_RETURN_URL", "https://vaultline.me/stripe/return"),
  },
  email: {
    resendApiKey: required("RESEND_API_KEY"),
    from: required("EMAIL_FROM", "Vaultline <no-reply@vaultline.me>"),
    support: required("SUPPORT_EMAIL", "support@vaultline.me"),
  },
  twilio: {
    accountSid: required("TWILIO_ACCOUNT_SID"),
    authToken: required("TWILIO_AUTH_TOKEN"),
    verifySid: required("TWILIO_VERIFY_SERVICE_SID"),
  },
  adminEmails: required("ADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
};

export function assertLaunchConfig() {
  const missing = [];
  const checks = {
    SUPABASE_URL: config.supabase.url,
    SUPABASE_SERVICE_ROLE_KEY: config.supabase.serviceRoleKey,
    STRIPE_SECRET_KEY: config.stripe.secretKey,
    STRIPE_WEBHOOK_SECRET: config.stripe.webhookSecret,
    RESEND_API_KEY: config.email.resendApiKey,
    JWT_SECRET: config.jwtSecret && config.jwtSecret !== "development-only-secret",
  };

  for (const [name, value] of Object.entries(checks)) {
    if (!value) missing.push(name);
  }

  return missing;
}
