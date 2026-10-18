"use client";
import {PrivateMotionVideo} from "./atelier/private-motion-video";
import { ArtVideo } from "@/components/card-art";
import { mediaUrl } from "@/lib/api/client";
import { safeMediaUrl } from "@/lib/fashion-card/types";

/** Only server-issued, owner-bound media is rendered; background edits cannot mint it. */
export function impersonationMedia(background:Record<string,unknown>|undefined,ownerId:string){
 if(background?.auraImpersonation!==true)return null;
 const data=background.impersonationData;
 if(!data||typeof data!=="object")return null;
 const value=data as Record<string,unknown>;
 if(value.status!=="READY"||value.ownerId!==ownerId||value.renderedMediaType!=="video/mp4"||typeof value.renderedCardMediaUrl!=="string"||!safeMediaUrl(value.renderedCardMediaUrl))return null;
 return {src:value.renderedCardMediaUrl,jobId:typeof value.jobId==="string"?value.jobId:undefined,poster:typeof value.posterUrl==="string"&&safeMediaUrl(value.posterUrl)?value.posterUrl:undefined};
}
export function ImpersonationMedia({background,ownerId}:{background:Record<string,unknown>|undefined;ownerId:string}){
 const clip=impersonationMedia(background,ownerId);if(clip&&(clip.src.startsWith("/api/me/aura-impersonation/")||/^\/api\/pieces\/[^/]+\/aura-media\//.test(clip.src))&&clip.jobId)return <PrivateMotionVideo key={clip.jobId} jobId={clip.jobId} path={clip.src}/>;return clip?<ArtVideo src={mediaUrl(clip.src)??clip.src} poster={clip.poster?mediaUrl(clip.poster):undefined}/>:null;
}
