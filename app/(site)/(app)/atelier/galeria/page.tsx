import {RequireAuth} from "@/components/app-shell";
import {PhotoLibrary} from "@/components/atelier/photo-library";
export default function AtelierGalleryPage(){return <RequireAuth><PhotoLibrary/></RequireAuth>;}
