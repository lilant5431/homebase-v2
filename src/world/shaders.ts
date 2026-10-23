// Finite wavefronts originate only from presentation events, never from an idle loop.
const lightResponse = /* glsl */ `
 uniform float uRefined;
 uniform float uFlash;
 uniform vec4 uEvents[8];
 float responseWave(float radius, float time) {
   float wave=0.;
   for(int i=0;i<8;i++) {
     float age=time-uEvents[i].x;
     if(age>=0. && age<5.) {
       float d=(radius-age*4.3)/.42;
       wave+=uEvents[i].y*exp(-d*d)*exp(-age*.55);
     }
   }
   return wave;
 }
`;
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
  ${lightResponse}
  uniform float uTime;
  uniform float uLiving;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uBeacon;
  uniform float uBeamWidth;
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
    vec3 safeD = mix(vec3(-1.),vec3(1.),step(vec3(0.),d))*max(abs(d),vec3(.00001));
    vec3 farHit = max((center+vec3(22.,16.,22.)-p)/safeD,
                      (center-vec3(22.,16.,22.)-p)/safeD);
    float t = max(0.,min(farHit.x,min(farHit.y,farHit.z)));
    vec3 q=normalize(p+d*t-center);
    // Bound probe blur at discontinuous exit facets. No independent RGB paths.
    return uRefined>.5 ? textureLod(uEnvironment,q,.65).rgb : textureCube(uEnvironment,q).rgb;
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

  float erfApprox(float x) {
    float t=1./(1.+.3275911*abs(x));
    float q=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t;
    return sign(x)*(1.-q*exp(-x*x));
  }
  // Exact finite-segment integral of a radial Gaussian around the local Y axis.
  // Avoids a subpixel spine flickering between the old 12 discrete samples.
  float spineIntegral(vec3 p,vec3 d,float lengthInCrystal,float width) {
    float lo=0.,hi=lengthInCrystal;
    if(abs(d.y)>.00001) {
      float a=(-5.6-p.y)/d.y,b=(6.1-p.y)/d.y;
      lo=max(lo,min(a,b));hi=min(hi,max(a,b));
    } else if(p.y < -5.6 || p.y > 6.1) return 0.;
    if(hi<=lo) return 0.;
    p+=d*lo;float len=hi-lo;
    float a=dot(d.xz,d.xz),b=dot(p.xz,d.xz),c=dot(p.xz,p.xz);
    if(a<.000001) return len*exp(-c/(width*width));
    float root=sqrt(a),denom=root*width;
    float integral=.886226925*width/root*exp(-max(0.,c-b*b/a)/(width*width))
      *(erfApprox((a*len+b)/denom)-erfApprox(b/denom));
    return max(0.,integral);
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
      vec3 attenuation=exp(-vec3(.068,.025,.015)*lengthInCrystal);
      if(uLiving > .5) {
        float spine=spineIntegral(p,d,lengthInCrystal,uRefined>.5?.075:.105)*(uRefined>.5?26.:32.);
        float mantle=spineIntegral(p,d,lengthInCrystal,.34)*2.2;
        float aura=spineIntegral(p,d,lengthInCrystal,.75)*.18;
        vec3 emission=vec3(.72,.92,1.)*spine+mix(vec3(.18,.6,.9),uTint,.35)*(mantle+aura);
        if(uRefined>.5) emission=emission/(1.+emission*.12);
        sum += throughput*sqrt(attenuation)*emission*(.45+.55*uEnergy)*(1.+uFlash*.12*uRefined);
        throughput *= attenuation;
      } else {
        float stepSize=lengthInCrystal/12.,light=0.;
        for(int s=0;s<12;s++) light+=internalLight(p+d*(float(s)+.5)*stepSize)*stepSize;
        throughput*=attenuation;
        sum+=throughput*mix(vec3(.6,.86,1.),uTint,.15)*light*.12;
      }
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
    float specBase=max(dot(reflect(-L,N),V),0.);
    float spec = pow(specBase,uRefined>.5?100.:180.);
    color += vec3(.8,.94,1.)*spec*(uLegacy>.5?3.:.85);
    // Distance to the adjacent plane sharpens real facet junctions rather than
    // outlining every triangulation edge in the convex mesh.
    float edgeDistance = 10.;
    for (int i=0; i<PLANE_COUNT; i++) {
      float dist = abs(dot(uPlanes[i].xyz,vLocal)+uPlanes[i].w);
      if (dot(uPlanes[i].xyz,localN)<.999) edgeDistance = min(edgeDistance,dist);
    }
    float aa=uRefined>.5?max(fwidth(edgeDistance)*.8,.002):0.;
    float edge = 1.-smoothstep(.008-aa,.065+aa,edgeDistance);
    color += mix(vec3(.4,.8,1.),uTint,.3)*edge*(.18+.42*F+uEmphasis*.4);
    float growth = pow(.5+.5*sin(vLocal.y*86.+sin(vLocal.x*4.)*.8),35.);
    color += vec3(.18,.25,.27)*growth*.065*uLegacy;
    if(uRefined>.5) {
      // A local shoulder preserves variation in the radiance instead of clipping white.
      float l=dot(color,vec3(.2126,.7152,.0722));
      color*=1./(1.+max(0.,l-1.8)*.18);
    }
    gl_FragColor = vec4(color,1.);
  }
