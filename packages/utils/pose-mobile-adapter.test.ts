import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {createBrowserPoseAnalyzer} from "../../apps/mobile/lib/workout/browserPoseAnalyzer.ts";
import {createGeneratedExerciseRigFromMovementContract,normalizeExerciseMovementProfile} from "./exercise-editor.ts";
import {getPoseMovementFrameAssessment,normalizePoseMovementContract} from "./pose.ts";
import {getPoseFrameContractAngle} from "./pose-rig.ts";
import {createPoseRepEngineState,stepPoseRepEngine} from "./pose-rep-engine.ts";
import {createPoseDiagnostics} from "./pose-diagnostics.ts";
import {advancePoseSubjectTracker,createPoseSubjectTrackerState} from "./pose-subject-tracker.ts";
import type {PoseKeypointRecord,PoseMovementContractRecord} from "@fittrack/types";

const fixtures=JSON.parse(readFileSync(new URL("./pose-camera-fixtures.json",import.meta.url),"utf8"));
const points=(tuples:number[][]):PoseKeypointRecord[]=>tuples.map(([x,y,z,visibility])=>({x:x!,y:y!,z:z!,visibility:visibility!}));
// Detector output is controlled; the production video selection, decoded-frame
// check, landmark conversion, one-subject check, and counter all execute.
test("mobile adapter consumes an edited definition and counts only sufficient fresh limb cycles",async context=>{
  assert.equal(process.env.FITTRACK_POSE_ADAPTER_REPLAY,"1","Use the opt-in pose-test-loader replay; never a physical camera.");
  const host=globalThis as typeof globalThis & {
    document?:unknown;
    __fittrackPoseAdapterReplay?:{options?:Record<string,unknown>;calls:number;result:unknown};
  };
  const previousDocument=host.document;
  const video={readyState:3,videoWidth:960,videoHeight:540,currentTime:0};
  host.document={querySelectorAll:()=>[video]};
  const detector=host.__fittrackPoseAdapterReplay={calls:0,result:{landmarks:[]}};
  let now=1000;
  context.mock.method(Date,"now",()=>now);
  const analyzer=await createBrowserPoseAnalyzer({subjectTrackingMode:"off"});
  try {
    assert.equal(host.__fittrackPoseAdapterReplay.options?.numPoses,1);
    const contract=normalizePoseMovementContract(fixtures.families.bench_press.contract)!;
    contract.repThresholds={down:{angle:123,tolerance:15},up:{angle:155,tolerance:12}};
    contract.spatialRequirements={...contract.spatialRequirements,torsoSlopeMinDeg:0,torsoSlopeMaxDeg:20};
    const draft={movementContract:contract,rig:createGeneratedExerciseRigFromMovementContract({movementContract:contract})};
    const saved=normalizeExerciseMovementProfile(JSON.parse(JSON.stringify(draft)))!;
    const start=points(fixtures.benchRanges.start);
    async function cycle(target:PoseKeypointRecord[],rule:PoseMovementContractRecord=contract,view:"side"|"depth"="side"){
      let engine=createPoseRepEngineState();
      let subject=createPoseSubjectTrackerState("off",1,1);
      const reasons:string[]=[];
      const diagnostics:Array<{event:string;reason:string|null;reps:number;angles:{left:number;right:number}}> = [];
      const report=createPoseDiagnostics("adapter-replay",(_prefix,json)=>diagnostics.push(JSON.parse(json)));
      for(const progress of [0,0,.2,.4,.6,.8,1,1,.8,.6,.4,.2,0,0]){
        now+=150;video.currentTime+=.15;
        const interpolated=start.map((p,i)=>({...p,x:p.x+(target[i]!.x-p.x)*progress,y:p.y+(target[i]!.y-p.y)*progress}));
        const yaw=88*Math.PI/180;
        const spatial=view==="depth" ? interpolated.map(p=>({...p,
          x:(p.x-.57)*Math.cos(yaw),y:p.y-.5,z:(p.x-.57)*Math.sin(yaw),
        })) : interpolated;
        // Deliberately hide unrelated points: the generic full-body summary
        // fails, while the exercise's actual eight required landmarks are clear.
        const image=spatial.map((p,i)=>{
          const x=view==="depth" ? .5+(p.x+.015)/(2+p.z) : p.x;
          const y=view==="depth" ? .5+(p.y+.55)/(2+p.z) : p.y;
          return {...p,x:.5+(x-.5)*video.videoHeight/video.videoWidth,y,
            visibility:[11,12,13,14,15,16,23,24].includes(i)?.95:0};
        });
        detector.result={landmarks:[image],worldLandmarks:[spatial]};
        const frame=await analyzer.readFrame();
        assert.ok(frame);
        assert.equal(frame.isReliable,false);
        const selection=advancePoseSubjectTracker(subject,{mode:"off",generation:1,streamId:1,
          candidates:frame.candidates,capturedAtMs:frame.capturedAtMs,nowMs:now});
        subject=selection.nextState;
        assert.equal(selection.canCount,true);
        const dimensions={width:frame.frameWidth,height:frame.frameHeight};
        assert.equal(getPoseMovementFrameAssessment(rule,frame.keypoints,dimensions).isReliable,true);
        const evidence={
          rig:saved.rig,keypoints:frame.keypoints,spatialKeypoints:frame.spatialKeypoints,coordinateDimensions:dimensions,
        };
        const result=stepPoseRepEngine(engine,rule,getPoseFrameContractAngle(rule,frame,dimensions),frame.capturedAtMs,evidence);
        report({reason:result.noCountReason,timestamp:frame.capturedAtMs,state:result.nextState,previousState:engine,
          contract:rule,rig:saved.rig,evidence});
        engine=result.nextState;
        if(result.noCountReason)reasons.push(result.noCountReason);
        const calls=detector.calls;
        assert.equal(await analyzer.readFrame(),undefined,"Same decoded frame must never be new evidence");
        assert.equal(detector.calls,calls);
      }
      return {count:engine.repCount,reasons,diagnostics};
    }
    const full=await cycle(points(fixtures.benchRanges.full));
    assert.equal(full.count,1);
    assert.deepEqual(full.reasons,[]);
    assert.ok(full.diagnostics.some(entry=>entry.event==="count_changed" && entry.reps===1));
    assert.ok(full.diagnostics.every(entry=>Number.isFinite(entry.angles.left) && Number.isFinite(entry.angles.right)));
    const depthFacing=await cycle(points(fixtures.benchRanges.full),contract,"depth");
    assert.equal(depthFacing.count,1,JSON.stringify(depthFacing));
    assert.deepEqual(depthFacing.reasons,[]);
    const half=await cycle(points(fixtures.benchRanges.half));
    assert.equal(half.count,0,JSON.stringify(half));
    const wrongPosture={...contract,spatialRequirements:{...contract.spatialRequirements,torsoSlopeMinDeg:65,torsoSlopeMaxDeg:90}};
    const rejected=await cycle(points(fixtures.benchRanges.full),wrongPosture,"depth");
    assert.equal(rejected.count,0);
    assert.ok(rejected.reasons.includes("torso_slope_below_min"));
    assert.ok(rejected.diagnostics.some(entry=>entry.reason==="torso_slope_below_min" && entry.reps===0));
  } finally {
    analyzer.dispose();host.document=previousDocument;delete host.__fittrackPoseAdapterReplay;
  }
});
