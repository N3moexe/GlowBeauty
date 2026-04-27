export interface Banner {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  position: "top" | "bottom" | "sidebar" | "hero" | "custom";
  displayOn: "homepage" | "shop" | "all" | "custom";
  layout: "full-width" | "centered" | "side-by-side" | "overlay";
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
