"""Rosto do retrato estilizado: detecção (SCRFD) e identidade (ArcFace) do pacote antelopev2 da InsightFace.

Os modelos ONNX rodam na CPU (onnxruntime), para não disputar a T4 com a FASHN e o SDXL. A matemática (decodificação do
SCRFD, NMS, transformação de semelhança e enquadramento) é numpy puro; o OpenCV só entra para recortar e redimensionar.
O InstantID foi treinado com o vetor de identidade do glintr100 (antelopev2): outro reconhecedor muda o espaço do vetor.
"""
import numpy as np
from .models import AlignmentError

DET_SIZE=640
DET_THRESHOLD=.5
NMS_THRESHOLD=.4
STRIDES=(8,16,32)
ANCHORS_PER_CELL=2
MIN_FACE_PX=96
# Um segundo rosto com pelo menos 25% da área do maior torna ambíguo de quem é o retrato.
SECOND_FACE_RATIO=.25
# Olhos, ponta do nariz e cantos da boca no recorte 112x112 do ArcFace (InsightFace, arcface_dst).
ARCFACE_TEMPLATE=np.array([[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]])


def anchor_centers(stride,size=DET_SIZE,per_cell=ANCHORS_PER_CELL):
    cells=size//stride
    ys,xs=np.mgrid[:cells,:cells]
    centers=(np.stack([xs,ys],axis=-1).reshape(-1,2)*stride).astype(np.float32)
    return np.repeat(centers,per_cell,axis=0)


def decode_scrfd(outputs,threshold=DET_THRESHOLD,size=DET_SIZE):
    """Saídas do scrfd_10g_bnkps (3 escalas x pontuação, caixa e 5 pontos) -> caixas [x0,y0,x1,y1,score] e pontos."""
    count=len(STRIDES)
    if len(outputs)!=3*count:raise AlignmentError('INVALID_FACE_DETECTOR_OUTPUT')
    boxes,points=[],[]
    for index,stride in enumerate(STRIDES):
        scores=np.asarray(outputs[index],np.float32).reshape(-1)
        deltas=np.asarray(outputs[index+count],np.float32).reshape(-1,4)*stride
        kps=np.asarray(outputs[index+2*count],np.float32).reshape(-1,10)*stride
        centers=anchor_centers(stride,size)
        if not len(scores)==len(deltas)==len(kps)==len(centers):raise AlignmentError('INVALID_FACE_DETECTOR_OUTPUT')
        keep=scores>=threshold
        if not keep.any():continue
        c=centers[keep];d=deltas[keep];k=kps[keep]
        boxes.append(np.column_stack([c[:,0]-d[:,0],c[:,1]-d[:,1],c[:,0]+d[:,2],c[:,1]+d[:,3],scores[keep]]))
        points.append((np.repeat(c,5,axis=0).reshape(-1,5,2)+k.reshape(-1,5,2)))
    if not boxes:return np.empty((0,5),np.float32),np.empty((0,5,2),np.float32)
    return np.concatenate(boxes),np.concatenate(points)


def nms(boxes,threshold=NMS_THRESHOLD):
    order=np.argsort(-boxes[:,4]);keep=[]
    areas=np.maximum(0,boxes[:,2]-boxes[:,0])*np.maximum(0,boxes[:,3]-boxes[:,1])
    while order.size:
        best=order[0];keep.append(best)
        xx0=np.maximum(boxes[best,0],boxes[order[1:],0]);yy0=np.maximum(boxes[best,1],boxes[order[1:],1])
        xx1=np.minimum(boxes[best,2],boxes[order[1:],2]);yy1=np.minimum(boxes[best,3],boxes[order[1:],3])
        inter=np.maximum(0,xx1-xx0)*np.maximum(0,yy1-yy0)
        overlap=inter/np.maximum(areas[best]+areas[order[1:]]-inter,1e-9)
        order=order[1:][overlap<=threshold]
    return np.asarray(keep,int)


def only_face(boxes,points):
    """O rosto do retrato: exatamente um rosto claro e grande o bastante; nunca adivinha entre duas pessoas."""
    if len(boxes)==0:raise AlignmentError('FACE_NOT_FOUND')
    areas=(boxes[:,2]-boxes[:,0])*(boxes[:,3]-boxes[:,1])
    order=np.argsort(-areas)
    if len(order)>1 and areas[order[1]]>=SECOND_FACE_RATIO*areas[order[0]]:raise AlignmentError('MULTIPLE_FACES_REJECTED')
    best=order[0]
    if min(boxes[best,2]-boxes[best,0],boxes[best,3]-boxes[best,1])<MIN_FACE_PX:raise AlignmentError('FACE_TOO_SMALL')
    return boxes[best],points[best]


