import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoseProfileKind } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsObject,
  IsString,
  Max,
  Min,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

import { TrimString } from '../../../common/validators';
import { PaginationDTO } from '../../../user/dto/user-dto';

export const poseSessionEndReasons = [
  'client_disconnect',
  'manual_stop',
  'session_completed',
] as const;

export type PoseSessionEndReason = (typeof poseSessionEndReasons)[number];
export const poseLandmarkSchemaValues = ['mediapipe_pose_v1'] as const;
export type PoseLandmarkSchema = (typeof poseLandmarkSchemaValues)[number];
export const poseCameraFacingModes = ['user', 'environment'] as const;
export type PoseCameraFacingMode = (typeof poseCameraFacingModes)[number];
export const poseClassificationSources = [
  'preset',
  'classifier',
  'user_confirmed',
] as const;
export type PoseClassificationSource =
  (typeof poseClassificationSources)[number];
export const poseProcessingModes = ['legacy_frame', 'sequence'] as const;
export type PoseProcessingMode = (typeof poseProcessingModes)[number];
export const poseJointNames = ['elbow', 'shoulder', 'hip', 'knee'] as const;
export type PoseJointName = (typeof poseJointNames)[number];
export const poseRepModels = [
  'bilateral',
  'unilateral_left',
  'unilateral_right',
  'alternating',
  'static_hold',
  'unknown',
] as const;
export type PoseRepModel = (typeof poseRepModels)[number];
export const poseRequiredSides = [
  'both',
  'left',
  'right',
  'either',
  'alternating',
] as const;
export type PoseRequiredSides = (typeof poseRequiredSides)[number];
export const poseEquipmentContexts = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'cable',
  'machine',
  'kettlebell',
  'band',
  'bench',
  'mixed',
  'unknown',
] as const;
export type PoseEquipmentContext = (typeof poseEquipmentContexts)[number];
export const poseEquipmentSources = [
  'catalog',
  'plan',
  'member',
  'inferred',
  'provider_api',
  'resolved_hybrid',
] as const;
export type PoseEquipmentSource = (typeof poseEquipmentSources)[number];
export const poseSessionQualityStates = [
  'stable',
  'degraded',
  'invalid',
] as const;
export type PoseSessionQualityState = (typeof poseSessionQualityStates)[number];
export const poseProgressionDispositions = [
  'normal',
  'cautionary',
  'hold_for_review',
] as const;
export type PoseProgressionDisposition =
  (typeof poseProgressionDispositions)[number];

