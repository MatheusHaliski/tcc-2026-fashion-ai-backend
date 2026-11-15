/**
 * Endereço da visão 3D do quarto (Atelier › Quarto). `/room`, o "Ver o quarto" do Atelier e o "Abrir meu quarto" do
 * Inventory Score chegam aqui; `module` leva a câmera a um módulo (porta, gaveta, luz…).
 */
export function room3dHref(module?: string | null): string {
  return module ? `/atelier?tab=room&quarto=3d&modulo=${encodeURIComponent(module)}` : "/atelier?tab=room&quarto=3d";
}
