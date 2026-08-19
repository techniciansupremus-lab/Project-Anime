import { Play } from "lucide-react";
import { cn } from "../../../shared/utils/utils";

type DiscoveryCardProps = {
  title: string;
  detail: string;
  image: string;
  imagePosition: string;
  onOpen?: () => void;
  className?: string;
  visualStyle?: "poster" | "gallery";
};

export function DiscoveryCard({
  title,
  detail,
  image,
  imagePosition,
  onOpen,
  className,
  visualStyle = "poster",
}: DiscoveryCardProps) {
  const gallery = visualStyle === "gallery";
  return (
    <article className={cn("streaming-card group w-[10.5rem] shrink-0 font-body sm:w-48", className)}>
      <button
        className={cn(
          "relative block w-full overflow-hidden bg-ink-800 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950",
          gallery ? "aspect-[2/3] rounded-lg" : "aspect-[2/3]"
        )}
        aria-label={`Open ${title}`}
        onClick={onOpen}
      >
        <img
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
          src={image}
          style={{ objectPosition: imagePosition }}
          alt="Artwork"
        />
        <span
          className="absolute inset-0 bg-ink-950/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
          aria-hidden
        />
        <span
          className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
          aria-hidden
        >
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white bg-white text-black shadow-[inset_0_1px_0_#ffffff,0_4px_0_#cbd5e1,0_8px_14px_rgba(0,0,0,0.34)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-px group-hover:shadow-[inset_0_1px_0_#ffffff,0_5px_0_#cbd5e1,0_9px_15px_rgba(0,0,0,0.36)] group-active:translate-y-[3px] group-active:shadow-[inset_0_1px_0_#ffffff,0_1px_0_#cbd5e1]">
            <Play size={16} strokeWidth={1.7} fill="currentColor" />
          </span>
        </span>
      </button>
      <h3 className="mt-4 font-display text-xl leading-6 tracking-display text-paper-100">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-4 text-fog-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
        {detail}
      </p>
    </article>
  );
}
