import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
}));

export const databaseConfig = registerAs('database', () => ({
  uri: process.env.MONGODB_URI as string,
}));

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackUrl:
      process.env.GOOGLE_OAUTH_CALLBACK_URL ??
      'http://localhost:3000/api/auth/google/callback',
  },
}));

export const configurations = [appConfig, databaseConfig, authConfig];
