// A single cloth of glyphs changes topology with the selected research operation.
// Rendering is local to a reserved area, so the notes next to it never move.
const ramp=' .:-=+*#';
const clamp=x=>Math.min(1,Math.max(0,x));
const fields = [
  (x,y,t)=>Math.exp(-Math.pow((y - .48 - .15*Math.sin(x*12+t*.6) - .07*Math.sin(x*29-t*.8))/.12,2))*(.38+.62*Math.pow(Math.sin(x*18+y*7),2)),
  (x,y,t)=>{const a=Math.abs((x*5.4+Math.sin(t*.6)*.1)%1-.5),b=Math.abs((y*3.8+x*.8)%1-.5);return Math.max(Math.exp(-Math.pow((a-.29)/.07,2))*.70,Math.exp(-Math.pow((b-.29)/.10,2))*.68)*clamp(1.25-Math.hypot(x-.5,(y-.5)*1.25));},
  (x,y,t)=>{const center=.67-.34*Math.sin(x*3.1);const d=Math.min(Math.abs(y-center),Math.abs(y-center-.105*Math.cos(x*8+t*.4)));return Math.exp(-Math.pow(d/.065,2))*(.6+.4*Math.sin(x*17)**2);},
  (x,y,t)=>{const u=x-.5,v=y-.5;const axis=v+u*.33;const cycle=(axis+.8)*6;return Math.exp(-Math.pow((cycle-Math.round(cycle))/.18,2))*clamp(1.9-Math.abs(u)*3.8-Math.abs(v)*.7)*(.65+.25*Math.sin(x*6+t*.55));},
];
export function plateFrame(stage, time, previous=stage, mix=1, narrow=false){
  const cols=narrow?44:88, rows=narrow?13:17;
  const lines=[];
  for(let row=0;row<rows;row++){
    let line='';
    for(let col=0;col<cols;col++){
      const x=col/(cols-1),y=row/(rows-1);
      const blend=clamp((mix-.30*x)/.70);
      const edge=clamp(x*12)*clamp((1-x)*12)*clamp(y*7)*clamp((1-y)*7);
      const density=((1-blend)*fields[previous](x,y,time)+blend*fields[stage](x,y,time))*edge;
      line+=ramp[Math.round(clamp(density)*7)];
    }
    lines.push(line);
  }
  return lines.join('\n');
}
export function medalFrame(selection,time){
  const lines=[];
  for(let row=0;row<17;row++){
    let line='';
    for(let col=0;col<58;col++){
      let value=0;
      for(let i=0;i<3;i++){
        const x=(col-(11+i*17))/9.5,y=(row-(i===1?6.2:7.2))/5.5;
        const angle=Math.atan2(y,x),radius=Math.hypot(x,y),rim=1+.04*Math.cos(angle*12);
        const band=Math.min(Math.abs(radius-rim),Math.abs(radius-.77),Math.abs(radius-.45));
        const arc=clamp(1-band*6.5);
        const ribbon=y>.83&&y<1.45&&Math.abs(Math.abs(x)-(.23+.22*(y-.83)))<.11;
        const light=.56+.39*Math.sin(angle+time*.7+i)**2;
        value=Math.max(value,(ribbon?.85:arc)*light*(i===selection?1:.55));
      }
      line+=ramp[Math.floor(clamp(value)*7+.45)];
    }
    lines.push(line);
  }
  return lines.join('\n');
}
