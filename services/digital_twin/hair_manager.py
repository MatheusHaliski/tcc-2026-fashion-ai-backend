"""Individual Torch strands, constrained PBD and strand export; not a hair-card engine."""
from dataclasses import dataclass
import math
import numpy as np
from .cleanup_hair_artifacts import smooth_disconnected_strands,optimize_ear_neck_collision,align_neckline_cut

TEXTURES={
 '1A':(0.,.08),'1B':(.0008,.10),'1C':(.0015,.09),
 '2A':(.004,.09),'2B':(.007,.07),'2C':(.010,.05),
 '3A':(.012,.06),'3B':(.009,.035),'3C':(.006,.020),
 '4A':(.004,.014),'4B':(.003,.010),'4C':(.0025,.006)}

@dataclass(frozen=True)
class HairParameters:
    texture:str='2B'
    strand_count:int=8000
    segments:int=16
    length_m:float=.25
    radius_m:float=.00004
    color_rgb:tuple=(.08,.035,.015)
    seed:int=23


class UltraRealisticHairManager:
    """Requires Torch and a calibrated scalp mesh in metres. No pretrained model is bundled."""
    def __init__(self,scalp_vertices,scalp_faces,parameters=HairParameters(),device='cpu',guide_strands=None):
        import torch
        self.torch=torch;self.device=device;self.parameters=parameters;p=parameters
        if p.texture not in TEXTURES or not 1<=p.strand_count<=100000 or not 3<=p.segments<=64 or not .001<=p.length_m<=1.5 or not .00001<=p.radius_m<=.00015:raise ValueError('INVALID_HAIR_PARAMETERS')
        if len(p.color_rgb)!=3 or not all(0<=v<=1 for v in p.color_rgb):raise ValueError('INVALID_HAIR_COLOR')
        vertices=torch.as_tensor(scalp_vertices,dtype=torch.float32,device=device);faces=torch.as_tensor(scalp_faces,dtype=torch.long,device=device)
        if vertices.ndim!=2 or vertices.shape[1]!=3 or faces.ndim!=2 or faces.shape[1]!=3 or not torch.isfinite(vertices).all() or faces.numel()==0 or faces.min()<0 or faces.max()>=len(vertices):raise ValueError('INVALID_SCALP_MESH')
        generator=torch.Generator(device=device).manual_seed(p.seed);triangles=vertices[faces]
        normals=torch.linalg.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]);areas=normals.norm(dim=1)
        if areas.sum()<=1e-10:raise ValueError('DEGENERATE_SCALP')
        selected=torch.multinomial(areas,p.strand_count,replacement=True,generator=generator)
        r=torch.rand((p.strand_count,2),device=device,generator=generator);u=torch.sqrt(r[:,0]);v=r[:,1]
        bary=torch.stack([1-u,u*(1-v),u*v],dim=1)
        self.roots=(triangles[selected]*bary[:,:,None]).sum(dim=1)
        outward=normals[selected]/areas[selected,None].clamp_min(1e-8)
        t=torch.linspace(0,1,p.segments+1,device=device)[None,:,None]
        if guide_strands is not None:
            guides=torch.as_tensor(guide_strands,dtype=torch.float32,device=device)
            if guides.shape!=(p.strand_count,p.segments+1,3):raise ValueError('GUIDE_COUNT_OR_SAMPLING_MISMATCH')
            points=guides+(self.roots-guides[:,0])[:,None,:]
        else:
            # Free strands only. Braids/locs/knots require their own guide topology.
            down=torch.tensor([0.,-1.,0.],device=device)
            direction=outward[:,None,:]*(1-t*.8)+down[None,None,:]*t*1.4
            direction=direction/direction.norm(dim=2,keepdim=True).clamp_min(1e-8)
            points=self.roots[:,None,:]+direction*(t*p.length_m)
            amplitude,wavelength=TEXTURES[p.texture]
            phase=torch.rand((p.strand_count,1,1),device=device,generator=generator)*math.tau
            argument=t*(p.length_m/wavelength)*math.tau+phase
            wave=torch.sin(argument)
            if p.texture=='4B':wave=2/math.pi*torch.asin(torch.sin(argument).clamp(-.999,.999))
            if p.texture=='4C':wave=(torch.sin(argument)+.5*torch.sin(argument*1.71)+.25*torch.sin(argument*2.37))/1.75
            points[:,:,0:1]+=amplitude*t*wave
            points[:,:,2:3]+=amplitude*t*torch.cos(argument)
        self.positions=points;self.positions[:,0]=self.roots;self.previous=points.clone()
        self.rest=(points[:,1:]-points[:,:-1]).norm(dim=2,keepdim=True)
        self.rest_positions=points.clone();self.active_segments=np.full(p.strand_count,p.segments)

    def simulate(self,delta_seconds,wind=(0.,0.,0.),colliders=(),root_positions=None):
        torch=self.torch;dt=min(max(float(delta_seconds),0),.1)
        if not math.isfinite(dt) or not np.isfinite(wind).all():raise ValueError('INVALID_SIMULATION_INPUT')
        if root_positions is not None:
            roots=torch.as_tensor(root_positions,dtype=torch.float32,device=self.device)
            if roots.shape!=self.roots.shape or not torch.isfinite(roots).all():raise ValueError('INVALID_MOVING_ROOTS')
            displacement=roots-self.roots;self.positions+=displacement[:,None,:];self.previous+=displacement[:,None,:];self.roots=roots
        if dt==0:return
        steps=max(1,math.ceil(dt/(1/60)));h=dt/steps
        acceleration=torch.tensor(wind,dtype=torch.float32,device=self.device)+torch.tensor([0.,-9.81,0.],device=self.device)
        for _ in range(steps):
            old=self.positions.clone();velocity=(self.positions-self.previous)*.96
            self.positions+=velocity+acceleration*h*h;self.previous=old
            for _ in range(8):
                for parity in (0,1):
                    indexes=torch.arange(parity,self.parameters.segments,2,device=self.device)
                    a=self.positions[:,indexes];b=self.positions[:,indexes+1];delta=b-a;length=delta.norm(dim=2,keepdim=True).clamp_min(1e-8)
                    correction=delta*(length-self.rest[:,indexes])/length
                    movable=(indexes!=0).to(torch.float32)[None,:,None]
                    self.positions[:,indexes]+=correction*.5*movable
                    self.positions[:,indexes+1]-=correction*(1-.5*movable)
                for collider in colliders:self._project_capsule(collider)
                self.positions[:,0]=self.roots
        if not torch.isfinite(self.positions).all():raise ValueError('HAIR_SIMULATION_DIVERGED')

    def _project_capsule(self,collider):
        torch=self.torch;a=torch.as_tensor(collider['a'],device=self.device);b=torch.as_tensor(collider['b'],device=self.device)
        radius=float(collider['radius'])+.0005
        if not math.isfinite(radius) or radius<=0:raise ValueError('INVALID_COLLIDER')
        axis=b-a;weight=((self.positions-a)*axis).sum(dim=2,keepdim=True)/axis.square().sum().clamp_min(1e-9)
        center=a+weight.clamp(0,1)*axis;delta=self.positions-center;distance=delta.norm(dim=2,keepdim=True)
        direction=delta/distance.clamp_min(1e-9)
        fallback=torch.zeros_like(direction);fallback[:,:,0]=1
        direction=torch.where(distance>1e-9,direction,fallback)
        self.positions=torch.where(distance<radius,center+direction*radius,self.positions)

    def cleanup(self,colliders=(),nape_cut=None,intended_guides=None):
        data=self.positions.detach().cpu().numpy();roots=self.roots.detach().cpu().numpy()
        data,root_report=smooth_disconnected_strands(data,roots,intended_guides=intended_guides)
        data,collision_report=optimize_ear_neck_collision(data,roots,colliders)
        if nape_cut:data,self.active_segments=align_neckline_cut(data,roots,**nape_cut)
        self.positions=self.torch.as_tensor(data,dtype=self.torch.float32,device=self.device);self.previous=self.positions.clone()
        return {**root_report,**collision_report,'strandCount':len(data),'geometry':'INDIVIDUAL_STRANDS'}

    def export(self):
        return {'positions':self.positions.detach().cpu().numpy().tolist(),'activeSegments':self.active_segments.tolist(),
                'radiusM':self.parameters.radius_m,'color':self.parameters.color_rgb,'texture':self.parameters.texture,
                'geometry':'INDIVIDUAL_STRANDS','shadingModel':'R_TT_TRT_REALTIME_APPROXIMATION','precisionCertified':False}
