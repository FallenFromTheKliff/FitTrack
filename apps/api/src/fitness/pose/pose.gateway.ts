import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';

import type { PoseSessionResponseDTO } from './dto/pose.dto';
import type { PoseSessionEndReason } from './dto/pose.dto';
import { PoseService } from './pose.service';
import type { PoseConnectionState } from './pose.types';

type PoseFramePayload = {
  frame_b64?: string;
};

type PoseStopPayload = {
  ended_reason?: Extract<
    PoseSessionEndReason,
    'manual_stop' | 'session_completed'
  >;
};

type PoseGatewayConnection = {
  state: PoseConnectionState;
  frameInFlight: boolean;
  pendingFrameBase64: string | null;
  processingPromise: Promise<void> | null;
};

@Injectable()
@WebSocketGateway({
  namespace: '/pose',
  cors: { origin: true, credentials: true },
})
export class PoseGateway {
  private readonly logger = new Logger(PoseGateway.name);
  private readonly connections = new Map<string, PoseGatewayConnection>();

  constructor(private readonly poseService: PoseService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.poseService.authenticateSocket(client);
      const exerciseHint = this.poseService.normalizeExerciseHint(
        client.handshake.query.exercise_hint,
      );
      const state = await this.poseService.startPoseSession(
        user.sub,
        exerciseHint,
      );

      this.connections.set(client.id, {
        state,
        frameInFlight: false,
        pendingFrameBase64: null,
        processingPromise: null,
      });
      client.emit('pose.session.started', {
        pose_session_id: state.poseSessionId,
        accepted_fps: state.acceptedFps,
      });
    } catch (error) {
      this.emitError(client, error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const connection = this.connections.get(client.id);
    if (!connection) {
      return;
    }

    this.connections.delete(client.id);

    try {
      if (connection.processingPromise) {
        await connection.processingPromise;
      }

      const finalized = await this.poseService.finalizePoseSession(
        connection.state,
        'client_disconnect',
      );
      this.emitFinalized(client, finalized);
    } catch (error) {
      this.logger.error(
        'Failed to finalize pose session on disconnect.',
        error,
      );
    }
  }

  @SubscribeMessage('frame')
  async handleFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PoseFramePayload,
  ): Promise<void> {
    const connection = this.connections.get(client.id);
    if (!connection) {
      this.emitError(client, {
        detail: 'Pose session connection is not active.',
      });
      client.disconnect(true);
      return;
    }

    connection.pendingFrameBase64 = payload.frame_b64 ?? '';

    if (connection.frameInFlight) {
      return;
    }

    try {
      connection.frameInFlight = true;
      connection.processingPromise = this.drainPendingFrames(
        client,
        connection,
      );
      await connection.processingPromise;
    } catch (error) {
      this.emitError(client, error);
    } finally {
      connection.frameInFlight = false;
      connection.processingPromise = null;
    }
  }

  @SubscribeMessage('stop')
  async handleStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PoseStopPayload = {},
  ): Promise<void> {
    const connection = this.connections.get(client.id);
    if (!connection) {
      this.emitError(client, {
        detail: 'Pose session connection is not active.',
      });
      client.disconnect(true);
      return;
    }

    this.connections.delete(client.id);

    try {
      if (connection.processingPromise) {
        await connection.processingPromise;
      }

      const finalized = await this.poseService.finalizePoseSession(
        connection.state,
        payload.ended_reason ?? 'manual_stop',
      );
      this.emitFinalized(client, finalized);
      client.disconnect(true);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  private async drainPendingFrames(
    client: Socket,
    connection: PoseGatewayConnection,
  ): Promise<void> {
    while (this.connections.get(client.id) === connection) {
      const frameBase64 = connection.pendingFrameBase64;
      connection.pendingFrameBase64 = null;

      if (frameBase64 === null) {
        return;
      }

      const result = await this.poseService.analyzeFrame(
        connection.state,
        frameBase64,
      );
      connection.state = result.nextState;
      this.emitAnalysis(client, result.nextState, result.analysis);
    }
  }

  private emitAnalysis(
    client: Socket,
    state: PoseConnectionState,
    analysis: Awaited<ReturnType<PoseService['analyzeFrame']>>['analysis'],
  ): void {
    if (analysis.subject_locked !== undefined || analysis.form_feedback) {
      client.emit('pose.feedback', {
        pose_session_id: state.poseSessionId,
        subject_locked: analysis.subject_locked ?? false,
        form_feedback: analysis.form_feedback ?? [],
        movement_contract: analysis.movement_contract ?? null,
        exercise_class: analysis.exercise_class ?? null,
        confidence: analysis.confidence,
      });
    }
  }

  private emitFinalized(client: Socket, session: PoseSessionResponseDTO): void {
    client.emit('pose.session.finalized', {
      pose_session_id: session.id,
      detected_exercise_name: session.detected_exercise_name,
      classification_confidence: this.toNullableNumber(
        session.classification_confidence,
      ),
      summary: session.analysis_summary ?? {},
    });
  }

  private emitError(client: Socket, error: unknown): void {
    const detail =
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'detail' in error.response &&
      typeof error.response.detail === 'string'
        ? error.response.detail
        : typeof error === 'object' &&
            error !== null &&
            'detail' in error &&
            typeof error.detail === 'string'
          ? error.detail
          : 'Pose processing failed.';

    client.emit('pose.error', { detail });
  }

  private toNullableNumber(value: string | null): number | null {
    if (value === null) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