def similarity_transform(source,target):
    """Rotação + escala uniforme + translação (Umeyama) que leva `source` a `target`, como matriz 2x3."""
    source=np.asarray(source,float);target=np.asarray(target,float)
    ms,mt=source.mean(0),target.mean(0)
    s,t=source-ms,target-mt
    variance=(s**2).sum()/len(s)
    if variance<=1e-9:raise AlignmentError('DEGENERATE_FACE_LANDMARKS')
    covariance=t.T@s/len(s)
    u,d,vt=np.linalg.svd(covariance)
    sign=np.eye(2)
    if np.linalg.det(u)*np.linalg.det(vt)<0:sign[1,1]=-1
    rotation=u@sign@vt
    scale=np.trace(np.diag(d)@sign)/variance
    matrix=np.zeros((2,3));matrix[:,:2]=scale*rotation;matrix[:,2]=mt-scale*rotation@ms
    return matrix


def apply(matrix,points):
    points=np.asarray(points,float)
    return points@matrix[:,:2].T+matrix[:,2]


def portrait_keypoints(kps,size,eye_to_mouth=.11,nose_height=.40):
    """Os 5 pontos da pessoa levados ao enquadramento de busto do retrato (largura, altura).

    A semelhança tira só pose, posição e escala: as proporções do rosto (distância entre os olhos, nariz, boca) ficam as
    da foto, e é delas que o ControlNet do InstantID tira a geometria do rosto gerado."""
    width,height=size
    template=ARCFACE_TEMPLATE
    scale=eye_to_mouth*height/(template[3:,1].mean()-template[:2,1].mean())
    target=(template-template[2])*scale+np.array([width/2,nose_height*height])
    placed=apply(similarity_transform(kps,target),kps)
    if np.any(placed<0) or np.any(placed[:,0]>width) or np.any(placed[:,1]>height):raise AlignmentError('DEGENERATE_FACE_LANDMARKS')
    return placed


def cosine(a,b):
    a=np.asarray(a,float).reshape(-1);b=np.asarray(b,float).reshape(-1)
    norm=np.linalg.norm(a)*np.linalg.norm(b)
    if a.shape!=b.shape or not np.isfinite(norm) or norm<=0:raise AlignmentError('INVALID_FACE_EMBEDDING')
    return float(a@b/norm)


class FaceIdentity:
    """SCRFD + glintr100 em onnxruntime (CPU). `analyze(rgb)` -> (caixa, 5 pontos, vetor de identidade bruto)."""

    def __init__(self,detector_path,recognizer_path):
        import onnxruntime as ort
        options=ort.SessionOptions();options.log_severity_level=3
        self.detector=ort.InferenceSession(str(detector_path),options,providers=['CPUExecutionProvider'])
        self.recognizer=ort.InferenceSession(str(recognizer_path),options,providers=['CPUExecutionProvider'])
        shape=self.recognizer.get_inputs()[0].shape
        if list(shape[2:])!=[112,112]:raise AlignmentError('UNEXPECTED_FACE_RECOGNIZER')

    def detect(self,rgb):
        import cv2
        height,width=rgb.shape[:2]
        ratio=min(DET_SIZE/width,DET_SIZE/height)
        resized=cv2.resize(rgb,(max(1,round(width*ratio)),max(1,round(height*ratio))))
        canvas=np.zeros((DET_SIZE,DET_SIZE,3),np.uint8);canvas[:resized.shape[0],:resized.shape[1]]=resized
        # Como o blobFromImage(swapRB=True) da InsightFace sobre BGR: o SCRFD recebe RGB, média 127,5 e escala 1/128.
        blob=((canvas.astype(np.float32)-127.5)/128.).transpose(2,0,1)[None]
        outputs=self.detector.run(None,{self.detector.get_inputs()[0].name:blob})
        boxes,points=decode_scrfd(outputs)
        if len(boxes):
            keep=nms(boxes);boxes=boxes[keep].copy();points=points[keep].copy()
            boxes[:,:4]/=ratio;points/=ratio
        return only_face(boxes,points)

    def embed(self,rgb,kps):
        import cv2
        crop=cv2.warpAffine(rgb,similarity_transform(kps,ARCFACE_TEMPLATE),(112,112),borderValue=0)
        blob=((crop.astype(np.float32)-127.5)/127.5).transpose(2,0,1)[None]  # RGB, como o get_feat da InsightFace
        vector=np.asarray(self.recognizer.run(None,{self.recognizer.get_inputs()[0].name:blob})[0],np.float32).reshape(-1)
        if vector.shape!=(512,) or not np.isfinite(vector).all():raise AlignmentError('INVALID_FACE_EMBEDDING')
        return vector

    def analyze(self,rgb):
        box,kps=self.detect(rgb)
        return box,kps,self.embed(rgb,kps)
