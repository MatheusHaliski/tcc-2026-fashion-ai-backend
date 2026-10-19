"""Torch fitting orchestrator. FLAME weights, 478 mapping, detector and UV baker are injected."""
try:
    import torch
    _Base=torch.nn.Module
except ImportError:
    torch=None
    _Base=object


class FaceMeshAndTextureExtractor(_Base):
    def __init__(self,detector,flame_model,landmark_vertex_indices,texture_baker,device='cpu'):
        if torch is None:raise RuntimeError('PYTORCH_NOT_INSTALLED')
        super().__init__()
        if detector is None or flame_model is None or texture_baker is None:raise RuntimeError('LICENSED_FACE_MODELS_AND_UV_BAKER_REQUIRED')
        self.detector=detector;self.flame=flame_model;self.baker=texture_baker;self.device=device
        indexes=torch.as_tensor(landmark_vertex_indices,dtype=torch.long,device=device)
        if indexes.shape!=(478,) or indexes.min()<0:raise ValueError('FLAME_TO_478_VERTEX_MAPPING_REQUIRED')
        self.register_buffer('landmark_indices',indexes)

    def forward(self,image,intrinsics,iterations=150):
        if image.ndim!=4 or image.shape[0]!=1 or image.shape[1]!=3 or not torch.isfinite(image).all() or image.min()<0 or image.max()>1:raise ValueError('EXPECTED_ONE_NORMALIZED_RGB_IMAGE')
        if not 1<=iterations<=300:raise ValueError('INVALID_FACE_FITTING_BUDGET')
        observed=self.detector(image)
        points=observed['landmarks_px'].detach();confidence=observed['confidence'].detach()
        if points.shape!=(478,2) or confidence.shape!=(478,) or (confidence<.8).any():raise ValueError('INSUFFICIENT_FACE_LANDMARK_EVIDENCE')
        k=torch.as_tensor(intrinsics,dtype=image.dtype,device=self.device)
        if k.shape!=(3,3) or not torch.isfinite(k).all() or k[0,0]<=0 or k[1,1]<=0:raise ValueError('INVALID_CAMERA_INTRINSICS')
        betas=torch.zeros((1,self.flame.shape_dimension),device=self.device,requires_grad=True)
        expression=torch.zeros((1,self.flame.expression_dimension),device=self.device,requires_grad=True)
        translation=torch.tensor([[0.,0.,.6]],device=self.device,requires_grad=True)
        optimizer=torch.optim.Adam([betas,expression,translation],lr=.005)
        for _ in range(iterations):
            optimizer.zero_grad();vertices=self.flame(betas,expression)
            samples=vertices[0,self.landmark_indices]+translation
            if (samples[:,2]<=.02).any():raise ValueError('FACE_BEHIND_CAMERA')
            projected=samples@k.T;projected=projected[:,:2]/projected[:,2:3]
            error=(projected-points).square().sum(dim=1)
            loss=(error*confidence).mean()+betas.square().mean()*.02+expression.square().mean()*.05
            if not torch.isfinite(loss):raise ValueError('FACE_FITTING_DIVERGED')
            loss.backward();optimizer.step()
        vertices=self.flame(betas,expression).detach()
        # The baker must return observed coverage. Upsampling to 4K cannot recover
        # pores, hidden skin, ears or hair from an ordinary photograph.
        baked=self.baker(image,vertices,self.flame.faces,self.flame.uv,k,translation.detach(),resolution=4096)
        if baked['texture'].shape!=(1,3,4096,4096) or baked['observed_mask'].shape!=(1,1,4096,4096):raise ValueError('INVALID_4K_UV_BAKE')
        if not torch.isfinite(baked['texture']).all():raise ValueError('INVALID_UV_TEXTURE')
        return {'vertices':vertices,'faces':self.flame.faces,'texture':baked['texture'],
                'observedMask':baked['observed_mask'],'landmarkErrorPx':float(error.sqrt().mean().detach()),
                'precisionSpace':'MONOCULAR_PROJECTED_2D_FIT','millimetricFidelityCertified':False}


UltraRealisticFaceReconstruction=FaceMeshAndTextureExtractor
