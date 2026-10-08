import * as THREE from './node_modules/three/build/three.module.js';

// Texture decoding happens once per selected style. No image work in the frame loop.
export function surfaceMaterials(renderer,body,fur,strands){
  const textures=new Map(),loader=new THREE.TextureLoader();
  async function load(style){
    if(!style.file)return null;
    if(!textures.has(style.file))textures.set(style.file,loader.loadAsync('../assets/'+encodeURIComponent(style.file)).then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.flipY=false; // Cloth UV row zero is the top edge of the artwork.
      texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      renderer.initTexture(texture);return texture;
    }).catch(error=>{textures.delete(style.file);throw error;}));
    return textures.get(style.file);
  }
  function apply(style,texture){
    const long=style.material==='plush',paper=style.material==='paper';
    body.material.map=texture;body.material.color.setHex(long?0xe4dac8:0xffffff);
    body.material.roughness=1;body.material.needsUpdate=true;
    for(let i=0;i<fur.length;i++){
      const mesh=fur[i],material=mesh.material;
      mesh.visible=!paper&&(long||i===1||i===2||i===4);
      material.map=texture;material.color.setHex(long?0xf2eadd:0xffffff);
      material.userData.furUniforms.furHeight.value=long?10:1.25;
      material.userData.furUniforms.furDensity.value=long?1:1.8;
      material.needsUpdate=true;
    }
    strands.mesh.visible=long;
  }
  return {load,apply};
}
