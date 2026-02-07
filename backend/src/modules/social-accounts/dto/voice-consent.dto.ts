import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Section 7: voice learning is explicit opt-in, asked after the connection
 * completes. Recorded rather than acted on immediately — build step 3 reads it
 * before enqueuing `ingest-voice-samples`.
 */
export class VoiceConsentDto {
  @ApiProperty({
    description: 'Whether Swiply may learn this account’s voice from its recent posts',
  })
  @IsBoolean()
  consent: boolean;
}
