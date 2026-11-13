export type SceneEditorSnapshot = {
  scene: StudioSceneDocument;
  assets: {path:string;dataUrl:string}[];
  presentation: Record<string,unknown>;
};
export type SceneRuntimeCaptureRequest = SceneEditorSnapshot & {
  objectId:string;keepOpen?:boolean;
  stage:"room"|"approach"|"open"|"return";
  device:"desktop"|"mobile";
};
export type SceneRuntimeCaptureResult = {
  image:string;width:number;height:number;sessionId:string|null;
  phase:string;stage:string|null;object:string;
  overflow:{left:number;right:number;top:number;bottom:number}|null;
  visible:boolean;syntheticContent:boolean;temporarilyRevealed:boolean;timingSlowed:boolean;
  draftEffectsApplied:boolean;draftAssetsApplied:number;draftAssetLoads:string[];
  candleButtonCount:number;customArtworkCount:number;
  targetBounds:{x:number;y:number;width:number;height:number}|null;
  sourceHash:string;note:string;
};
export function mountSceneEditor(
  root: HTMLElement,
  options: {
    onDirty():void;
    onCapture?(input:SceneRuntimeCaptureRequest):Promise<SceneRuntimeCaptureResult>;
    onCaptureInteract?(input:{sessionId:string;action:"click"|"key"|"refresh";
      x?:number;y?:number;key?:string}):Promise<{image:string;width:number;height:number;
      sessionId:string;phase:string;stage:string|null;activeObject:string}>;
    onCaptureClose?(input:{sessionId:string}):Promise<{ok:boolean}>;
  }
):{
  load(packet:Record<string,unknown>):void;
  snapshot():SceneEditorSnapshot;
  destroy():void;
};