function hasFramePayload(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export class StartPoseSessionDTO {
  @ApiPropertyOptional({ example: 'Barbell Back Squat', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'exercise_hint must be a string' })
  @MaxLength(255, { message: 'exercise_hint must not exceed 255 characters' })
  exercise_hint?: string;
}

export class FinalizePoseSessionDTO {
  @ApiPropertyOptional({
    enum: poseSessionEndReasons,
    example: 'manual_stop',
  })
  @IsOptional()
  @IsIn(poseSessionEndReasons, {
    message: `ended_reason must be one of: ${poseSessionEndReasons.join(', ')}`,
  })
  ended_reason?: PoseSessionEndReason;

  @ApiProperty({ example: 12 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'final_rep_count must be a finite number' },
  )
  @Min(0, { message: 'final_rep_count must be at least 0' })
  final_rep_count: number;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Keep your chest up.'],
  })
  @IsArray({ message: 'form_feedback must be an array' })
  @IsString({ each: true, message: 'form_feedback entries must be strings' })
  form_feedback: string[];

  @ApiPropertyOptional({ example: 'squat', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'detected_exercise_name must be a string' })
  @MaxLength(100, {
    message: 'detected_exercise_name must not exceed 100 characters',
  })
  detected_exercise_name?: string | null;

  @ApiPropertyOptional({ example: 0.91, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'average_confidence must be a finite number' },
  )
  average_confidence?: number | null;

  @ApiProperty({ type: () => PoseRepAngleDataDTO, isArray: true })
  @IsArray({ message: 'raw_angle_data must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PoseRepAngleDataDTO)
  raw_angle_data: PoseRepAngleDataDTO[];

  @ApiPropertyOptional({ type: () => PoseMovementContractDTO, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PoseMovementContractDTO)
  movement_contract?: PoseMovementContractDTO | null;

  @ApiPropertyOptional({
    enum: poseEquipmentContexts,
    example: 'barbell',
    nullable: true,
  })
  @IsOptional()
  @IsIn(poseEquipmentContexts, {
    message: `equipment_context must be one of: ${poseEquipmentContexts.join(', ')}`,
  })
  equipment_context?: PoseEquipmentContext | null;

  @ApiPropertyOptional({
    enum: poseEquipmentSources,
    example: 'member',
    nullable: true,
  })
  @IsOptional()
  @IsIn(poseEquipmentSources, {
    message: `equipment_source must be one of: ${poseEquipmentSources.join(', ')}`,
  })
  equipment_source?: PoseEquipmentSource | null;

  @ApiPropertyOptional({ example: 0.86, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'equipment_confidence must be a finite number' },
  )
  @Min(0, { message: 'equipment_confidence must be at least 0' })
  equipment_confidence?: number | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['declared_inferred_equipment_mismatch'],
  })
  @IsOptional()
  @IsArray({ message: 'equipment_conflicts must be an array' })
  @IsString({
    each: true,
    message: 'equipment_conflicts entries must be strings',
  })
  equipment_conflicts?: string[];

  @ApiPropertyOptional({ example: 40, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 },
    { message: 'weight_input_kg must be a finite number' },
  )
  @Min(0, { message: 'weight_input_kg must be at least 0' })
  @Max(1000, { message: 'weight_input_kg must not exceed 1000' })
  weight_input_kg?: number | null;
}

export class PoseKeypointDTO {
  @ApiProperty({ example: 0.483 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'x must be a finite number' },
  )
  x: number;

  @ApiProperty({ example: 0.271 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'y must be a finite number' },
  )
  y: number;

  @ApiProperty({ example: -0.118 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'z must be a finite number' },
  )
  z: number;

  @ApiProperty({ example: 0.92 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'visibility must be a finite number' },
  )
  visibility: number;
}

export class PoseSequenceFrameDTO {
  @ApiProperty({ example: 1712844369000 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'captured_at_ms must be a finite number' },
  )
  captured_at_ms: number;

  @ApiProperty({ type: PoseKeypointDTO, isArray: true })
  @IsArray({ message: 'keypoints must be an array' })
  @ArrayMinSize(33, { message: 'keypoints must contain exactly 33 entries' })
  @ArrayMaxSize(33, { message: 'keypoints must contain exactly 33 entries' })
  @ValidateNested({ each: true })
  @Type(() => PoseKeypointDTO)
  keypoints: PoseKeypointDTO[];
}

export class PoseAngleSignalEntryDTO {
  @ApiProperty({ example: 1712844369000 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'captured_at_ms must be a finite number' },
  )
  captured_at_ms: number;

  @ApiPropertyOptional({ example: 112.4, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'elbow must be a finite number' },
  )
  elbow?: number | null;

  @ApiPropertyOptional({ example: 144.2, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'shoulder must be a finite number' },
  )
  shoulder?: number | null;

  @ApiPropertyOptional({ example: 96.1, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'hip must be a finite number' },
  )
  hip?: number | null;

  @ApiPropertyOptional({ example: 83.7, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'knee must be a finite number' },
  )
  knee?: number | null;

  @ApiPropertyOptional({ example: 112.4, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'left_elbow must be a finite number' },
  )
  left_elbow?: number | null;

  @ApiPropertyOptional({ example: 113.8, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'right_elbow must be a finite number' },
  )
  right_elbow?: number | null;

  @ApiPropertyOptional({ example: 144.2, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'left_shoulder must be a finite number' },
  )
  left_shoulder?: number | null;

