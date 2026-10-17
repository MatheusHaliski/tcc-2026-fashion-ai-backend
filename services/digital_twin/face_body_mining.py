"""Search licensed/consented 3-D assets, never scrape a gallery of people's identities."""
import numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import csr_matrix,eye
from scipy.sparse.linalg import spsolve


def closest_mesh_matches(query_embedding,assets,limit=5):
    query=np.asarray(query_embedding,float)
    if query.ndim!=1 or not np.isfinite(query).all() or np.linalg.norm(query)<1e-9:raise ValueError('INVALID_SHAPE_EMBEDDING')
    candidates=[]
    for asset in assets:
        if not asset.get('rights_cleared') or not asset.get('license'):continue
        vector=np.asarray(asset['shape_embedding'],float)
        if vector.shape!=query.shape or not np.isfinite(vector).all() or np.linalg.norm(vector)<1e-9:continue
        similarity=float(query@vector/(np.linalg.norm(query)*np.linalg.norm(vector)))
        candidates.append({'asset_id':asset['asset_id'],'similarity':similarity})
    return sorted(candidates,key=lambda row:-row['similarity'])[:max(1,min(limit,20))]


def non_rigid_icp(vertices,target_points,faces,*,iterations=8,max_displacement_m=.005):
    vertices=np.asarray(vertices,float);target=np.asarray(target_points,float);faces=np.asarray(faces,int)
    if vertices.ndim!=2 or vertices.shape[1]!=3 or target.ndim!=2 or target.shape[1]!=3 or not np.isfinite(vertices).all() or not np.isfinite(target).all() or not len(target) or faces.ndim!=2 or faces.shape[1]!=3 or faces.min()<0 or faces.max()>=len(vertices):raise ValueError('INVALID_REGISTRATION_MESH')
    edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]);edges=np.r_[edges,edges[:,::-1]]
    adjacency=csr_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(len(vertices),len(vertices)))
    degree=np.asarray(adjacency.sum(axis=1)).ravel();laplacian=csr_matrix(np.diag(degree))-adjacency if len(vertices)<100 else __import__('scipy').sparse.diags(degree)-adjacency
    system=eye(len(vertices),format='csr')+laplacian.T@laplacian*.2
    result=vertices.copy();tree=cKDTree(target)
    for _ in range(min(max(iterations,1),30)):
        _,nearest=tree.query(result);delta=target[nearest]-result
        length=np.linalg.norm(delta,axis=1,keepdims=True);delta*=np.minimum(1,max_displacement_m/np.maximum(length,1e-9))
        for axis in range(3):result[:,axis]+=spsolve(system,delta[:,axis])*.5
    return result,{'nearestSurfaceErrorM':float(tree.query(result)[0].mean()),'identityFidelityCertified':False}