`;

export const floorFragment = /* glsl */ `
  ${lightResponse}
  uniform float uTime;
  uniform float uLiving;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uBeacon;
  uniform float uBeamWidth;
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
    if(uLiving>.5) {
      float radial = r*2.1-uPhase*.9;
      float ring=1.-smoothstep(.025+fwidth(radial),.08+fwidth(radial),abs(sin(radial)));
      float spokes=pow(.5+.5*cos(angle*6.+sin(r*.45-uPhase*.2)*.25),22.);
      vec3 bed=vec3(.009,.019,.028)+uTint*exp(-r*.35)*uEnergy*.16;
      bed+=uTint*uEnergy*(ring*.13*exp(-r*.14)+spokes*.12*exp(-r*.12));
      float focus=exp(-r*r*.28)*uEnergy;
      bed+=vec3(.5,.8,1.)*focus*.8;
      if(uRefined>.5) {
        float wavefront=responseWave(r,uTime);
        bed=vec3(.006,.012,.018)+uTint*exp(-r*.12)*.025;
        bed+=uTint*(wavefront*.8+spokes*.025*exp(-r*.14))*uEnergy;
      }
      stone=bed;
    }
    gl_FragColor = vec4(stone,1.);
  }
`;
export const backdropFragment = /* glsl */ `
  ${lightResponse}
  uniform float uTime;
  uniform float uLiving;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uBeacon;
  uniform float uBeamWidth;
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
    if(uLiving>.5) {
      float echo=exp(-pow((y-6.2)*.16,2.));
      color=vec3(.009,.021,.034)+uTint*uEnergy*echo*(.045+.045*broad);
      color+=uTint*uEnergy*pow(.5+.5*cos(a*6.-uPhase*.16),12.)*.075*echo;
      if(uRefined>.5) color+=uTint*uFlash*.055*echo;
    }
    gl_FragColor = vec4(color,1.);
  }
`;
export const particleVertex = /* glsl */ `
  ${lightResponse}
  uniform float uTime;
  uniform float uLiving;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uBeacon;
  uniform float uBeamWidth;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime*.09+aSeed*40.)*.7;
    p.y = mod(p.y+uTime*(.045+aSeed*.08),16.);
    p.z += cos(uTime*.07+aSeed*23.)*.7;
    if(uLiving>.5) {
      float a=aSeed*218.+uPhase*.055;
      float r=2.5+mod(aSeed*37.,1.)*8.5;
      p=vec3(cos(a)*r,mod(position.y+uPhase*(.22+aSeed*.13),24.),sin(a)*r);
    }
    vec4 mv = modelViewMatrix*vec4(p,1.);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp((18.+aSeed*35.)/-mv.z,1.,4.)*uPixelRatio;
    vAlpha = (.3+.7*aSeed)*(1.-smoothstep(10.,60.,-mv.z));
    if(uRefined>.5) vAlpha*=1.+responseWave(length(p.xz),uTime)*2.;
    if(uLiving>.5) vAlpha*=clamp(uEnergy*.65,.1,1.)*exp(-length(p.xz)*.055)*(1.-smoothstep(15.,24.,p.y));
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