  @ApiPropertyOptional({ example: 145.6, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'right_shoulder must be a finite number' },
  )
  right_shoulder?: number | null;

  @ApiPropertyOptional({ example: 96.1, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'left_hip must be a finite number' },
  )
  left_hip?: number | null;

  @ApiPropertyOptional({ example: 97.4, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'right_hip must be a finite number' },
  )
  right_hip?: number | null;

  @ApiPropertyOptional({ example: 83.7, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'left_knee must be a finite number' },
  )
  left_knee?: number | null;

  @ApiPropertyOptional({ example: 84.9, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'right_knee must be a finite number' },
  )
  right_knee?: number | null;
}

export class PoseOrientationVectorDTO {
  @ApiProperty({ example: 0.02 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'x must be a finite number' },
  )
  x: number;

  @ApiProperty({ example: 0.88 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'y must be a finite number' },
  )
  y: number;
}

export class PoseOrientationSignalDTO {
  @ApiProperty({ example: 'upright' })
  @IsString({ message: 'body_orientation must be a string' })
  body_orientation: string;

  @ApiProperty({ example: 82.4 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'torso_slope_deg must be a finite number' },
  )
  torso_slope_deg: number;

  @ApiProperty({ type: PoseOrientationVectorDTO })
  @ValidateNested()
  @Type(() => PoseOrientationVectorDTO)
  vector: PoseOrientationVectorDTO;
}

export class PoseVisibilitySignalDTO {
  @ApiProperty({ example: 0.82 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'average_visibility must be a finite number' },
  )
  average_visibility: number;

  @ApiProperty({ example: 0.73 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'feet_visibility must be a finite number' },
  )
  feet_visibility: number;

  @ApiProperty({ type: String, isArray: true, example: ['left_wrist'] })
  @IsArray({ message: 'low_confidence_landmarks must be an array' })
  @IsString({
    each: true,
    message: 'low_confidence_landmarks entries must be strings',
  })
  low_confidence_landmarks: string[];

  @ApiProperty({ example: 15 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'reliable_frame_count must be a finite number' },
  )
  reliable_frame_count: number;

  @ApiProperty({ example: 0.77 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'wrist_visibility must be a finite number' },
  )
  wrist_visibility: number;

  @ApiPropertyOptional({ example: 0.79, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'left_arm_visibility must be a finite number' },
  )
  left_arm_visibility?: number | null;

  @ApiPropertyOptional({ example: 0.81, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'right_arm_visibility must be a finite number' },
  )
  right_arm_visibility?: number | null;
}

export class PoseHipSignalDTO {
  @ApiProperty({ example: 0.58 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'average_y must be a finite number' },
  )
  average_y: number;

  @ApiProperty({ example: 0.04 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'range_y must be a finite number' },
  )
  range_y: number;

  @ApiPropertyOptional({ example: 0.012, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'range_x must be a finite number' },
  )
  range_x?: number | null;

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'stable must be a boolean' })
  stable: boolean;
}

export class PoseTemporalMovementSignalDTO {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { elbow: 42.1, knee: 18.2 },
  })
  @IsObject({ message: 'amplitudes must be an object' })
  amplitudes: Record<string, number>;

  @ApiProperty({ type: String, isArray: true, example: ['elbow', 'knee'] })
  @IsArray({ message: 'oscillating_joints must be an array' })
  @IsString({
    each: true,
    message: 'oscillating_joints entries must be strings',
  })
  oscillating_joints: string[];

  @ApiPropertyOptional({ example: 180, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'phase_sync_ms must be a finite number' },
  )
  phase_sync_ms?: number | null;
}

