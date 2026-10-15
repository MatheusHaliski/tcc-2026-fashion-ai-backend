"""Measurement-constrained fitting of a supplied SMPL-X/STAR shape backend."""
from dataclasses import dataclass
from typing import Protocol
import numpy as np
from scipy.optimize import least_squares


@dataclass(frozen=True)
class BodyMeasurements:
    height_cm:float
    weight_kg:float
    belly_circumference_cm:float
    def validate(self):
        values=np.array([self.height_cm,self.weight_kg,self.belly_circumference_cm])
        if not np.isfinite(values).all() or not 45<=self.height_cm<=260 or not 3<=self.weight_kg<=500 or not 20<=self.belly_circumference_cm<=300:raise ValueError('INVALID_BODY_MEASUREMENTS')


class BodyShapeBackend(Protocol):
    beta_count:int
    mass_model_calibrated:bool
    def measurements(self,betas:np.ndarray,scale:float)->np.ndarray:
        """Return height cm, calibrated mass estimate kg, abdomen circumference cm."""
    def mesh(self,betas:np.ndarray,scale:float)->dict:
        """Return model-owned vertices/faces/rig in metres, with matching topology."""


class ParametricBodyFitting:
    def __init__(self,backend:BodyShapeBackend|None):self.backend=backend
    def fit(self,measurements:BodyMeasurements):
        measurements.validate()
        if self.backend is None:raise RuntimeError('SMPLX_OR_STAR_MODEL_NOT_CONFIGURED')
        if not self.backend.mass_model_calibrated:raise RuntimeError('CALIBRATED_MASS_MODEL_REQUIRED_NO_BMI_TO_BETA_SHORTCUT')
        n=self.backend.beta_count
        if not 1<=n<=64:raise ValueError('INVALID_BODY_SHAPE_DIMENSION')
        target=np.array([measurements.height_cm,measurements.weight_kg,measurements.belly_circumference_cm])
        tolerances=np.array([.5,2.,1.])
        def residual(parameters):
            predicted=np.asarray(self.backend.measurements(parameters[:n],parameters[-1]),float)
            if predicted.shape!=(3,) or not np.isfinite(predicted).all():raise ValueError('INVALID_BODY_MODEL_MEASUREMENTS')
            # Three measures do not identify a unique body; regularize the rest.
            return np.r_[(predicted-target)/tolerances,parameters[:n]*.03]
        result=least_squares(residual,np.r_[np.zeros(n),1.],bounds=(np.r_[np.full(n,-3.),.5],np.r_[np.full(n,3.),2.]),max_nfev=150)
        predicted=np.asarray(self.backend.measurements(result.x[:n],result.x[-1]),float)
        if not result.success or np.any(np.abs(predicted-target)>tolerances):raise ValueError('BODY_FIT_OUTSIDE_MEASUREMENT_TOLERANCE')
        mesh=self.backend.mesh(result.x[:n],result.x[-1])
        vertices=np.asarray(mesh['vertices'],float)
        if vertices.ndim!=2 or vertices.shape[1]!=3 or not np.isfinite(vertices).all():raise ValueError('INVALID_FITTED_BODY_MESH')
        return {'mesh':mesh,'betas':result.x[:n].tolist(),'scale':float(result.x[-1]),
                'requested':target.tolist(),'estimatedMeasurements':predicted.tolist(),
                'residuals':(predicted-target).tolist(),'millimetricFidelityCertified':False,
                'note':'Weight/shape distribution is model-dependent; input measurements do not uniquely determine anatomy.'}
