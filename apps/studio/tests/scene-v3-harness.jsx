import React from 'react';
import {createRoot} from 'react-dom/client';
import SceneWorkshop from '../src/SceneWorkshop';
let root;
window.__mountStudioSceneV3=()=>{
  if(root)root.unmount();
  root=createRoot(document.getElementById('root'));
  root.render(React.createElement(SceneWorkshop));
};
window.__unmountStudioSceneV3=()=>{root?.unmount();root=null;};
