import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import type { CompetitorNetwork, CompetitorReportData } from '../domain/competitor.types';

/** The latest research run for one competitor handle in a workspace. */
@Schema({ timestamps: true, collection: 'competitorreports' })
export class CompetitorReport {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true }) workspaceId: Types.ObjectId;
  @Prop({ required: true }) network: CompetitorNetwork;
  @Prop({ required: true }) handle: string;
  @Prop({ required: true }) company: string;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) requestedBy: Types.ObjectId | null;
  @Prop({ type: Object, required: true }) report: CompetitorReportData;
  @Prop({ required: true }) fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
export type CompetitorReportDocument = HydratedDocument<CompetitorReport>;
export const CompetitorReportSchema = SchemaFactory.createForClass(CompetitorReport);
CompetitorReportSchema.index({ workspaceId: 1, network: 1, handle: 1 }, { unique: true });
CompetitorReportSchema.index({ workspaceId: 1, updatedAt: -1 });
