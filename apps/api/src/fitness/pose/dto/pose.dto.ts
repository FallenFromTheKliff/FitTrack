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
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsObject,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
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
export const poseJointNames = ['elbow', 'shoulder', 'hip', 'knee'] as const;
export type PoseJointName = (typeof poseJointNames)[number];

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

  @ApiProperty({ type: String, isArray: true, example: ['Keep your chest up.'] })
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
  @IsString({ each: true, message: 'oscillating_joints entries must be strings' })
  oscillating_joints: string[];
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
  @IsString({ each: true, message: 'oscillating_joints entries must be strings' })
  oscillating_joints: string[];
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
  @ApiProperty({ enum: poseLandmarkSchemaValues, example: 'mediapipe_pose_v1' })
  @IsIn(poseLandmarkSchemaValues, {
    message: `landmark_schema must be one of: ${poseLandmarkSchemaValues.join(', ')}`,
  })
  landmark_schema: PoseLandmarkSchema;

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

  @ApiProperty({ type: PoseSequenceFrameDTO, isArray: true })
  @IsArray({ message: 'frames must be an array' })
  @ArrayMinSize(12, { message: 'frames must contain between 12 and 20 entries' })
  @ArrayMaxSize(20, { message: 'frames must contain between 12 and 20 entries' })
  @ValidateNested({ each: true })
  @Type(() => PoseSequenceFrameDTO)
  frames: PoseSequenceFrameDTO[];

  @ApiProperty({ type: PoseDerivedSignalsDTO })
  @ValidateNested()
  @Type(() => PoseDerivedSignalsDTO)
  signals: PoseDerivedSignalsDTO;
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

  @ApiPropertyOptional({ example: 'knee', nullable: true, enum: poseJointNames })
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
