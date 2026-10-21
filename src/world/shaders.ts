export const worldVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec3 viewNormal = normalize(normalMatrix * normal);
    vNormal = normalize(vec3(dot(viewMatrix[0].xyz, viewNormal), dot(viewMatrix[1].xyz, viewNormal), dot(viewMatrix[2].xyz, viewNormal)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Screen-space transmission samples the actual architecture behind the crystal.
// Three wavelengths approximate dispersion; this is not multi-bounce ray tracing.
export const crystalFragment = /* glsl */ `
  uniform sampler2D uScene;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uEmphasis;
  uniform vec3 uLight;
  varying vec3 vWorld;
  varying vec3 vNormal;
  vec2 bend(vec3 ray, float ior) {
    vec3 dir = refract(ray, normalize(vNormal), 1.0 / ior);
    return (viewMatrix * vec4(dir, 0.0)).xy * .065;
  }
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorld);
    if (!gl_FrontFacing) N = -N;
    float facing = max(dot(N,V),0.0);
    float fresnel = .045 + .955 * pow(1.0-facing,5.0);
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 ray = -V;
    vec3 transmitted = vec3(
      texture2D(uScene,clamp(uv+bend(ray,1.44),.002,.998)).r,
      texture2D(uScene,clamp(uv+bend(ray,1.47),.002,.998)).g,
      texture2D(uScene,clamp(uv+bend(ray,1.51),.002,.998)).b
    );
    vec3 L = normalize(uLight-vWorld);
    float glint = pow(max(dot(reflect(-L,N),V),0.0),110.0);
    float broad = pow(max(dot(reflect(-L,N),V),0.0),14.0);
    float sweep = .5+.5*sin(vWorld.y*1.8+vWorld.x*.65-uTime*.5);
    vec3 reflection = mix(vec3(.12,.23,.31),vec3(.93,.81,.57),max(N.y*.5+.5,0.0));
    vec3 color = transmitted*vec3(.83,.94,.98)*.87;
    color = mix(color,reflection,fresnel*.8);
    color += vec3(.46,.74,1.0)*pow(1.0-facing,3.0)*(.4+.3*sweep);
    color += vec3(1.0,.83,.54)*(glint*5.0+broad*.45);
    color += vec3(.32,.67,.9)*uEmphasis*.15*sweep;
    gl_FragColor = vec4(color,1.0);
  }
`;

export const floorFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec2 p = vWorld.xz;
    vec2 tile = abs(fract(p/4.0)-.5);
    float grout = smoothstep(.487,.497,max(tile.x,tile.y));
    float vein = sin(p.x*1.3+sin(p.y*.4)*2.0+sin(p.x*5.0)*.1);
    vec3 stone = mix(vec3(.075,.12,.14),vec3(.23,.26,.23),vein*.15+.45);
    stone *= 1.0-grout*.6;
    float light = exp(-abs(p.x-sin(p.y*.035+uTime*.13)*9.0)*.3);
    float caustic = pow(.5+.5*sin(p.x*2.3+sin(p.y*1.8+uTime*.4)*1.6),12.0);
    caustic *= pow(.5+.5*sin(p.y*2.1+p.x*.7-uTime*.35),8.0);
    stone += vec3(.35,.38,.23)*light*.7 + vec3(.25,.6,.7)*caustic*.45;
    float fog = 1.0-exp(-length(cameraPosition-vWorld)*.018);
    gl_FragColor = vec4(mix(stone,vec3(.32,.39,.41),fog),1.0);
  }
`;

export const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime*.09+aSeed*40.0)*1.8;
    p.y = mod(p.y+uTime*(.045+aSeed*.08),16.0);
    p.z += cos(uTime*.07+aSeed*23.0)*1.1;
    vec4 mv = modelViewMatrix*vec4(p,1.0);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp((35.0+aSeed*55.0)/-mv.z,1.0,6.0)*uPixelRatio;
    vAlpha = (.3+.7*aSeed)*(1.0-smoothstep(10.0,100.0,-mv.z));
  }
`;
export const particleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord-.5);
    float alpha = (1.0-smoothstep(.03,.5,r))*vAlpha*.58;
    gl_FragColor = vec4(1.0,.88,.62,alpha);
  }
`;
export const hazeFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    float striation = .5+.5*sin(vWorld.x*.6+vWorld.z*.2+uTime*.12);
    float air = .012+.01*striation;
    float fade = smoothstep(0.0,5.0,vWorld.y)*(1.0-smoothstep(9.0,18.0,vWorld.y));
    gl_FragColor = vec4(.9,.76,.47,air*fade);
  }
`;
