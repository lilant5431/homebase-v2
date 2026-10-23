export const worldVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vLocalNormal;
  void main() {
    vLocal = position;
    vLocalNormal = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec3 viewNormal = normalize(normalMatrix * normal);
    vNormal = normalize(vec3(dot(viewMatrix[0].xyz, viewNormal), dot(viewMatrix[1].xyz, viewNormal), dot(viewMatrix[2].xyz, viewNormal)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Convex half-space tracing: entrance refraction, exact exit facet, three
// spectral bands, up to three internal reflection segments. The environment is
// a live six-view HDR capture, not a static sky or screen-space color offset.
export const crystalFragment = /* glsl */ `
  uniform samplerCube uEnvironment;
  uniform mat4 uWorldMatrix;
  uniform mat4 uInverseWorld;
  uniform vec4 uPlanes[PLANE_COUNT];
  uniform float uTime;
  uniform float uEmphasis;
  uniform float uRefraction;
  uniform float uDispersion;
  uniform float uLegacy;
  uniform float uDesign;
  uniform vec3 uLight;
  uniform vec3 uTint;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vLocalNormal;

  vec3 environment(vec3 p, vec3 d) {
    // Box-projected local probe corrects first-order parallax. Geometry outside
    // this proxy and occlusion at the exit position remain approximations.
    vec3 center = vec3(0.,6.,0.);
    vec3 safeD = sign(d+vec3(1e-8))*max(abs(d),vec3(.00001));
    vec3 farHit = max((center+vec3(22.,16.,22.)-p)/safeD,
                      (center-vec3(22.,16.,22.)-p)/safeD);
    float t = max(0.,min(farHit.x,min(farHit.y,farHit.z)));
    return textureCube(uEnvironment,normalize(p+d*t-center)).rgb;
  }
  float fresnel(float cosine, float ior) {
    float f0 = pow((1.-ior)/(1.+ior),2.);
    return f0+(1.-f0)*pow(1.-clamp(cosine,0.,1.),5.);
  }
  vec4 exitFacet(vec3 p, vec3 d) {
    float distance = 1e5;
    vec3 n = vec3(0.,1.,0.);
    for (int i=0; i<PLANE_COUNT; i++) {
      float denominator = dot(uPlanes[i].xyz,d);
      if (denominator > .00001) {
        float candidate = -(dot(uPlanes[i].xyz,p)+uPlanes[i].w)/denominator;
        if (candidate > .00001 && candidate < distance) {
          distance = candidate;
          n = uPlanes[i].xyz;
        }
      }
    }
    return vec4(n,distance);
  }
  float internalLight(vec3 p) {
    // Volumetric growth veils and a narrow, moving light core are integrated
    // along the refracted ray, so apparent depth changes with the actual path.
    if(uLegacy < .5) {
      float coreShape = uDesign > 1.5 ? abs(p.x)*.9+abs(p.y)*.6+abs(p.z) : length(p.xz)*1.4+abs(p.y)*.12;
      float core = exp(-coreShape*2.6);
      float shaft = exp(-length(p.xz)*16.)*exp(-abs(p.y)*.35);
      return (core*12.+shaft*1.8)*(.94+.06*sin(uTime*.55));
    }
    float vein = sin(p.y*2.3+p.x*.8+sin(p.z*2.0)*.65+uTime*.2);
    float layers = pow(.5+.5*vein,22.)*.16;
    float core = exp(-length(p.xz-vec2(sin(p.y*.7+uTime*.23)*.35,cos(p.y*.4)*.2))*3.8);
    float pulse = .65+.35*sin(p.y*.6-uTime*.65);
    return (core*pulse*.9+layers)*(.7+.3*smoothstep(-5.,3.,p.y));
  }
  vec3 traceBand(vec3 entry, vec3 ray, vec3 normal, float ior) {
    vec3 d = refract(ray,normal,1./ior);
    vec3 p = entry+ d*.002;
    vec3 sum = vec3(0.);
    vec3 throughput = vec3(1.);
    for (int bounce=0; bounce<3; bounce++) {
      vec4 hit = exitFacet(p,d);
      if(hit.w > 1000.) break;
      float lengthInCrystal = hit.w;
      float stepSize = lengthInCrystal/12.;
      float light = 0.;
      for (int s=0; s<12; s++) {
        light += internalLight(p+d*(float(s)+.5)*stepSize)*stepSize;
      }
      // Beer-Lambert absorption gives real thickness-dependent color.
      throughput *= exp(-vec3(.068,.025,.015)*lengthInCrystal);
      sum += throughput*mix(vec3(.6,.86,1.),uTint,.15)*light*.12;
      p += d*lengthInCrystal;
      vec3 exiting = refract(d,-hit.xyz,ior);
      float reflection = fresnel(abs(dot(d,hit.xyz)),ior);
      if (dot(exiting,exiting) > .001) {
        vec3 worldP = (uWorldMatrix*vec4(p,1.)).xyz;
        vec3 worldD = normalize((uWorldMatrix*vec4(exiting,0.)).xyz);
        sum += throughput*(1.-reflection)*environment(worldP,worldD);
        throughput *= reflection;
      }
      // Total internal reflection preserves energy rather than sampling a
      // zero direction. Residual energy after the fixed bounce cap is lost.
      d = reflect(d,hit.xyz);
      p += d*.002;
    }
    return sum;
  }
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition-vWorld);
    vec3 localCamera = (uInverseWorld*vec4(cameraPosition,1.)).xyz;
    vec3 ray = normalize(vLocal-localCamera);
    vec3 localN = normalize(vLocalNormal);
    vec3 transmission;
    if (uRefraction < .5) {
      transmission = environment(vWorld,-V);
    } else {
      if(uDispersion < .00001) transmission = traceBand(vLocal,ray,localN,1.48);
      else transmission = vec3(
        traceBand(vLocal,ray,localN,1.48-uDispersion).r,
        traceBand(vLocal,ray,localN,1.48).g,
        traceBand(vLocal,ray,localN,1.48+uDispersion).b
      );
    }
    float F = fresnel(max(dot(N,V),0.),1.48);
    vec3 reflected = environment(vWorld,reflect(-V,N));
    vec3 color = mix(transmission,reflected,F);
    vec3 L = normalize(uLight-vWorld);
    float spec = pow(max(dot(reflect(-L,N),V),0.),180.);
    color += vec3(.8,.94,1.)*spec*(uLegacy>.5?3.:.85);
    // Distance to the adjacent plane sharpens real facet junctions rather than
    // outlining every triangulation edge in the convex mesh.
    float edgeDistance = 10.;
    for (int i=0; i<PLANE_COUNT; i++) {
      float dist = abs(dot(uPlanes[i].xyz,vLocal)+uPlanes[i].w);
      if (dot(uPlanes[i].xyz,localN)<.999) edgeDistance = min(edgeDistance,dist);
    }
    float edge = 1.-smoothstep(.008,.065,edgeDistance);
    color += mix(vec3(.4,.8,1.),uTint,.3)*edge*(.18+.42*F+uEmphasis*.4);
    float growth = pow(.5+.5*sin(vLocal.y*86.+sin(vLocal.x*4.)*.8),35.);
    color += vec3(.18,.25,.27)*growth*.065*uLegacy;
    gl_FragColor = vec4(color,1.);
  }
`;

export const floorFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    float r = length(p);
    float angle = atan(p.y,p.x);
    float rings = pow(.5+.5*cos(r*3.2),90.)*(1.-smoothstep(14.,25.,r));
    float seam = pow(abs(cos(angle*3.)),110.)*smoothstep(4.,7.,r)*(1.-smoothstep(15.,24.,r));
    float wave = sin(p.x*2.3+sin(p.y*1.6+uTime*.4)*2.);
    float caustic = pow(.5+.5*wave,18.)*pow(.5+.5*sin(p.y*2.7-p.x-uTime*.36),9.);
    float pool = exp(-r*.1);
    vec3 stone = vec3(.009,.022,.032)+vec3(.04,.065,.07)*pool;
    stone += uTint*(rings*.16+seam*.25+caustic*.7*pool);
    stone += uTint*exp(-r*.38)*(.14+.025*sin(uTime*.4));
    gl_FragColor = vec4(stone,1.);
  }
`;
export const backdropFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  varying vec3 vWorld;
  void main() {
    float a = atan(vWorld.z,vWorld.x);
    float y = vWorld.y;
    float broad = pow(.5+.5*cos(a*3.+uTime*.08),14.);
    float slit = pow(.5+.5*cos(a*6.+sin(uTime*.1)*.18),30.);
    float horizon = exp(-pow((y-5.)*.18,2.));
    float ribbon = exp(-pow((y-8.-sin(a*3.+uTime*.16)*2.5)*1.1,2.));
    vec3 color = vec3(.012,.028,.044)+mix(uTint,vec3(.8,.9,1.),.6)*broad*.65*horizon;
    color += mix(uTint,vec3(.95,.8,.49),.4)*slit*horizon*.25;
    color += uTint*ribbon*.4;
    gl_FragColor = vec4(color,1.);
  }
`;
export const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime*.09+aSeed*40.)*.7;
    p.y = mod(p.y+uTime*(.045+aSeed*.08),16.);
    p.z += cos(uTime*.07+aSeed*23.)*.7;
    vec4 mv = modelViewMatrix*vec4(p,1.);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp((18.+aSeed*35.)/-mv.z,1.,4.)*uPixelRatio;
    vAlpha = (.3+.7*aSeed)*(1.-smoothstep(10.,60.,-mv.z));
  }
`;
export const particleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord-.5);
    float alpha = (1.-smoothstep(.03,.5,r))*vAlpha*.5;
    gl_FragColor = vec4(.65,.89,1.,alpha);
  }
`;
