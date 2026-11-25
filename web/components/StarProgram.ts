// A Sigma node program that draws each artist as a glowing star: a bright,
// slightly white-hot core plus a soft halo in the region colour.
// It reuses Sigma's point program and only swaps the shaders.
import { NodePointProgram } from "sigma/rendering";

// How much larger than the core the halo sprite is.
const GLOW = 3.5;

const VERTEX = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_position;
attribute float a_size;

uniform float u_sizeRatio;
uniform float u_pixelRatio;
uniform mat3 u_matrix;

varying vec4 v_color;
varying float v_border;

const float bias = 255.0 / 254.0;

void main() {
  gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
  gl_PointSize = a_size / u_sizeRatio * u_pixelRatio * 2.0 * ${GLOW.toFixed(1)};
  v_border = (0.5 / a_size) * u_sizeRatio;
  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif
  v_color.a *= bias;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;

varying vec4 v_color;
varying float v_border;

const float core = 1.0 / ${GLOW.toFixed(1)};

void main(void) {
  // d: 0 at the centre, 1 at the edge of the halo sprite.
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;

  #ifdef PICKING_MODE
  // Only the core is clickable, not the halo.
  gl_FragColor = d < core ? v_color : vec4(0.0);
  #else
  float aa = v_border * 2.0 * core;
  float coreA = 1.0 - smoothstep(core - aa, core, d);
  float halo = pow(max(0.0, 1.0 - d), 3.0) * 0.55;
  float a = max(coreA, halo) * v_color.a;
  // White-hot centre fading into the region colour.
  vec3 rgb = mix(v_color.rgb, vec3(1.0), coreA * (1.0 - d / core) * 0.6);
  gl_FragColor = vec4(rgb * a, a); // premultiplied alpha, as Sigma expects
  #endif
}
`;

export default class StarProgram extends NodePointProgram {
  getDefinition() {
    return { ...super.getDefinition(), VERTEX_SHADER_SOURCE: VERTEX, FRAGMENT_SHADER_SOURCE: FRAGMENT };
  }
}