export class PoseDerivedSignalsDTO {
  @ApiProperty({ type: PoseAngleSignalEntryDTO, isArray: true })
  @IsArray({ message: 'angles must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PoseAngleSignalEntryDTO)
  angles: PoseAngleSignalEntryDTO[];

  @ApiProperty({ type: PoseOrientationSignalDTO })
  @ValidateNested()
  @Type(() => PoseOrientationSignalDTO)
  orientation: PoseOrientationSignalDTO;

  @ApiProperty({ type: PoseVisibilitySignalDTO })
  @ValidateNested()
  @Type(() => PoseVisibilitySignalDTO)
  visibility: PoseVisibilitySignalDTO;

  @ApiProperty({ type: PoseHipSignalDTO })
  @ValidateNested()
  @Type(() => PoseHipSignalDTO)
  hip: PoseHipSignalDTO;

  @ApiProperty({ type: PoseTemporalMovementSignalDTO })
  @ValidateNested()
  @Type(() => PoseTemporalMovementSignalDTO)
  temporal: PoseTemporalMovementSignalDTO;
}

export class PoseRepThresholdDTO {
  @ApiProperty({ example: 88 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'angle must be a finite number' },
  )
  angle: number;

  @ApiProperty({ example: 12 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'tolerance must be a finite number' },
  )
  tolerance: number;
}

export class PoseRepThresholdPairDTO {
  @ApiProperty({ type: PoseRepThresholdDTO })
  @ValidateNested()
  @Type(() => PoseRepThresholdDTO)
  down: PoseRepThresholdDTO;

  @ApiProperty({ type: PoseRepThresholdDTO })
  @ValidateNested()
  @Type(() => PoseRepThresholdDTO)
  up: PoseRepThresholdDTO;
}

export class PoseSpatialRequirementsDTO {
  @ApiPropertyOptional({ example: 0.012, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'body_y_travel_min must be a finite number' },
  )
  body_y_travel_min?: number | null;

  @ApiPropertyOptional({ example: 0.01, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'hip_y_travel_min must be a finite number' },
  )
  hip_y_travel_min?: number | null;

  @ApiPropertyOptional({ example: 0.008, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'shoulder_y_travel_min must be a finite number' },
  )
  shoulder_y_travel_min?: number | null;

  @ApiPropertyOptional({ example: 0.01, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'shoulder_hip_travel_min must be a finite number' },
  )
  shoulder_hip_travel_min?: number | null;

  @ApiPropertyOptional({ example: 0.05, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'body_x_drift_max must be a finite number' },
  )
  body_x_drift_max?: number | null;

  @ApiPropertyOptional({ example: 0.18, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'wrist_anchor_drift_max must be a finite number' },
  )
  wrist_anchor_drift_max?: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'torso_slope_min_deg must be a finite number' },
  )
  torso_slope_min_deg?: number | null;

  @ApiPropertyOptional({ example: 92, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'torso_slope_max_deg must be a finite number' },
  )
  torso_slope_max_deg?: number | null;

  @ApiPropertyOptional({ example: 0.08, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'body_line_tolerance must be a finite number' },
  )
  body_line_tolerance?: number | null;

  @ApiPropertyOptional({ example: 0.18, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'left_right_symmetry_tolerance must be a finite number' },
  )
  left_right_symmetry_tolerance?: number | null;

  @ApiPropertyOptional({ example: 450, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'phase_sync_tolerance_ms must be a finite number' },
  )
  phase_sync_tolerance_ms?: number | null;
}

export class PoseMovementContractDTO {
  @ApiProperty({ example: 'squat' })
  @IsString({ message: 'exercise must be a string' })
  exercise: string;

  @ApiProperty({ enum: poseJointNames, example: 'knee' })
  @IsIn(poseJointNames, {
    message: `dominant_joint must be one of: ${poseJointNames.join(', ')}`,
  })
  dominant_joint: PoseJointName;

  @ApiProperty({
    type: () => PoseRepThresholdPairDTO,
    example: {
      down: { angle: 88, tolerance: 12 },
      up: { angle: 166, tolerance: 10 },
    },
  })
  @ValidateNested()
  @Type(() => PoseRepThresholdPairDTO)
  rep_thresholds: PoseRepThresholdPairDTO;

