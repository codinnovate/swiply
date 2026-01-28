import { Global, Module } from '@nestjs/common';

import { TokenCipher } from './token-cipher.service';

/**
 * Global because token encryption is cross-cutting — social accounts today,
 * API keys and webhook secrets in later build steps.
 */
@Global()
@Module({
  providers: [TokenCipher],
  exports: [TokenCipher],
})
export class CryptoModule {}
