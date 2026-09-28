import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { ExerciseService } from '../exercise/exercise.service';
import { ExerciseRepository } from '../exercise/exercise.repository';
import { PoseService } from './pose.service';
import { PoseMovementContractDTO } from './dto/pose.dto';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WorkoutSessionService } from '../session/session.service';
import { createFitnessApi } from '../../../../../packages/api-client/domains/fitness';
import { buildFallbackPoseMovementContract } from '../../../../../packages/utils/pose';
import { createExerciseMovementProfile, createGeneratedExerciseRigFromMovementContract } from '../../../../../packages/utils/exercise-editor';

function fixture() {
  const now = new Date();
  const contract = buildFallbackPoseMovementContract('bench_press')!;
  const family: any = { id: 'family', key: 'bench_press', display_name: 'Bench press', canonical_exercise_id: 'exercise',
    contract_revision: 3, is_active: true, exercises: [{id: 'exercise', name: 'Bench', tracking_mode: 'inherit'}],
    base_movement_profile: createExerciseMovementProfile({ movementContract: contract }), base_hand_shape_profile: null };
  const record: any = { id: 'exercise', name: 'Renamed Bench Presss', tracking_mode: 'inherit', is_active: true,
    movement_family_id: family.id, movement_family: family, movement_profile: null, movement_profile_override: null,
    hand_shape_profile: null, aliases: [], muscle_group: 'chest', muscle_targets: [], category: 'strength',
    created_at: now, updated_at: now };
  const exerciseRepo = { findActiveExerciseByIdOrThrow: jest.fn(async () => record),
    findMovementFamilyById: jest.fn(async () => family), ensureAliasesAvailable: jest.fn(),
    updateExercise: jest.fn(async (_id, data, _aliases, shared) => {
      if (shared) { family.contract_revision++; family.base_movement_profile = shared.profile; }
      Object.assign(record, data); return record;
    }),
  };
  const exerciseService = new ExerciseService(exerciseRepo as any, {} as any);
  let pose: any;
  const poseRepo = {
    findPlannedTrackingTarget: jest.fn(async () => ({id: 'slot', sets: 3, reps: 9, duration_seconds: null as number | null})),
    createPoseSession: jest.fn(async input => {
      pose = { id: 'pose', user_id: 'user', exercise_hint: input.exerciseHint, analysis_summary: structuredClone(input.analysisSummary),
        rep_count_ai: 0, confidence_avg: null, detected_exercise_name: null, detected_profile_id: null,
        classification_confidence: null, subject_lock_confidence: null, exercise_log_id: null, exercise_log: null,
        started_at: now, created_at: now, updated_at: now, ended_at: null };
      return pose;
    }),
    findPoseSessionByIdOrThrow: jest.fn(async () => pose),
    finalizePoseSession: jest.fn(async input => {
      pose = { ...pose, ended_at: input.endedAt, rep_count_ai: input.repCountAi, analysis_summary: input.analysisSummary,
        detected_exercise_name: input.detectedExerciseName }; return pose;
    }),
    getNextPoseSourceRevision: jest.fn(async () => 1),
  };
  const ai = { bootstrapPoseSession: jest.fn(() => { throw new Error('AI offline'); }) };
  const poseService = new PoseService(poseRepo as any, {} as any, { get: (_k, fallback) => fallback } as any,
    ai as any, {emit: jest.fn()} as any, exerciseService, {} as any);
  const api = createFitnessApi({
    post: async (_url, body) => ({data: await poseService.startPoseSessionForUser('user', body as any)}),
  } as any);
  const start = () => api.startPoseSession({exerciseId: 'exercise', workoutSessionId: 'workout', planExerciseId: 'slot',
    setNumber: 1, runtime: 'web'});
  return {now, family, record, exerciseRepo, exerciseService, poseRepo, poseService, ai, start, pose: () => pose};
}