  @ApiProperty({ example: 'hip_depth' })
  @IsString({ message: 'secondary_check must be a string' })
  secondary_check: string;

  @ApiProperty({ type: String, isArray: true, example: ['hip', 'knee'] })
  @IsArray({ message: 'oscillating_joints must be an array' })
  @IsString({
    each: true,
    message: 'oscillating_joints entries must be strings',
  })
  oscillating_joints: string[];

  @ApiPropertyOptional({ enum: poseRepModels, example: 'bilateral' })
  @IsOptional()
  @IsIn(poseRepModels, {
    message: `rep_model must be one of: ${poseRepModels.join(', ')}`,
  })
  rep_model?: PoseRepModel;

  @ApiPropertyOptional({ enum: poseRequiredSides, example: 'both' })
  @IsOptional()
  @IsIn(poseRequiredSides, {
    message: `required_sides must be one of: ${poseRequiredSides.join(', ')}`,
  })
  required_sides?: PoseRequiredSides;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['left_elbow', 'right_elbow'],
  })
  @IsOptional()
  @IsArray({ message: 'primary_joints must be an array' })
  @IsString({
    each: true,
    message: 'primary_joints entries must be strings',
  })
  primary_joints?: string[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['left_shoulder', 'right_shoulder', 'hip'],
  })
  @IsOptional()
  @IsArray({ message: 'secondary_joints must be an array' })
  @IsString({
    each: true,
    message: 'secondary_joints entries must be strings',
  })
  secondary_joints?: string[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['setup', 'eccentric', 'bottom', 'concentric', 'lockout'],
  })
  @IsOptional()
  @IsArray({ message: 'phase_order must be an array' })
  @IsString({ each: true, message: 'phase_order entries must be strings' })
  phase_order?: string[];

  @ApiPropertyOptional({ type: () => PoseSpatialRequirementsDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => PoseSpatialRequirementsDTO)
  spatial_requirements?: PoseSpatialRequirementsDTO | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['one_arm_only', 'body_y_travel_below_min'],
  })
  @IsOptional()
  @IsArray({ message: 'no_count_conditions must be an array' })
  @IsString({
    each: true,
    message: 'no_count_conditions entries must be strings',
  })
  no_count_conditions?: string[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['occluded_side', 'low_lock_confidence'],
  })
  @IsOptional()
  @IsArray({ message: 'degraded_conditions must be an array' })
  @IsString({
    each: true,
    message: 'degraded_conditions entries must be strings',
  })
  degraded_conditions?: string[];
}

export class PoseRepAngleDataDTO {
  @ApiProperty({ example: 1 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'rep_number must be a finite number' },
  )
  @Min(1, { message: 'rep_number must be at least 1' })
  rep_number: number;

  @ApiProperty({ enum: poseJointNames, example: 'knee' })
  @IsIn(poseJointNames, {
    message: `dominant_joint must be one of: ${poseJointNames.join(', ')}`,
  })
  dominant_joint: PoseJointName;

  @ApiProperty({ example: 83.7 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'low_angle must be a finite number' },
  )
  low_angle: number;

  @ApiProperty({ example: 167.4 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'high_angle must be a finite number' },
  )
  high_angle: number;

  @ApiProperty({ example: 1712844369000 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 },
    { message: 'timestamp must be a finite number' },
  )
  timestamp: number;
}

export class AnalyzePoseSequenceDTO {
  @ApiPropertyOptional({
    enum: poseLandmarkSchemaValues,
    example: 'mediapipe_pose_v1',
  })
  @ValidateIf(
    (object: AnalyzePoseSequenceDTO) => !hasFramePayload(object.frame_b64),
  )
  @IsIn(poseLandmarkSchemaValues, {
    message: `landmark_schema must be one of: ${poseLandmarkSchemaValues.join(', ')}`,
  })
  landmark_schema?: PoseLandmarkSchema;

