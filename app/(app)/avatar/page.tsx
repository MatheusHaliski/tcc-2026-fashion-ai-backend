"use client";
import { RequireAuth } from "@/components/app-shell";
import MyAvatar from "@/components/avatar3d/my-avatar";

/** RF40 — Meu Avatar 3D. */
export default function AvatarPage() { return <RequireAuth><MyAvatar /></RequireAuth>; }
