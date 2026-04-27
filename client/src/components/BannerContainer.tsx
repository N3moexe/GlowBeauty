import { trpc } from "@/lib/trpc";
import Banner from "@/components/Banner";
import { Loader } from "lucide-react";

interface BannerContainerProps {
  position?: "top" | "bottom" | "sidebar" | "hero" | "custom";
  page?: "homepage" | "shop" | "all";
  className?: string;
}

export default function BannerContainer({
  position,
  page = "all",
  className = "",
}: BannerContainerProps) {
  const { data, isLoading, isFetching } = trpc.banners.getForPage.useQuery({
    page,
    position,
  }, {
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  if (isLoading || (isFetching && !data)) {
    return (
      <div className={`flex items-center justify-center py-4 ${className}`}>
        <Loader className="h-6 w-6 animate-spin text-crimson" />
      </div>
    );
  }

  if (!data || data.count === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {data.banners.map((banner: any) => (
        <Banner key={banner.id} banner={banner} />
      ))}
    </div>
  );
}