  @ApiPropertyOptional({
    enum: poseCameraFacingModes,
    example: 'user',
    nullable: true,
  })
  @IsOptional()
  @IsIn(poseCameraFacingModes, {
    message: `camera_facing_mode must be one of: ${poseCameraFacingModes.join(', ')}`,
  })
  camera_facing_mode?: PoseCameraFacingMode;

  @ApiPropertyOptional({ example: 'Barbell Back Squat', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'exercise_hint must be a string' })
  @MaxLength(255, { message: 'exercise_hint must not exceed 255 characters' })
  exercise_hint?: string | null;

  @ApiPropertyOptional({ example: 'base64-frame-payload', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'frame_b64 must be a string' })
  frame_b64?: string | null;

  @ApiPropertyOptional({ type: PoseSequenceFrameDTO, isArray: true })
  @ValidateIf(
    (object: AnalyzePoseSequenceDTO) => !hasFramePayload(object.frame_b64),
  )
  @IsArray({ message: 'frames must be an array' })
  @ArrayMinSize(12, {
    message: 'frames must contain between 12 and 20 entries',
  })
  @ArrayMaxSize(20, {
    message: 'frames must contain between 12 and 20 entries',
  })
  @ValidateNested({ each: true })
  @Type(() => PoseSequenceFrameDTO)
  frames?: PoseSequenceFrameDTO[];

  @ApiPropertyOptional({ type: PoseDerivedSignalsDTO })
  @ValidateIf(
    (object: AnalyzePoseSequenceDTO) => !hasFramePayload(object.frame_b64),
  )
  @ValidateNested()
  @Type(() => PoseDerivedSignalsDTO)
  signals?: PoseDerivedSignalsDTO;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'subject_locked must be a boolean' })
  subject_locked?: boolean | null;

  @ApiPropertyOptional({ example: 0.92, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'subject_lock_confidence must be a finite number' },
  )
  @Min(0, { message: 'subject_lock_confidence must be at least 0' })
  subject_lock_confidence?: number | null;

  @ApiPropertyOptional({
    enum: poseEquipmentContexts,
    example: 'bodyweight',
    nullable: true,
  })
  @IsOptional()
  @IsIn(poseEquipmentContexts, {
    message: `equipment_context must be one of: ${poseEquipmentContexts.join(', ')}`,
  })
  equipment_context?: PoseEquipmentContext | null;

  @ApiPropertyOptional({
    enum: poseEquipmentSources,
    example: 'catalog',
    nullable: true,
  })
  @IsOptional()
  @IsIn(poseEquipmentSources, {
    message: `equipment_source must be one of: ${poseEquipmentSources.join(', ')}`,
  })
  equipment_source?: PoseEquipmentSource | null;

  @ApiPropertyOptional({ example: 0.72, nullable: true })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 },
    { message: 'equipment_confidence must be a finite number' },
  )
  @Min(0, { message: 'equipment_confidence must be at least 0' })
  equipment_confidence?: number | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['declared_inferred_equipment_mismatch'],
  })
  @IsOptional()
  @IsArray({ message: 'equipment_conflicts must be an array' })
  @IsString({
    each: true,
    message: 'equipment_conflicts entries must be strings',
  })
  equipment_conflicts?: string[];
}

export class DetectPoseEquipmentDTO {
  @ApiProperty({ example: 'base64-frame-payload' })
  @TrimString()
  @IsString({ message: 'frame_b64 must be a string' })
  frame_b64: string;

  @ApiPropertyOptional({
    enum: poseCameraFacingModes,
    example: 'user',
    nullable: true,
  })
  @IsOptional()
  @IsIn(poseCameraFacingModes, {
    message: `camera_facing_mode must be one of: ${poseCameraFacingModes.join(', ')}`,
  })
  camera_facing_mode?: PoseCameraFacingMode;

  @ApiPropertyOptional({ example: 'Dumbbell Bicep Curl', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'exercise_hint must be a string' })
  @MaxLength(255, { message: 'exercise_hint must not exceed 255 characters' })
  exercise_hint?: string | null;
}

