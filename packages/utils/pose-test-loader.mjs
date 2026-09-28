import { existsSync } from "node:fs";
import { extname } from "node:path";
const root = new URL("../../", import.meta.url);
export async function resolve(specifier, context, nextResolve) {
  // Opt-in adapter replay substitutes only the detector and native platform.
  // No production test hooks, browser, camera, or network are used.
  if (process.env.FITTRACK_POSE_ADAPTER_REPLAY === "1") {
    if (specifier === "react-native") return {shortCircuit:true,url:"data:text/javascript,export const Platform={OS:'web'};"};
    if (specifier.endsWith("/vision_bundle.mjs")) return {
      shortCircuit:true,
      url:"data:text/javascript,"+encodeURIComponent(`
        export const FilesetResolver={forVisionTasks:async()=>({})};
        export const PoseLandmarker={createFromOptions:async(_fileset,options)=>{
          globalThis.__fittrackPoseAdapterReplay.options=options;
          return {close(){},detectForVideo(){
            globalThis.__fittrackPoseAdapterReplay.calls++;
            return globalThis.__fittrackPoseAdapterReplay.result;
          }};
        }};
      `),
    };
  }
  const match = /^@fittrack\/(utils|types)(?:\/(.*))?$/.exec(specifier);
  if (match) {
    const candidate = new URL(
      `packages/${match[1]}/${match[2] || "index"}.ts`,
      root,
    );
    if (existsSync(candidate))
      return { shortCircuit: true, url: candidate.href };
  }
  if (specifier.startsWith(".") && !extname(specifier) && context.parentURL) {
    for (const suffix of [".ts", "/index.ts"]) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(candidate))
        return { shortCircuit: true, url: candidate.href };
    }
  }
  return nextResolve(specifier, context);
}
