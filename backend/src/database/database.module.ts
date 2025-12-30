import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('Mongoose');
        return {
          uri: configService.getOrThrow<string>('database.uri'),
          // Indexes are declared on the schemas (Section 4.18). Building them
          // automatically is right for dev but a foot-gun against a large
          // production collection, so it's opt-in there.
          autoIndex: configService.get<string>('app.nodeEnv') !== 'production',
          serverSelectionTimeoutMS: 10_000,
          onConnectionCreate: (connection) => {
            connection.on('connected', () => logger.log('MongoDB connected'));
            connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
            connection.on('error', (error: Error) =>
              logger.error(`MongoDB error: ${error.message}`),
            );
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