export class PoseEquipmentDetectionResponseDTO {
  @ApiProperty({
    example: [
      {
        confidence: 0.81,
        height: 0.18,
        label: 'dumbbell',
        width: 0.24,
        x: 0.38,
        y: 0.56,
      },
    ],
    isArray: true,
  })
  equipment_detections: Array<{
    confidence: number | null;
    height: number | null;
    label: string | null;
    width: number | null;
    x: number | null;
    y: number | null;
  }>;

  @ApiPropertyOptional({
    enum: poseEquipmentContexts,
    example: 'dumbbell',
    nullable: true,
  })
  equipment_context: PoseEquipmentContext | null;

  @ApiPropertyOptional({
    enum: poseEquipmentSources,
    example: 'provider_api',
    nullable: true,
  })
  equipment_source: PoseEquipmentSource | null;

  @ApiPropertyOptional({ example: 0.81, nullable: true })
  equipment_confidence: number | null;

  @ApiProperty({
    type: String,
    isArray: true,
    example: [],
  })
  equipment_conflicts: string[];

  @ApiProperty({ example: true })
  provider_enabled: boolean;
}

export class PoseSessionBootstrapResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  pose_session_id: string;

  @ApiProperty({ example: 15 })
  accepted_fps: number;
}

export class PoseFrameAnalysisResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  pose_session_id: string;

  @ApiProperty({ example: 0.93 })
  confidence: number;

  @ApiPropertyOptional({ example: 'squat', nullable: true })
  exercise_class: string | null;

  @ApiPropertyOptional({
    example: '66666666-6666-4666-8666-666666666666',
    nullable: true,
  })
  matched_profile_id: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  subject_locked: boolean | null;

  @ApiPropertyOptional({ example: 0.88, nullable: true })
  subject_lock_confidence: number | null;

  @ApiProperty({
    enum: poseClassificationSources,
    example: 'preset',
  })
  classification_source: PoseClassificationSource;

  @ApiProperty({ example: false })
  needs_confirmation: boolean;

  @ApiProperty({
    enum: poseProcessingModes,
    example: 'sequence',
  })
  processing_mode: PoseProcessingMode;

  @ApiProperty({ example: false })
  rep_event: boolean;

  @ApiProperty({ example: 0 })
  rep_count_delta: number;

  @ApiPropertyOptional({ example: 'rising', nullable: true })
  phase: string | null;

  @ApiPropertyOptional({
    type: PoseKeypointDTO,
    isArray: true,
    nullable: true,
  })
  keypoints?: PoseKeypointDTO[] | null;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['push_up', 'bench_press'],
  })
  candidate_exercises: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Drive through your heels.'],
  })
  form_feedback: string[];

  @ApiPropertyOptional({
    type: PoseMovementContractDTO,
    nullable: true,
  })
  movement_contract: PoseMovementContractDTO | null;

  @ApiProperty({ enum: poseSessionQualityStates, example: 'stable' })
  session_quality_state: PoseSessionQualityState;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['low_reliable_frame_ratio'],
  })
  session_quality_reasons: string[];

  @ApiPropertyOptional({ example: 0.82, nullable: true })
  reliable_frame_ratio: number | null;

  @ApiProperty({ enum: poseProgressionDispositions, example: 'normal' })
  progression_disposition: PoseProgressionDisposition;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['weak_subject_lock'],
  })
  integrity_reason_codes: string[];

  @ApiProperty({ example: false })
  review_recommended: boolean;

  @ApiPropertyOptional({
    enum: poseEquipmentContexts,
    example: 'dumbbell',
    nullable: true,
  })
  equipment_context: PoseEquipmentContext | null;

  @ApiPropertyOptional({
    enum: poseEquipmentSources,
    example: 'resolved_hybrid',
    nullable: true,
  })
  equipment_source: PoseEquipmentSource | null;

  @ApiPropertyOptional({ example: 0.78, nullable: true })
  equipment_confidence: number | null;

  @ApiProperty({
    type: String,
    isArray: true,
    example: [],
  })
  equipment_conflicts: string[];
}