export const resonanceFragment = /* glsl */ `
 ${lightResponse}
 uniform float uTime;
 uniform float uEnergy;
 uniform float uPhase;
 uniform vec3 uTint;
 varying vec3 vWorld;
 void main() {
   float a=atan(vWorld.z,vWorld.x);
   float h=.4+.6*exp(-abs(vWorld.y-6.2)*.13);
   float crest=pow(.5+.5*cos(a-uPhase*.32+vWorld.y*.09),18.);
   vec3 light=mix(vec3(.3,.64,.82),uTint,.5)*uEnergy*(.32+crest*2.4)*h;
   if(uRefined>.5) light=mix(vec3(.22,.4,.5),uTint,.5)*uEnergy*(.22+crest*.7+responseWave(length(vWorld.xz),uTime)*2.5)*h;
   gl_FragColor=vec4(light,1.);
 }
`;
export const beaconFragment = /* glsl */ `
 ${lightResponse}
 uniform mat4 uInverseBeam;
 uniform float uEnergy;
 uniform float uPhase;
 uniform float uBeamWidth;
 uniform vec3 uTint;
 varying vec3 vLocal;
 void main() {
   vec3 ro=(uInverseBeam*vec4(cameraPosition,1.)).xyz;
   vec3 rd=normalize(vLocal-ro);
   float a=dot(rd.xz,rd.xz),b=dot(ro.xz,rd.xz),c=dot(ro.xz,ro.xz)-12.96;
   float lo=0.,hi=1e5;
   if(a<1e-7) { if(c>0.) discard; }
   else {
     float disc=b*b-a*c;if(disc<0.) discard;
     lo=max(lo,(-b-sqrt(disc))/a);hi=min(hi,(-b+sqrt(disc))/a);
   }
   if(abs(rd.y)<1e-7) { if(abs(ro.y)>14.) discard; }
   else {float l=(-14.-ro.y)/rd.y,h=(14.-ro.y)/rd.y;lo=max(lo,min(l,h));hi=min(hi,max(l,h));}
   if(hi<=lo) discard;
   float steps=uRefined>.5?64.:40.;
   float ds=(hi-lo)/steps,T=1.; vec3 light=vec3(0.);
   for(int i=0;i<64;i++) {
     if(float(i)>=steps) break;
     vec3 p=ro+rd*(lo+(float(i)+.5)*ds);
     float h=p.y+14.;
     float w=uBeamWidth*(.55+h*.018);
     float r=length(p.xz);
     float density=exp(-r*r/(w*w))*.85+exp(-r*r/(w*w*6.))*.055;
     if(uRefined>.5) {
       float shell=exp(-pow((r-w*1.8)/(w*.24),2.));
       density=exp(-r*r/(w*w*.48))*1.45+shell*.095+exp(-r*r/(w*w*6.))*.018;
       density*=1.+uFlash*.18;
     }
     density*=smoothstep(0.,.35,h)*(1.-smoothstep(18.,28.,h));
     density*=.94+.06*sin(h*.65-uPhase*.55);
     float alpha=1.-exp(-density*ds*.32);
     vec3 color=mix(vec3(.65,.88,1.),uTint,.22);
     light+=T*alpha*color*uEnergy*3.8;
     T*=1.-alpha;
   }
   gl_FragColor=vec4(light,1.-T);
 }
`;

// Linear HDR planar reflection: OutputPass performs the sole final tone mapping.
export const receiverVertex = /* glsl */ `
 uniform mat4 textureMatrix;
 varying vec4 vUv;
 varying vec3 vWorld;
 void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const receiverFragment = /* glsl */ `
 ${lightResponse}
 uniform float uTime;
 uniform float uEnergy;
 uniform vec3 uTint;
 uniform sampler2D tDiffuse;
 varying vec4 vUv;
 varying vec3 vWorld;
 void main(){
   float r=length(vWorld.xz);
   vec3 V=normalize(cameraPosition-vWorld);
   float fresnel=.22+.4*pow(1.-abs(V.y),5.);
   vec3 reflected=texture2DProj(tDiffuse,vUv).rgb;
   float groove=1.-smoothstep(.018,.018+max(fwidth(r),.008),abs(r-4.85));
   float wave=responseWave(r,uTime);
   vec3 color=vec3(.008,.016,.022)+reflected*fresnel;
   color+=uTint*uEnergy*(wave*.75+groove*.25+exp(-r*r*.35)*.08);
   gl_FragColor=vec4(color,1.);
 }
`;
