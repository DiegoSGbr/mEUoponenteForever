import * as THREE from 'three';
import { FACE_SKIN_UV_GATE } from './OpponentFaceConfig';
import { INJURY_NORMAL_STRENGTH } from './OpponentFaceInjuryConfig';
import type { FaceInjuryMaps } from './OpponentFaceInjuryMaps';

export interface FaceInjuryUniforms {
  u_injuryVectors: { value: THREE.Vector4 };
  u_injuryMaskMap: { value: THREE.Texture };
  u_injuryAlbedoMap: { value: THREE.Texture };
  u_injuryNormalMap: { value: THREE.Texture };
  u_injuryRoughnessMap: { value: THREE.Texture };
  u_injuryNormalStrength: { value: number };
  u_faceSkinGate: { value: THREE.Vector4 };
}

const CACHE_KEY = 'opponent-face-injury-pbr-v9-staged';

/**
 * Injeta ferimentos PBR no MeshStandardMaterial do rosto via onBeforeCompile.
 */
export function patchFaceInjuryMaterial(
  material: THREE.MeshStandardMaterial,
  maps: FaceInjuryMaps,
  injuryVectors: THREE.Vector4,
): FaceInjuryUniforms {
  const uniforms: FaceInjuryUniforms = {
    u_injuryVectors: { value: injuryVectors },
    u_injuryMaskMap: { value: maps.mask },
    u_injuryAlbedoMap: { value: maps.albedo },
    u_injuryNormalMap: { value: maps.normal },
    u_injuryRoughnessMap: { value: maps.roughness },
    u_injuryNormalStrength: { value: INJURY_NORMAL_STRENGTH },
    u_faceSkinGate: {
      value: new THREE.Vector4(
        FACE_SKIN_UV_GATE.u,
        FACE_SKIN_UV_GATE.v,
        FACE_SKIN_UV_GATE.rx,
        FACE_SKIN_UV_GATE.ry,
      ),
    },
  };

  material.userData.faceInjuryUniforms = uniforms;

  const prevKey = material.userData.faceInjuryCacheKey as string | undefined;
  if (material.userData.faceInjuryHooked && prevKey === CACHE_KEY) {
    syncFaceInjuryMaps(material, maps);
    return uniforms;
  }

  material.userData.faceInjuryHooked = true;
  material.userData.faceInjuryCacheKey = CACHE_KEY;
  const prevCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(material, shader, renderer);

    shader.uniforms.u_injuryVectors = uniforms.u_injuryVectors;
    shader.uniforms.u_injuryMaskMap = uniforms.u_injuryMaskMap;
    shader.uniforms.u_injuryAlbedoMap = uniforms.u_injuryAlbedoMap;
    shader.uniforms.u_injuryNormalMap = uniforms.u_injuryNormalMap;
    shader.uniforms.u_injuryRoughnessMap = uniforms.u_injuryRoughnessMap;
    shader.uniforms.u_injuryNormalStrength = uniforms.u_injuryNormalStrength;
    shader.uniforms.u_faceSkinGate = uniforms.u_faceSkinGate;

    const pars = [
      '#include <map_pars_fragment>',
      'uniform vec4 u_injuryVectors;',
      'uniform sampler2D u_injuryMaskMap;',
      'uniform sampler2D u_injuryAlbedoMap;',
      'uniform sampler2D u_injuryNormalMap;',
      'uniform sampler2D u_injuryRoughnessMap;',
      'uniform float u_injuryNormalStrength;',
      'uniform vec4 u_faceSkinGate;',
      'float faceInjuryWeight = 0.0;',
    ].join('\n');

    // Gates leves: portão UV amplo + scalp (normal.y). Sem hairline/chin agressivos.
    const mapFrag = [
      '#include <map_fragment>',
      '{',
      '	vec2 gateN = ( vMapUv - u_faceSkinGate.xy ) / max( u_faceSkinGate.zw, vec2( 1e-5 ) );',
      '	float uvGate = 1.0 - smoothstep( 0.9, 1.15, dot( gateN, gateN ) );',
      '	float scalpGate = 1.0 - smoothstep( 0.4, 0.75, normalize( vNormal ).y );',
      '	vec4 injuryMask = texture2D( u_injuryMaskMap, vMapUv );',
      '	float regionW = clamp(',
      '		injuryMask.r * u_injuryVectors.x +',
      '		injuryMask.g * u_injuryVectors.y +',
      '		injuryMask.b * u_injuryVectors.z +',
      '		injuryMask.a * u_injuryVectors.w,',
      '		0.0, 1.0 );',
      '	float gatedW = regionW * uvGate * scalpGate;',
      // Estágios (referência Fight Night/UFC):
      //  stage1 = vermelhidão imediata (pele irritada pelo impacto)
      //  stage2 = hematoma instalado (roxo/sangue do albedo de injury)
      '	float stage1 = smoothstep( 0.03, 0.35, gatedW );',
      '	float stage2 = smoothstep( 0.30, 0.80, gatedW );',
      '	vec4 injuryAlbedo = texture2D( u_injuryAlbedoMap, vMapUv );',
      '	float injPresence = smoothstep( 0.02, 0.10, max( injuryAlbedo.r, max( injuryAlbedo.g, injuryAlbedo.b ) ) );',
      // Vermelhidão derivada da própria pele (mantém tom/sardas por baixo).
      '	vec3 rednessColor = diffuseColor.rgb * vec3( 1.30, 0.62, 0.55 ) + vec3( 0.05, 0.0, 0.0 );',
      '	vec3 woundedColor = mix( rednessColor, injuryAlbedo.rgb, stage2 * injPresence * max( injuryAlbedo.a, 0.92 ) );',
      '	diffuseColor.rgb = mix( diffuseColor.rgb, woundedColor, clamp( stage1, 0.0, 1.0 ) );',
      // Relevo/brilho só quando o hematoma se instala (stage2).
      '	faceInjuryWeight = gatedW * stage2;',
      '}',
    ].join('\n');

    const roughFrag = [
      '#include <roughnessmap_fragment>',
      '{',
      '	float injuryRough = texture2D( u_injuryRoughnessMap, vMapUv ).r;',
      '	float targetRough = mix( roughnessFactor * 0.85, 0.08, injuryRough );',
      '	roughnessFactor = mix( roughnessFactor, targetRough, faceInjuryWeight );',
      '}',
    ].join('\n');

    const normalFrag = [
      '#include <normal_fragment_maps>',
      '{',
      '	vec3 injN = texture2D( u_injuryNormalMap, vMapUv ).xyz * 2.0 - 1.0;',
      '	injN.xy *= u_injuryNormalStrength * faceInjuryWeight;',
      '	normal = normalize( normal + vec3( injN.xy, 0.0 ) );',
      '}',
    ].join('\n');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', pars)
      .replace('#include <map_fragment>', mapFrag)
      .replace('#include <roughnessmap_fragment>', roughFrag)
      .replace('#include <normal_fragment_maps>', normalFrag);

    material.userData.faceInjuryShader = shader;
  };

  material.customProgramCacheKey = () => CACHE_KEY;
  material.needsUpdate = true;
  return uniforms;
}

export function syncFaceInjuryMaps(
  material: THREE.MeshStandardMaterial,
  maps: FaceInjuryMaps,
): void {
  const u = material.userData.faceInjuryUniforms as FaceInjuryUniforms | undefined;
  if (!u) return;
  u.u_injuryMaskMap.value = maps.mask;
  u.u_injuryAlbedoMap.value = maps.albedo;
  u.u_injuryNormalMap.value = maps.normal;
  u.u_injuryRoughnessMap.value = maps.roughness;
  u.u_faceSkinGate.value.set(
    FACE_SKIN_UV_GATE.u,
    FACE_SKIN_UV_GATE.v,
    FACE_SKIN_UV_GATE.rx,
    FACE_SKIN_UV_GATE.ry,
  );
}

export function initFaceInjuryTextures(
  renderer: THREE.WebGLRenderer,
  maps: FaceInjuryMaps,
): void {
  renderer.initTexture(maps.mask);
  renderer.initTexture(maps.albedo);
  renderer.initTexture(maps.normal);
  renderer.initTexture(maps.roughness);
}
