import 'dotenv/config';

const prod = process.env.NODE_ENV === 'production';
const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing required env var ${k}`); process.exit(1); }
  return v;
};

export const config = {
  prod,
  port: Number(process.env.PORT) || 5000,
  mongoUri: need('MONGO_URI'),
  jwtSecret: need('JWT_SECRET'),
  clientUrl: process.env.CLIENT_URL || '',
  appUrl: process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173', // used in emailed links
};
if (prod && (config.jwtSecret.length < 32 || /change-me/i.test(config.jwtSecret))) {
  console.error('JWT_SECRET must be a random string of at least 32 characters in production');
  process.exit(1);
}
process.env.JWT_SECRET = config.jwtSecret;
