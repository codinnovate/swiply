import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PushEnvironment = 'sandbox' | 'production';

/** One POSTLOCK install's APNs token, tied to the username it plays duels as. */
@Schema({ timestamps: true, collection: 'postlock_push_devices' })
export class PushDevice {
  @Prop({ required: true, unique: true }) installId: string;
  @Prop({ required: true, lowercase: true, index: true }) username: string;
  @Prop({ required: true, unique: true }) token: string;
  @Prop({ type: String, enum: ['sandbox', 'production'], required: true })
  environment: PushEnvironment;
  createdAt: Date;
  updatedAt: Date;
}
export type PushDeviceDocument = HydratedDocument<PushDevice>;
export const PushDeviceSchema = SchemaFactory.createForClass(PushDevice);