describe('saved definition to set tracking', () => {
  it('atomically submits canonical details, aliases and a validated shared revision', async () => {
    const f = fixture();
    const profile = createExerciseMovementProfile({ movementContract: f.family.base_movement_profile.movementContract,
      rig: createGeneratedExerciseRigFromMovementContract({ movementContract: f.family.base_movement_profile.movementContract }) });
    profile.movementContract!.countAt = 'peak';
    const saved = await f.exerciseService.updateExercise('exercise', {name: 'Renamed Again', aliases: ['Bench alias'],
      shared_movement_update: { family_id: 'family', expected_revision: 3, movement_profile: profile }});
    expect(saved.name).toBe('Renamed Again');
    expect((await f.exerciseService.getExerciseById('exercise')).movement_profile?.movementContract?.countAt).toBe('peak');
    expect(saved.movement_family?.contract_revision).toBe(4);
    expect(f.exerciseRepo.updateExercise).toHaveBeenCalledWith('exercise', expect.objectContaining({name: 'Renamed Again'}),
      expect.any(Array), expect.objectContaining({familyId: 'family', expectedRevision: 3}));
    await expect(f.exerciseService.updateExercise('exercise', {name: 'Must not save',
      shared_movement_update: {family_id: 'family', expected_revision: 3, movement_profile: profile}})).rejects.toBeInstanceOf(ConflictException);
    expect(f.record.name).toBe('Renamed Again');
  });

  it('fetches by ID, starts without AI, keeps the original snapshot after edits, and finalizes through the client mapper', async () => {
    const f = fixture();
    f.family.base_movement_profile.movementContract.countAt = 'peak';
    const started = await f.start();
    const snapshot = started.trackingSnapshot!;
    expect(snapshot.movementProfile.movementContract?.countAt).toBe('peak');
    expect(snapshot.exerciseId).toBe('exercise');
    expect(snapshot.targetReps).toBe(9);
    expect(snapshot.targetDurationSeconds).toBeNull();
    expect(snapshot.movementProfile.rig?.referenceVersion).toBe(2);
    expect(snapshot.movementProfile.rig?.keyframes).toHaveLength(3);
    expect(f.family.base_movement_profile.rig).toBeNull();
    expect(snapshot.movementProfile.movementContract?.trackingRequirements?.minReliableFrameLandmarks).toBe(8);
    expect(f.ai.bootstrapPoseSession).not.toHaveBeenCalled();
    f.family.base_movement_profile.movementContract.repThresholds.down.angle = 120;
    f.family.base_movement_profile.movementContract.countAt = 'return';
    f.family.contract_revision = 4;
    const api = createFitnessApi({
      post: async (_url, payload) => ({data: await f.poseService.finalizePoseSessionById('user','pose',payload as any)}),
    } as any);
    const result = await api.finalizePoseSession('pose', {finalRepCount: 2, formFeedback: [], rawAngleData: [],
      movementContract: snapshot.movementProfile.movementContract, endedReason: 'session_completed'});
    expect(result.repCountAi).toBe(2);
    expect(f.pose().analysis_summary.tracking_snapshot.identity.revision).toBe(3);
    expect(f.pose().analysis_summary.movement_contract.spatial_requirements.body_line_scope).toBe('torso');
    expect(f.pose().analysis_summary.movement_contract.count_at).toBe('peak');
    const next = await f.start();
    expect(next.trackingSnapshot?.identity.revision).toBe(4);
    expect(next.trackingSnapshot?.movementProfile.movementContract?.countAt).toBe('return');
  });

  it('preserves an arms-only reference through exercise save, client snapshot and finalization', async () => {
    const f = fixture();
    f.family.key = 'lat_pulldown';
    const contract = buildFallbackPoseMovementContract('lat_pulldown', { forAuthoring: true })!;
    const profile = createExerciseMovementProfile({ movementContract: contract,
      rig: createGeneratedExerciseRigFromMovementContract({ movementContract: contract }) });
    await f.exerciseService.updateExercise('exercise', {
      shared_movement_update: {family_id: 'family', expected_revision: 3, movement_profile: profile},
    });
    expect((await f.exerciseService.getExerciseById('exercise')).movement_profile?.movementContract?.shoulderReference).toBe('shoulder_line');
    const snapshot = (await f.start()).trackingSnapshot!;
    expect(snapshot.movementProfile.movementContract?.shoulderReference).toBe('shoulder_line');
    expect(snapshot.movementProfile.movementContract?.trackingRequirements?.minReliableFrameLandmarks).toBe(4);
    const api = createFitnessApi({post: async (_url, payload) => ({data:
      await f.poseService.finalizePoseSessionById('user', 'pose', payload as any)})} as any);
    await expect(api.finalizePoseSession('pose', {finalRepCount: 1, formFeedback: [], rawAngleData: [],
      movementContract: {...snapshot.movementProfile.movementContract!, shoulderReference: 'torso'},
    })).rejects.toThrow('Tracking rules do not match');
    expect(f.poseRepo.finalizePoseSession).not.toHaveBeenCalled();
    const result = await api.finalizePoseSession('pose', {finalRepCount: 1, formFeedback: [], rawAngleData: [],
      movementContract: snapshot.movementProfile.movementContract,
    });
    expect(result.repCountAi).toBe(1);
    expect(f.pose().analysis_summary.movement_contract.shoulder_reference).toBe('shoulder_line');
    for (const shoulder_reference of ['torso', 'shoulder_line', undefined, 'unknown']) {
      const errors = validateSync(plainToInstance(PoseMovementContractDTO, {shoulder_reference}));
      expect(errors.some(error => error.property === 'shoulder_reference')).toBe(shoulder_reference === 'unknown');
    }
  });

  it('enables a manual exercise with its own drawing, then loads those saved settings for mobile', async () => {
    const f = fixture();
    Object.assign(f.record, {name: 'Lat Pulldown', tracking_mode: 'manual', movement_family_id: null, movement_family: null});
    const contract = buildFallbackPoseMovementContract('lat_pulldown', {forAuthoring: true})!;
    contract.countAt = 'peak';
    const profile = createExerciseMovementProfile({movementContract: contract,
      rig: createGeneratedExerciseRigFromMovementContract({movementContract: contract})});
    const saved = await f.exerciseService.updateExercise('exercise', {tracking_mode: 'override', movement_profile_override: profile});
    expect(saved.movement_contract_identity).toMatchObject({familyKey: null, revision: null, source: 'exercise_override'});
    expect(saved.movement_profile?.movementContract?.shoulderReference).toBe('shoulder_line');
    const snapshot = (await f.start()).trackingSnapshot!;
    expect(snapshot.identity.source).toBe('exercise_override');
    expect(snapshot.identity.familyKey).toBeNull();
    expect(snapshot.movementProfile.movementContract?.shoulderReference).toBe('shoulder_line');
    expect(snapshot.movementProfile.movementContract?.countAt).toBe('peak');
    expect(snapshot.movementProfile.movementContract?.trackingRequirements?.minReliableFrameLandmarks).toBe(4);
    expect(snapshot.movementProfile.rig).toEqual(profile.rig);
    expect(f.exerciseRepo.findMovementFamilyById).not.toHaveBeenCalled();
    expect(f.ai.bootstrapPoseSession).not.toHaveBeenCalled();
  });

  it('rejects incomplete binding, invalid slots, manual mode, and changed rules without saving', async () => {
    const f = fixture();
    await expect(f.poseService.startPoseSessionForUser('user', {exercise_id: 'exercise'})).rejects.toBeInstanceOf(BadRequestException);
    f.poseRepo.findPlannedTrackingTarget.mockResolvedValueOnce(null as any);
    await expect(f.start()).rejects.toThrow();
    f.record.tracking_mode = 'manual';
    await expect(f.start()).rejects.toThrow();
    f.record.tracking_mode = 'inherit';
    const started = await f.start();
    const changed = structuredClone(started.trackingSnapshot!.movementProfile.movementContract)!;
    changed.repThresholds.down.angle += 2;
    const api = createFitnessApi({post: async (_url, payload) =>
      ({data: await f.poseService.finalizePoseSessionById('user', 'pose', payload as any)})} as any);
    await expect(api.finalizePoseSession('pose', { finalRepCount: 1, rawAngleData: [], formFeedback: [], movementContract: changed }))
      .rejects.toThrow();
    const changedTiming = { ...started.trackingSnapshot!.movementProfile.movementContract!, countAt: 'peak' as const };
    await expect(api.finalizePoseSession('pose', {finalRepCount: 1, rawAngleData: [], formFeedback: [], movementContract: changedTiming}))
      .rejects.toThrow('Tracking rules do not match');
    expect(f.poseRepo.finalizePoseSession).not.toHaveBeenCalled();
  });

  it('uses contract hold type and plan duration rather than a rep/name heuristic', async () => {
    const f = fixture();
    f.family.key = 'plank';
    f.family.base_movement_profile = createExerciseMovementProfile({movementContract: buildFallbackPoseMovementContract('plank')!});
    f.poseRepo.findPlannedTrackingTarget.mockResolvedValue({id:'slot',sets:3,reps:9,duration_seconds:20});
    const snapshot = (await f.start()).trackingSnapshot!;
    expect(snapshot.movementProfile.movementContract?.holdDurationSeconds).toBe(20);
    expect(snapshot.targetReps).toBe(0);
    expect(snapshot.targetDurationSeconds).toBe(20);
  });

  it('uses family hand rules when the exercise has none and rejects contradictory API writes', async () => {
    const f = fixture();
    const hands = {grip: {required: true, minUsableFrames: 2, recentFrameLimit: 4}};
    f.family.base_hand_shape_profile = hands;
    expect((await f.exerciseService.getExerciseById('exercise')).hand_shape_profile).toEqual(hands);
    const profile = structuredClone(f.family.base_movement_profile);
    profile.movementContract.repThresholds.down.angle = profile.movementContract.repThresholds.up.angle;
    await expect(f.exerciseService.updateMovementFamilyContract('family', {movement_profile: profile, expected_revision: 3}))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported count timing through exercise writes and the pose DTO', async () => {
    const f = fixture();
    const profile = structuredClone(f.family.base_movement_profile);
    profile.movementContract.countAt = 'initial';
    await expect(f.exerciseService.updateExercise('exercise', {
      shared_movement_update: {family_id: 'family', expected_revision: 3, movement_profile: profile},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(f.exerciseRepo.updateExercise).not.toHaveBeenCalled();
    for (const count_at of ['peak', 'return', undefined, 'initial']) {
      const errors = validateSync(plainToInstance(PoseMovementContractDTO, {count_at}));
      expect(errors.some(error => error.property === 'count_at')).toBe(count_at === 'initial');
    }
  });

  it('binds finalized counts to one set and makes retry idempotent after workout completion', async () => {
    const f = fixture();
    await f.start();
    let log: any = null;
    const session: any = {id:'workout',user_id:'user',plan_id:'plan',status:'in_progress'};
    const repo = {
      findSessionByIdOrThrow: async () => session, findActiveExerciseById: async () => ({id:'exercise'}),
      findPlanExercise: async () => ({id:'slot'}), findPoseSessionByIdOrThrow: f.poseRepo.findPoseSessionByIdOrThrow,
      findExerciseLogById: async () => log,
      createExerciseLog: jest.fn(async input => {
        log = {id:'log',session_id:input.sessionId,user_id:input.userId,exercise_id:input.exerciseId,
          plan_exercise_id:input.planExerciseId,set_number:input.setNumber,reps_completed:input.repsCompleted,
          reps_ai_counted:input.repsAiCounted,exercise:{name:'Renamed'},created_at:f.now,updated_at:f.now};
        f.pose().exercise_log_id = log.id; return log;
      }),
    };
    const service = new WorkoutSessionService(repo as any, {} as any, {} as any);
    const input = {exercise_id:'exercise',plan_exercise_id:'slot',set_number:1,pose_session_id:'pose',reps_completed:2};
    await expect(service.logSet('user','workout',input)).rejects.toBeInstanceOf(HttpException);
    f.pose().ended_at = f.now; f.pose().rep_count_ai = 2;
    await expect(service.logSet('user','workout',{...input,set_number:2})).rejects.toBeInstanceOf(HttpException);
    const saved = await service.logSet('user','workout',input);
    session.status = 'completed';
    expect(await service.logSet('user','workout',input)).toEqual(saved);
    expect(repo.createExerciseLog).toHaveBeenCalledTimes(1);
    await expect(service.logSet('user','workout',{...input,set_number:2})).rejects.toBeInstanceOf(ConflictException);
  });
});

it('keeps shared, alias and metadata operations inside the same rollback boundary', async () => {
  let committed = {revision:3,name:'Original',alias:'old'};
  let failMetadata = true;
  const prisma: any = {
    exerciseAlias: {findMany: async () => []}, exerciseCatalog: {findMany: async () => []},
    $transaction: async run => {
      const pending = {...committed};
      const result = await run({
        exerciseMovementFamily: {updateMany: async ({where}) => {
          if (where.contract_revision !== pending.revision) return {count:0};
          pending.revision++; return {count:1};
        }},
        exerciseAlias: {deleteMany: async () => {pending.alias='';},createMany: async () => {pending.alias='new';}},
        exerciseCatalog: {update: async () => {if(failMetadata) throw new Error('metadata failure'); pending.name='New'; return pending;}},
      });
      committed = pending; return result;
    },
  };
  const repo = new ExerciseRepository(prisma);
  const save = () => repo.updateExercise('exercise',{name:'New'},[{kind:'synonym',label:'new',normalizedLabel:'new'}],
    {familyId:'family',expectedRevision:3,profile:{}});
  await expect(save()).rejects.toThrow('metadata failure');
  expect(committed).toEqual({revision:3,name:'Original',alias:'old'});
  failMetadata = false;
  await save();
  expect(committed).toEqual({revision:4,name:'New',alias:'new'});
  await expect(save()).rejects.toBeInstanceOf(ConflictException);
  expect(committed.revision).toBe(4);
});
