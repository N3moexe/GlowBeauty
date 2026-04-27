import { type Banner as BannerType } from "@/types/banner";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

interface BannerProps {
  banner: BannerType;
  onClose?: () => void;
  className?: string;
}

export default function Banner({ banner, onClose, className = "" }: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const bgColor = banner.backgroundColor || "#C41E3A";
  const textColor = banner.textColor || "#FFFFFF";

  const baseClasses = "relative overflow-hidden";
  const layoutClasses = {
    "full-width": "w-full py-6 px-4",
    centered: "w-full max-w-4xl mx-auto py-6 px-4 rounded-lg",
    "side-by-side": "w-full py-8 px-4 flex items-center gap-6",
    overlay: "w-full h-64 flex items-center justify-center",
  };

  return (
    <div
      className={`${baseClasses} ${layoutClasses[banner.layout as keyof typeof layoutClasses] || layoutClasses["full-width"]} ${className}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Close banner"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="container mx-auto">
        {banner.layout === "side-by-side" && banner.imageUrl ? (
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
              {banner.description && (
                <p className="text-sm mb-4 opacity-90">{banner.description}</p>
              )}
              {banner.buttonText && banner.buttonLink && (
                <Button
                  asChild
                  className="bg-white text-gray-900 hover:bg-gray-100"
                >
                  <a href={banner.buttonLink}>{banner.buttonText}</a>
                </Button>
              )}
            </div>
            <div className="flex-1">
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-auto rounded-lg object-cover"
              />
            </div>
          </div>
        ) : banner.layout === "overlay" && banner.imageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner.imageUrl})` }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center">
              <h3 className="text-3xl font-bold mb-2">{banner.title}</h3>
              {banner.description && (
                <p className="text-lg mb-6 max-w-2xl">{banner.description}</p>
              )}
              {banner.buttonText && banner.buttonLink && (
                <Button
                  asChild
                  className="bg-white text-gray-900 hover:bg-gray-100"
                >
                  <a href={banner.buttonLink}>{banner.buttonText}</a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {banner.imageUrl && banner.layout !== "overlay" && (
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
              {banner.description && (
                <p className="text-sm mb-4 opacity-90">{banner.description}</p>
              )}
              {banner.buttonText && banner.buttonLink && (
                <Button
                  asChild
                  className="bg-white text-gray-900 hover:bg-gray-100"
                >
                  <a href={banner.buttonLink}>{banner.buttonText}</a>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