export class PoseProfileFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'squat' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'canonical_name must be a string' })
  @MaxLength(100, {
    message: 'canonical_name must not exceed 100 characters',
  })
  canonical_name?: string;

  @ApiPropertyOptional({ enum: PoseProfileKind, example: PoseProfileKind.seed })
  @IsOptional()
  @IsEnum(PoseProfileKind, {
    message: `profile_kind must be one of: ${Object.values(PoseProfileKind).join(', ')}`,
  })
  profile_kind?: PoseProfileKind;
}

export class PoseSessionResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  user_id: string;

  @ApiPropertyOptional({
    example: '44444444-4444-4444-8444-444444444444',
    nullable: true,
  })
  exercise_log_id: string | null;

  @ApiPropertyOptional({ example: 'Barbell Back Squat', nullable: true })
  exercise_hint: string | null;

  @ApiProperty({ example: 12 })
  rep_count_ai: number;

  @ApiPropertyOptional({ example: '0.925', nullable: true })
  confidence_avg: string | null;

  @ApiPropertyOptional({ example: 'squat', nullable: true })
  detected_exercise_name: string | null;

  @ApiPropertyOptional({
    example: '55555555-5555-4555-8555-555555555555',
    nullable: true,
  })
  detected_profile_id: string | null;

  @ApiPropertyOptional({ example: '0.944', nullable: true })
  classification_confidence: string | null;

  @ApiPropertyOptional({ example: '0.887', nullable: true })
  subject_lock_confidence: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      final_rep_count: 12,
      form_feedback: ['Keep your knees tracking over your toes.'],
    },
  })
  analysis_summary: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-03-27T08:00:00.000Z' })
  started_at: string;

  @ApiPropertyOptional({
    example: '2026-03-27T08:03:00.000Z',
    nullable: true,
  })
  ended_at: string | null;

  @ApiProperty({ example: '2026-03-27T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T08:03:00.000Z' })
  updated_at: string;
}

export class PoseProfileResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
  })
  exercise_id: string | null;

  @ApiPropertyOptional({ example: 'Barbell Back Squat', nullable: true })
  exercise_name: string | null;

  @ApiProperty({ example: 'squat' })
  canonical_name: string;

  @ApiProperty({ enum: PoseProfileKind, example: PoseProfileKind.seed })
  profile_kind: PoseProfileKind;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { left_shoulder: [0.1, 0.3], right_shoulder: [0.9, 0.3] },
  })
  landmark_signature: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { hip_knee_ankle: 92.4 },
  })
  angle_signature: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { rep_start_angle: 88, rep_end_angle: 172 },
  })
  rep_rules: Record<string, unknown> | null;

  @ApiPropertyOptional({
    example: 'knee',
    nullable: true,
    enum: poseJointNames,
  })
  dominant_joint: PoseJointName | null;

  @ApiPropertyOptional({ example: '12.000', nullable: true })
  tolerance: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      down: { angle: 88, tolerance: 12 },
      up: { angle: 166, tolerance: 10 },
    },
  })
  rep_thresholds: Record<string, unknown> | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      body_orientation: 'upright',
      torso_slope_range: [78.2, 95.1],
      nose_to_hip_vector: { x: 0.02, y: 0.88 },
    },
  })
  orientation_signature: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      tracked_joint: 'hip_knee_ankle',
      oscillating_landmarks: ['left_hip', 'right_hip'],
      stable_landmarks: ['left_ankle', 'right_ankle'],
    },
  })
  movement_pattern: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      min_visibility: 0.5,
      required_landmarks: ['left_shoulder', 'right_shoulder'],
    },
  })
  visibility_pattern: Record<string, unknown>;

  @ApiProperty({ example: 14 })
  sample_count: number;

  @ApiPropertyOptional({ example: '0.850', nullable: true })
  confidence_threshold: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T08:03:00.000Z' })
  updated_at: string;
}
